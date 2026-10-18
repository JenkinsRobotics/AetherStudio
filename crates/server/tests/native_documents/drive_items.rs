use super::*;
async fn call(f: &Fixture, user: &str, action: &str, input: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/drive/{action}", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&input)
        .send()
        .await
        .unwrap()
}
async fn seed() -> Fixture {
    let f = Fixture::new().await;
    let input: Mutation = serde_json::from_value(json!({"operation_id":"seed","document_id":"model","change":{"kind":"create","app":"map","name":"Drawing","content_base64":"e30="},"location":Location::default()})).unwrap();
    f.docs.mutate(&token("alice"), &input).await.unwrap();
    f
}
async fn recent_count(f: &Fixture) -> i64 {
    f.pool
        .get()
        .await
        .unwrap()
        .query_one("SELECT count(*) FROM aether_access.library_recents", &[])
        .await
        .unwrap()
        .get(0)
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_items_details_are_readonly_and_open_only_updates_recents() {
    let f = seed().await;
    let response = call(&f, "alice", "details", json!({"id":"model"})).await;
    assert_eq!(response.status(), 200);
    let metadata: Value = response.json().await.unwrap();
    assert_eq!(metadata["name"], "Drawing");
    assert_eq!(metadata["revision"], 1);
    assert!(metadata.get("data_base64").is_none());
    assert_eq!(recent_count(&f).await, 0);
    for _ in 0..2 {
        let opened = call(&f, "alice", "open", json!({"id":"model"})).await;
        assert_eq!(opened.status(), 200);
        assert_eq!(opened.json::<Value>().await.unwrap(), metadata);
    }
    assert_eq!(recent_count(&f).await, 1);
    let revisions: i64 = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one("SELECT count(*) FROM aether_store.revisions", &[])
        .await
        .unwrap()
        .get(0);
    assert_eq!(revisions, 1);
    // Metadata-only navigation still works when ordinary document blobs are unavailable.
    std::fs::remove_dir_all(f._objects.path()).unwrap();
    assert_eq!(
        call(&f, "alice", "details", json!({"id":"model"}))
            .await
            .status(),
        200
    );
    assert_eq!(
        call(&f, "alice", "open", json!({"id":"model"}))
            .await
            .status(),
        200
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_items_current_access_and_strict_requests_control_navigation() {
    let f = seed().await;
    for action in ["open", "details", "read"] {
        assert_eq!(
            call(&f, "bob", action, json!({"id":"model"}))
                .await
                .status(),
            404
        );
        for invalid in [
            json!({}),
            json!({"id":null}),
            json!({"id":"../model"}),
            json!({"id":"model","unexpected":true}),
        ] {
            assert_eq!(call(&f, "alice", action, invalid).await.status(), 400);
        }
    }
    f.docs
        .create_named_folder(&token("alice"), "folder", &Location::default(), "Folder")
        .await
        .unwrap();
    assert_eq!(
        call(&f, "alice", "details", json!({"id":"folder"}))
            .await
            .status(),
        200
    );
    assert_eq!(
        call(&f, "alice", "open", json!({"id":"folder"}))
            .await
            .status(),
        400
    );
    f.sql(
        "UPDATE aether_access.applications SET enabled=false WHERE tenant='company' AND id='map'",
    )
    .await;
    for action in ["open", "details", "read"] {
        assert_eq!(
            call(&f, "alice", action, json!({"id":"model"}))
                .await
                .status(),
            404
        );
    }
    assert_eq!(recent_count(&f).await, 0);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_items_read_returns_saved_bytes_and_only_records_successful_reads() {
    let f = seed().await;
    let response = call(&f, "alice", "read", json!({"id":"model"})).await;
    assert_eq!(response.status(), 200);
    assert_eq!(response.headers()["cache-control"], "no-store");
    let saved: Value = response.json().await.unwrap();
    assert_eq!(saved["data_base64"], "e30=");
    assert_eq!(saved["sha256"], format!("{:x}", Sha256::digest(b"{}")));
    assert_eq!(saved["size"], 2);
    assert_eq!(saved["revision"], 1);
    assert_eq!(recent_count(&f).await, 1);
    f.sql("DELETE FROM aether_access.library_recents").await;
    std::fs::remove_dir_all(f._objects.path()).unwrap();
    assert_eq!(
        call(&f, "alice", "read", json!({"id":"model"}))
            .await
            .status(),
        503
    );
    assert_eq!(recent_count(&f).await, 0);
    assert_eq!(
        call(&f, "alice", "details", json!({"id":"model"}))
            .await
            .status(),
        200
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
        1
    );
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_items_read_failure_is_atomic_and_never_enrolls_a_removed_viewer() {
    let f = seed().await;
    f.docs
        .grant(&token("alice"), "model", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    let response = call(&f, "bob", "read", json!({"id":"model"})).await;
    assert_eq!(response.status(), 200);
    let value: Value = response.json().await.unwrap();
    assert_eq!(value["writable"], false);
    assert_eq!(value["data_base64"], "e30=");
    f.sql("DELETE FROM aether_access.library_recents; CREATE FUNCTION reject_read_recent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test recent failure'; END $$; CREATE TRIGGER reject_read_recent BEFORE INSERT ON aether_access.library_recents FOR EACH ROW EXECUTE FUNCTION reject_read_recent()").await;
    assert_eq!(
        call(&f, "bob", "read", json!({"id":"model"}))
            .await
            .status(),
        503
    );
    assert_eq!(recent_count(&f).await, 0);
    f.sql("DELETE FROM aether_access.enrolled WHERE tenant='company' AND user_id='bob'; DELETE FROM aether_access.members WHERE tenant='company' AND user_id='bob'").await;
    assert_eq!(
        call(&f, "bob", "read", json!({"id":"model"}))
            .await
            .status(),
        404
    );
    assert_eq!(f.pool.get().await.unwrap().query_one("SELECT count(*) FROM aether_access.enrolled WHERE tenant='company' AND user_id='bob'", &[]).await.unwrap().get::<_,i64>(0),0);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_items_queued_read_rechecks_current_permissions_without_partial_recents() {
    let f = seed().await;
    f.docs
        .grant(&token("alice"), "model", "bob", Some(Role::Viewer))
        .await
        .unwrap();
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
        .post(format!("{}/api/drive/read", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token("bob")))
        .json(&json!({"id":"model"}));
    let pending = tokio::spawn(async move { request.send().await.unwrap() });
    f.waiting("1095062604").await;
    tx.execute("DELETE FROM aether_access.grants WHERE tenant='company' AND resource='model' AND user_id='bob'",&[]).await.unwrap();
    tx.commit().await.unwrap();
    assert_eq!(pending.await.unwrap().status(), 404);
    assert_eq!(recent_count(&f).await, 0);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_items_recent_failure_cannot_change_document_or_acknowledge_open() {
    let f = seed().await;
    f.sql("CREATE FUNCTION reject_open_recent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test recent failure'; END $$; CREATE TRIGGER reject_open_recent BEFORE INSERT ON aether_access.library_recents FOR EACH ROW EXECUTE FUNCTION reject_open_recent()").await;
    let response = call(&f, "alice", "open", json!({"id":"model"})).await;
    assert_eq!(response.status(), 503);
    assert_eq!(recent_count(&f).await, 0);
    assert_eq!(
        call(&f, "alice", "details", json!({"id":"model"}))
            .await
            .status(),
        200
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
        1
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_items_queued_membership_revocation_prevents_open() {
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
        .post(format!("{}/api/drive/open", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .json(&json!({"id":"model"}));
    let pending = tokio::spawn(async move { req.send().await.unwrap() });
    f.waiting("1095062604").await;
    tx.commit().await.unwrap();
    assert_eq!(pending.await.unwrap().status(), 404);
    assert_eq!(recent_count(&f).await, 0);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_items_shared_viewer_and_revocation_never_enroll_or_bypass_permissions() {
    let f = seed().await;
    f.docs
        .grant(&token("alice"), "model", "bob", Some(Role::Viewer))
        .await
        .unwrap();
    let visible = call(&f, "bob", "open", json!({"id":"model"})).await;
    assert_eq!(visible.status(), 200);
    let metadata: Value = visible.json().await.unwrap();
    assert_eq!(metadata["writable"], false);
    assert_eq!(metadata["role"], "viewer");
    f.docs
        .grant(&token("alice"), "model", "bob", None)
        .await
        .unwrap();
    assert_eq!(
        call(&f, "bob", "details", json!({"id":"model"}))
            .await
            .status(),
        404
    );
    assert_eq!(
        call(&f, "bob", "open", json!({"id":"model"}))
            .await
            .status(),
        404
    );
    f.sql("DELETE FROM aether_access.members WHERE tenant='company' AND user_id='alice'; DELETE FROM aether_access.enrolled WHERE tenant='company' AND user_id='alice'").await;
    assert_eq!(
        call(&f, "alice", "details", json!({"id":"model"}))
            .await
            .status(),
        404
    );
    assert_eq!(
        call(&f, "alice", "open", json!({"id":"model"}))
            .await
            .status(),
        404
    );
    let count:i64=f.pool.get().await.unwrap().query_one("SELECT count(*) FROM aether_access.enrolled WHERE tenant='company' AND user_id='alice'",&[]).await.unwrap().get(0);
    assert_eq!(count, 0);
    assert_eq!(recent_count(&f).await, 1);
}
