use super::*;
async fn call(f: &Fixture, user: &str, body: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/drive/favorite", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&body)
        .send()
        .await
        .unwrap()
}
fn request(op: &str, favorite: bool) -> Value {
    json!({"id":"model","favorite":favorite,"operation_id":op})
}
async fn seed() -> Fixture {
    let f = Fixture::new().await;
    let input:Mutation=serde_json::from_value(json!({"operation_id":"seed","document_id":"model","change":{"kind":"create","app":"map","name":"Drawing","content_base64":"e30="},"location":Location::default()})).unwrap();
    f.docs.mutate(&token("alice"), &input).await.unwrap();
    f
}
async fn ok(f: &Fixture, user: &str, body: Value) -> Value {
    let r = call(f, user, body).await;
    let status = r.status();
    let value: Value = r.json().await.unwrap();
    assert_eq!(status, 200, "{value}");
    value
}
async fn list(f: &Fixture, user: &str, body: Value) -> Value {
    let r = f
        .client
        .post(format!("{}/api/drive/list", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&body)
        .send()
        .await
        .unwrap();
    let status = r.status();
    let v: Value = r.json().await.unwrap();
    assert_eq!(status, 200, "{v}");
    v
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn file_favorites_private_state_replay_and_listing_leave_documents_unchanged() {
    let f = seed().await;
    f.docs
        .grant(&token("alice"), "model", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    let first = ok(&f, "alice", request("star", true)).await;
    assert_eq!(
        first,
        json!({"ok":true,"applied_revision":1,"favorite":true,"replayed":false})
    );
    assert_eq!(
        ok(&f, "alice", request("star", true)).await,
        json!({"ok":true,"applied_revision":1,"favorite":true,"replayed":true})
    );
    assert_eq!(
        list(&f, "alice", json!({"view":"favorites"})).await["files"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert!(
        list(&f, "bob", json!({"view":"favorites"})).await["files"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    ok(&f, "bob", request("star", true)).await;
    assert_eq!(
        list(&f, "bob", json!({"view":"favorites"})).await["files"][0]["writable"],
        false
    );
    ok(&f, "alice", request("unstar", false)).await;
    let replay = ok(&f, "alice", request("star", true)).await;
    assert_eq!(replay["favorite"], false);
    assert_eq!(replay["applied_revision"], 1);
    assert!(
        list(&f, "alice", json!({"view":"favorites"})).await["files"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    assert_eq!(
        call(&f, "alice", request("star", false)).await.status(),
        409
    );
    let client = f.pool.get().await.unwrap();
    let counts=client.query_one("SELECT (SELECT count(*) FROM aether_store.revisions),(SELECT count(*) FROM aether_access.file_favorite_events),(SELECT count(*) FROM aether_access.library_recents)",&[]).await.unwrap();
    assert_eq!(counts.get::<_, i64>(0), 1);
    assert_eq!(counts.get::<_, i64>(1), 3);
    assert_eq!(counts.get::<_, i64>(2), 0);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn file_favorites_current_permissions_apply_before_receipt_replay() {
    let f = seed().await;
    assert_eq!(call(&f, "bob", request("star", true)).await.status(), 404);
    f.docs
        .grant(&token("alice"), "model", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    ok(&f, "bob", request("star", true)).await;
    f.docs
        .grant(&token("alice"), "model", "bob", None)
        .await
        .unwrap();
    assert_eq!(call(&f, "bob", request("star", true)).await.status(), 404);
    assert!(
        list(&f, "bob", json!({"view":"favorites"})).await["files"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    f.sql(
        "UPDATE aether_access.applications SET enabled=false WHERE tenant='company' AND id='map'",
    )
    .await;
    assert_eq!(call(&f, "alice", request("star", true)).await.status(), 404);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn file_favorites_failed_audit_rolls_back_preference_receipt_and_event() {
    let f = seed().await;
    f.sql("CREATE FUNCTION reject_favorite_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test favorite audit'; END $$; CREATE TRIGGER reject_favorite_audit BEFORE INSERT ON aether_access.audit FOR EACH ROW EXECUTE FUNCTION reject_favorite_audit()").await;
    assert_eq!(call(&f, "alice", request("star", true)).await.status(), 503);
    let client = f.pool.get().await.unwrap();
    for table in [
        "file_favorites",
        "file_favorite_receipts",
        "file_favorite_events",
    ] {
        assert_eq!(
            client
                .query_one(&format!("SELECT count(*) FROM aether_access.{table}"), &[])
                .await
                .unwrap()
                .get::<_, i64>(0),
            0
        );
    }
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn file_favorites_concurrent_retries_commit_once_and_strict_inputs_do_not_write() {
    let f = seed().await;
    for body in [
        json!({}),
        json!({"id":"model","favorite":true}),
        json!({"id":"model","favorite":"yes","operation_id":"bad"}),
        json!({"id":"model","favorite":true,"operation_id":"bad","user":"bob"}),
        json!({"id":"../model","favorite":true,"operation_id":"bad"}),
    ] {
        assert_eq!(call(&f, "alice", body).await.status(), 400);
    }
    let (a, b) = tokio::join!(
        call(&f, "alice", request("once", true)),
        call(&f, "alice", request("once", true))
    );
    assert_eq!(a.status(), 200);
    assert_eq!(b.status(), 200);
    let mut replayed = vec![
        a.json::<Value>().await.unwrap()["replayed"]
            .as_bool()
            .unwrap(),
        b.json::<Value>().await.unwrap()["replayed"]
            .as_bool()
            .unwrap(),
    ];
    replayed.sort();
    assert_eq!(replayed, [false, true]);
    let count: i64 = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one(
            "SELECT count(*) FROM aether_access.file_favorite_events",
            &[],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(count, 1);
    f.sql("UPDATE aether_access.file_favorites SET revision=4294967295 WHERE tenant='company' AND user_id='alice' AND resource='model'").await;
    assert_eq!(
        call(&f, "alice", request("overflow", false)).await.status(),
        501
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn file_favorites_queued_revocation_prevents_new_preference_and_receipt() {
    let f = seed().await;
    let mut client = f.pool.get().await.unwrap();
    let tx = client.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062604))",
        &[],
    )
    .await
    .unwrap();
    tx.execute(
        "DELETE FROM aether_access.members WHERE tenant='company' AND user_id='alice'",
        &[],
    )
    .await
    .unwrap();
    let req = f
        .client
        .post(format!("{}/api/drive/favorite", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .json(&request("waiting", true));
    let pending = tokio::spawn(async move { req.send().await.unwrap() });
    f.waiting("1095062604").await;
    tx.commit().await.unwrap();
    assert_eq!(pending.await.unwrap().status(), 404);
    assert_eq!(
        client
            .query_one(
                "SELECT count(*) FROM aether_access.file_favorite_receipts",
                &[]
            )
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn file_favorites_folder_and_matching_tenant_ids_keep_private_state_separate() {
    let f = seed().await;
    f.docs
        .create_named_folder(
            &token("alice"),
            "folder",
            &Location::default(),
            "Collection",
        )
        .await
        .unwrap();
    ok(
        &f,
        "alice",
        json!({"id":"folder","favorite":true,"operation_id":"folder"}),
    )
    .await;
    f.sql("INSERT INTO aether_identity.users(tenant,id,username,password,role,must_change) VALUES('other','alice','Other Alice','unused','member',false); INSERT INTO aether_access.organizations VALUES('other','default','Other organization'); INSERT INTO aether_access.members VALUES('other','default','alice','owner'); INSERT INTO aether_access.resources(tenant,id,organization,owner,kind,app,folder_name) VALUES('other','model','default','alice','folder','drive','Other secret'); INSERT INTO aether_access.file_favorites VALUES('other','alice','model',true,0)").await;
    let page = list(&f, "alice", json!({"view":"favorites"})).await;
    assert_eq!(page["files"].as_array().unwrap().len(), 1);
    assert_eq!(page["files"][0]["id"], "folder");
    ok(&f, "alice", request("mine", false)).await;
    assert!(f.pool.get().await.unwrap().query_one("SELECT favorite FROM aether_access.file_favorites WHERE tenant='other' AND user_id='alice' AND resource='model'",&[]).await.unwrap().get::<_,bool>(0));
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn file_favorites_upgrade_is_atomic_repeatable_and_preserves_schema10_metadata() {
    let f = seed().await;
    f.sql(
        "INSERT INTO aether_access.legacy_file_metadata VALUES('company','model',1,123.125,124.25)",
    )
    .await;
    let previous = [
        include_str!("../../src/documents/schema.sql"),
        include_str!("../../src/documents/002-directory.sql"),
        include_str!("../../src/documents/003-folders.sql"),
        include_str!("../../src/documents/004-resource-lifecycle.sql"),
        include_str!("../../src/documents/005-library-recents.sql"),
        include_str!("../../src/documents/006-legacy-history.sql"),
        include_str!("../../src/documents/007-named-versions.sql"),
        include_str!("../../src/documents/008-collaboration.sql"),
        include_str!("../../src/documents/009-workspace-preferences.sql"),
        include_str!("../../src/documents/010-legacy-file-metadata.sql"),
    ]
    .concat();
    let checksum = format!("{:x}", Sha256::digest(previous.as_bytes()));
    f.access_before_branch_metadata().await;
    f.sql(&format!("DROP TABLE aether_access.link_credentials; DROP TABLE aether_access.uploads,aether_access.upload_blobs; DROP TABLE aether_access.legacy_drive_imported_folders; DROP TABLE aether_access.legacy_drive_events; DROP TABLE aether_access.grant_provenance; DROP TABLE aether_access.file_favorite_events,aether_access.file_favorite_receipts,aether_access.file_favorites; UPDATE aether_access.schema_state SET version=10,checksum='{checksum}'; CREATE VIEW aether_access.file_favorite_receipts AS SELECT 1 AS conflict")).await;
    assert!(f.docs.check_schema().await.is_err());
    assert!(f.docs.migrate().await.is_err());
    let client = f.pool.get().await.unwrap();
    assert_eq!(
        client
            .query_one("SELECT version FROM aether_access.schema_state", &[])
            .await
            .unwrap()
            .get::<_, i32>(0),
        10
    );
    f.sql("DROP VIEW aether_access.file_favorite_receipts")
        .await;
    f.docs.migrate().await.unwrap();
    f.docs.migrate().await.unwrap();
    f.docs.check_schema().await.unwrap();
    assert_eq!(
        client
            .query_one(
                "SELECT created FROM aether_access.legacy_file_metadata",
                &[]
            )
            .await
            .unwrap()
            .get::<_, f64>(0),
        123.125
    );
    assert_eq!(
        ok(&f, "alice", request("first", true)).await["applied_revision"],
        1
    );
}
