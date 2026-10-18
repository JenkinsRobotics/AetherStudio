use super::*;
async fn request(f: &Fixture, user: &str, input: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/drive/list", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&input)
        .send()
        .await
        .unwrap()
}
async fn list(f: &Fixture, user: &str, input: Value) -> Value {
    let response = request(f, user, input).await;
    assert_eq!(response.status(), 200);
    response.json().await.unwrap()
}
fn ids(v: &Value) -> Vec<&str> {
    v["files"]
        .as_array()
        .unwrap()
        .iter()
        .map(|f| f["id"].as_str().unwrap())
        .collect()
}
async fn seed() -> Fixture {
    let f = Fixture::new().await;
    f.docs
        .set_organization_member(&token("admin"), "default", "bob", Some("member"))
        .await
        .unwrap();
    f.docs
        .create_named_folder(
            &token("alice"),
            "folder",
            &Location::default(),
            "Private Folder",
        )
        .await
        .unwrap();
    for (id, name) in [("drawing", "Drawing"), ("live", "Live")] {
        let input = mutation(
            json!({"operation_id":id,"document_id":id,"change":{"kind":"create","app":"map","name":name,"content_base64":"e30="},"location":{"organization":"default","workspace":null,"parent":"folder"}}),
        );
        f.docs.mutate(&token("alice"), &input).await.unwrap();
    }
    f
}
async fn change(f: &Fixture, id: &str, revision: u32, kind: &str) {
    let value = json!({"id":id,"expected_structure_revision":revision,"operation_id":format!("{kind}-{id}-{revision}"),"change":{"kind":kind}});
    assert_eq!(
        f.post("alice", "resource-change", value).await.status(),
        200
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_recycle_projects_roots_nested_items_and_restore_without_rewriting_history() {
    let f = seed().await;
    change(&f, "drawing", 1, "trash").await;
    change(&f, "folder", 1, "trash").await;
    let root = list(&f, "alice", json!({"view":"trash"})).await;
    assert_eq!(ids(&root), ["folder"]);
    assert_eq!(root["files"][0]["trashed"], true);
    assert_eq!(root["files"][0]["deleted_by"], "alice");
    assert!(root["files"][0]["deleted_at"].as_f64().unwrap() > 0.0);
    assert_eq!(
        ids(&list(&f, "alice", json!({"view":"trash","query":"Drawing"})).await),
        ["drawing"]
    );
    let nested = list(&f, "alice", json!({"view":"trash","parent":"folder"})).await;
    assert_eq!(ids(&nested), ["drawing"]);
    assert_eq!(
        nested["files"][0]["original_location"],
        "My files > Private Folder"
    );
    assert!(ids(&list(&f, "alice", json!({"view":"search"})).await).is_empty());
    change(&f, "folder", 2, "restore").await;
    assert_eq!(
        ids(&list(&f, "alice", json!({"view":"trash"})).await),
        ["drawing"]
    );
    assert_eq!(
        ids(&list(&f, "alice", json!({"parent":"folder"})).await),
        ["live"]
    );
    change(&f, "drawing", 2, "restore").await;
    assert!(ids(&list(&f, "alice", json!({"view":"trash"})).await).is_empty());
    assert_eq!(
        f.pool
            .get()
            .await
            .unwrap()
            .query_one("SELECT count(*) FROM aether_store.revisions", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        2
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_recycle_shared_child_redacts_private_parent_and_enforces_app_access() {
    let f = seed().await;
    f.docs
        .grant(&token("alice"), "drawing", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    change(&f, "drawing", 1, "trash").await;
    let page = list(&f, "bob", json!({"view":"trash","organization":"all"})).await;
    assert_eq!(ids(&page), ["drawing"]);
    let file = &page["files"][0];
    assert_eq!(file["original_location"], "Shared files");
    assert_eq!(file["parent_hidden"], true);
    assert!(file["parent"].is_null());
    assert_eq!(file["writable"], false);
    assert_eq!(file["manageable"], false);
    assert_eq!(file["revision"], 1);
    assert!(file.get("data_base64").is_none());
    assert!(!page.to_string().contains("Private Folder"));
    let read = f
        .client
        .post(format!("{}/api/drive/read", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token("bob")))
        .json(&json!({"id":"drawing"}))
        .send()
        .await
        .unwrap();
    assert_eq!(read.status(), 404);
    f.sql(
        "UPDATE aether_access.applications SET enabled=false WHERE tenant='company' AND id='map'",
    )
    .await;
    assert!(ids(&list(&f, "bob", json!({"view":"trash"})).await).is_empty());
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_recycle_imported_unknown_deletion_facts_are_not_invented() {
    let f = seed().await;
    f.sql(
        "UPDATE aether_access.resources SET trashed=true WHERE tenant='company' AND id='drawing'",
    )
    .await;
    let page = list(&f, "alice", json!({"view":"trash"})).await;
    let file = &page["files"][0];
    assert!(file["deleted_at"].is_null());
    assert!(file["deleted_by"].is_null());
    assert_eq!(file["name"], "Drawing");
    f.sql("UPDATE aether_access.resources SET app='map' WHERE tenant='company' AND id='folder'; UPDATE aether_access.applications SET enabled=false WHERE tenant='company' AND id='map'").await;
    assert!(ids(&list(&f, "alice", json!({"view":"trash"})).await).is_empty());
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_recycle_queued_permission_removal_never_discloses_recycled_metadata() {
    let f = seed().await;
    f.docs
        .grant(&token("alice"), "drawing", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    change(&f, "drawing", 1, "trash").await;
    let mut client = f.pool.get().await.unwrap();
    let tx = client.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062604))",
        &[],
    )
    .await
    .unwrap();
    let request = f
        .client
        .post(format!("{}/api/drive/list", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token("bob")))
        .json(&json!({"view":"trash"}));
    let pending = tokio::spawn(async move { request.send().await.unwrap() });
    f.waiting("1095062604").await;
    tx.execute(
        "DELETE FROM aether_access.grants WHERE tenant='company' AND user_id='bob'",
        &[],
    )
    .await
    .unwrap();
    tx.commit().await.unwrap();
    let response = pending.await.unwrap();
    assert_eq!(response.status(), 200);
    assert!(ids(&response.json::<Value>().await.unwrap()).is_empty());
}

async fn recycle_action(f: &Fixture, user: &str, action: &str, input: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/drive/{action}", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&input)
        .send()
        .await
        .unwrap()
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_recycle_controls_use_selected_guard_and_exact_receipts_without_new_history() {
    let f = seed().await;
    let page = list(&f, "alice", json!({"parent":"folder"})).await;
    assert_eq!(page["files"][0]["structure_revision"], 1);
    let trash =
        json!({"id":"drawing","operation_id":"drive-trash","expected_structure_revision":1});
    let response = recycle_action(&f, "alice", "trash", trash.clone()).await;
    assert_eq!(response.status(), 200);
    let first: Value = response.json().await.unwrap();
    assert_eq!(first["resource"]["trashed"], true);
    assert_eq!(first["resource"]["structure_revision"], 2);
    assert_eq!(first["replayed"], false);
    let replay = recycle_action(&f, "alice", "trash", trash.clone()).await;
    assert_eq!(replay.status(), 200);
    assert_eq!(replay.json::<Value>().await.unwrap()["replayed"], true);
    assert_eq!(
        recycle_action(
            &f,
            "alice",
            "restore",
            json!({"id":"drawing","operation_id":"stale","expected_structure_revision":1})
        )
        .await
        .status(),
        409
    );
    let restored = recycle_action(
        &f,
        "alice",
        "restore",
        json!({"id":"drawing","operation_id":"drive-restore","expected_structure_revision":2}),
    )
    .await;
    assert_eq!(restored.status(), 200);
    assert_eq!(
        restored.json::<Value>().await.unwrap()["resource"]["structure_revision"],
        3
    );
    // A delayed retry acknowledges the original operation, never re-trashes.
    assert_eq!(
        recycle_action(&f, "alice", "trash", trash.clone())
            .await
            .status(),
        200
    );
    assert!(ids(&list(&f, "alice", json!({"view":"trash"})).await).is_empty());
    assert_eq!(
        recycle_action(
            &f,
            "alice",
            "trash",
            json!({"id":"drawing","operation_id":"drive-trash","expected_structure_revision":3})
        )
        .await
        .status(),
        409
    );
    assert_eq!(
        f.pool
            .get()
            .await
            .unwrap()
            .query_one("SELECT count(*) FROM aether_store.revisions", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        2
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_recycle_controls_require_explicit_guard_current_owner_and_enabled_service() {
    let f = seed().await;
    let valid =
        json!({"id":"drawing","operation_id":"drive-trash","expected_structure_revision":1});
    for invalid in [
        json!({"id":"drawing"}),
        json!({"id":"drawing","operation_id":"x","expected_structure_revision":0}),
        json!({"id":"drawing","operation_id":"x","expected_structure_revision":1,"actor":"alice"}),
    ] {
        assert_eq!(
            recycle_action(&f, "alice", "trash", invalid).await.status(),
            400
        );
    }
    f.docs
        .grant(&token("alice"), "drawing", "bob", Some(Role::Editor))
        .await
        .unwrap();
    assert_eq!(
        recycle_action(&f, "bob", "trash", valid.clone())
            .await
            .status(),
        404
    );
    assert_eq!(
        recycle_action(&f, "eve", "trash", valid.clone())
            .await
            .status(),
        404
    );
    let count = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one(
            "SELECT count(*) FROM aether_access.enrolled WHERE user_id='eve'",
            &[],
        )
        .await
        .unwrap()
        .get::<_, i64>(0);
    assert_eq!(count, 0);
    f.sql(
        "UPDATE aether_access.applications SET enabled=false WHERE tenant='company' AND id='drive'",
    )
    .await;
    assert_eq!(
        recycle_action(&f, "alice", "trash", valid.clone())
            .await
            .status(),
        404
    );
    f.sql(
        "UPDATE aether_access.applications SET enabled=true WHERE tenant='company' AND id='drive'",
    )
    .await;
    assert_eq!(
        recycle_action(&f, "alice", "trash", valid.clone())
            .await
            .status(),
        200
    );
    f.docs
        .set_organization_member(&token("admin"), "default", "alice", None)
        .await
        .unwrap();
    assert_eq!(
        recycle_action(&f, "alice", "trash", valid).await.status(),
        404
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_recycle_controls_roll_back_on_audit_failure() {
    let f = seed().await;
    f.sql("CREATE FUNCTION reject_drive_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$; CREATE TRIGGER reject_drive_audit BEFORE INSERT ON aether_access.audit FOR EACH ROW EXECUTE FUNCTION reject_drive_audit()").await;
    let response = recycle_action(
        &f,
        "alice",
        "trash",
        json!({"id":"drawing","operation_id":"drive-trash","expected_structure_revision":1}),
    )
    .await;
    assert!(!response.status().is_success());
    let c = f.pool.get().await.unwrap();
    assert!(
        !c.query_one(
            "SELECT trashed FROM aether_access.resources WHERE id='drawing'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, bool>(0)
    );
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.resource_receipts", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
}
