use super::*;
async fn grant(f: &Fixture, user: &str, input: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/drive/grant", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&input)
        .send()
        .await
        .unwrap()
}
fn request(operation: &str, role: &str, expected: Value) -> Value {
    json!({"id":"drawing","user":"bob","role":role,"expected_role":expected,"operation_id":operation})
}
async fn seed() -> Fixture {
    let f = Fixture::new().await;
    f.docs.mutate(&token("alice"), &mutation(json!({"operation_id":"new","document_id":"drawing","change":{"kind":"create","app":"map","name":"Drawing","content_base64":"e30="}}))).await.unwrap();
    f.docs
        .set_organization_member(&token("admin"), "default", "bob", Some("member"))
        .await
        .unwrap();
    f
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_grants_guard_roles_preserve_provenance_and_retry_without_reapplying_old_access() {
    let f = seed().await;
    let first = request("share", "viewer", Value::Null);
    let r = grant(&f, "alice", first.clone()).await;
    assert_eq!(r.status(), 200);
    assert_eq!(r.json::<Value>().await.unwrap()["replayed"], false);
    assert_eq!(
        f.docs
            .read(&token("bob"), "drawing", None)
            .await
            .unwrap()
            .content_base64,
        "e30="
    );
    assert_eq!(
        grant(&f, "alice", request("stale", "editor", Value::Null))
            .await
            .status(),
        409
    );
    f.sql("UPDATE aether_access.grant_provenance SET shared_at=1234.5")
        .await;
    assert_eq!(
        grant(&f, "alice", request("edit", "editor", json!("viewer")))
            .await
            .status(),
        200
    );
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one("SELECT shared_at FROM aether_access.grant_provenance", &[])
            .await
            .unwrap()
            .get::<_, f64>(0),
        1234.5
    );
    assert_eq!(
        grant(&f, "alice", request("remove", "remove", json!("editor")))
            .await
            .status(),
        200
    );
    assert!(f.docs.read(&token("bob"), "drawing", None).await.is_err());
    let r = grant(&f, "alice", first.clone()).await;
    assert_eq!(r.status(), 200);
    let replay: Value = r.json().await.unwrap();
    assert_eq!(replay["role"], Value::Null);
    assert_eq!(replay["applied_role"], "viewer");
    assert_eq!(replay["replayed"], true);
    assert!(f.docs.read(&token("bob"), "drawing", None).await.is_err());
    assert_eq!(
        grant(&f, "alice", request("share", "editor", Value::Null))
            .await
            .status(),
        409
    );
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.audit WHERE action='grant'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        3
    );
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_store.revisions", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        1
    );
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.grant_provenance", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
    f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert_eq!(grant(&f, "alice", first).await.status(), 404);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_grants_refuse_nonowners_missing_guards_and_never_enroll_recipients() {
    let f = seed().await;
    let input = request("share", "viewer", Value::Null);
    for actor in ["bob", "admin", "eve"] {
        assert_eq!(grant(&f, actor, input.clone()).await.status(), 404);
    }
    let mut bad = input.clone();
    bad.as_object_mut().unwrap().remove("expected_role");
    assert_eq!(grant(&f, "alice", bad).await.status(), 400);
    for field in ["actor", "tenant", "expected_revision"] {
        let mut bad = input.clone();
        bad[field] = json!("spoofed");
        assert_eq!(grant(&f, "alice", bad).await.status(), 400);
    }
    assert_eq!(
        grant(&f, "alice", request("owner", "owner", Value::Null))
            .await
            .status(),
        400
    );
    let mut outsider = input.clone();
    outsider["user"] = json!("eve");
    assert_eq!(grant(&f, "alice", outsider).await.status(), 404);
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.members WHERE user_id='eve'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.enrolled WHERE user_id='eve'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    f.docs
        .set_organization_member(&token("admin"), "default", "bob", None)
        .await
        .unwrap();
    assert_eq!(grant(&f, "alice", input).await.status(), 404);
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.members WHERE user_id='bob'",
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
async fn drive_grants_concurrency_and_audit_failure_are_atomic_and_disabled_accounts_can_be_revoked()
 {
    let f = seed().await;
    let input = request("share", "viewer", Value::Null);
    f.sql("CREATE FUNCTION reject_grant_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$; CREATE TRIGGER reject_grant_audit BEFORE INSERT ON aether_access.audit FOR EACH ROW EXECUTE FUNCTION reject_grant_audit()").await;
    assert!(
        !grant(&f, "alice", input.clone())
            .await
            .status()
            .is_success()
    );
    let c = f.pool.get().await.unwrap();
    for table in ["grants", "grant_provenance", "resource_receipts"] {
        assert_eq!(
            c.query_one(&format!("SELECT count(*) FROM aether_access.{table}"), &[])
                .await
                .unwrap()
                .get::<_, i64>(0),
            0
        );
    }
    f.sql("DROP TRIGGER reject_grant_audit ON aether_access.audit")
        .await;
    let (a, b) = tokio::join!(grant(&f, "alice", input.clone()), grant(&f, "alice", input));
    assert_eq!(a.status(), 200);
    assert_eq!(b.status(), 200);
    let a: Value = a.json().await.unwrap();
    let b: Value = b.json().await.unwrap();
    assert_ne!(a["replayed"], b["replayed"]);
    f.sql("UPDATE aether_identity.users SET active=false WHERE id='bob'")
        .await;
    assert_eq!(
        grant(&f, "alice", request("edit", "editor", json!("viewer")))
            .await
            .status(),
        404
    );
    assert_eq!(
        grant(&f, "alice", request("revoke", "remove", json!("viewer")))
            .await
            .status(),
        200
    );
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.grants", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_grants_waiting_request_observes_membership_revocation() {
    let f = seed().await;
    let mut c = f.pool.get().await.unwrap();
    let tx = c.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062604))",
        &[],
    )
    .await
    .unwrap();
    tx.execute("DELETE FROM aether_access.members WHERE tenant='company' AND organization='default' AND user_id='alice'",&[]).await.unwrap();
    let req = f
        .client
        .post(format!("{}/api/drive/grant", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .json(&request("queued", "viewer", Value::Null));
    let pending = tokio::spawn(async move { req.send().await.unwrap() });
    f.waiting("1095062604").await;
    tx.commit().await.unwrap();
    assert_eq!(pending.await.unwrap().status(), 404);
    for table in ["grants", "grant_provenance", "resource_receipts"] {
        assert_eq!(
            c.query_one(&format!("SELECT count(*) FROM aether_access.{table}"), &[])
                .await
                .unwrap()
                .get::<_, i64>(0),
            0
        );
    }
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn drive_operations_explicitly_override_deployment_transaction_defaults() {
    let f = seed().await;
    let mut connections = Vec::new();
    for _ in 0..16 {
        let c = f.pool.get().await.unwrap();
        c.batch_execute("SET default_transaction_isolation='serializable'")
            .await
            .unwrap();
        connections.push(c);
    }
    drop(connections);
    let input = serde_json::from_value(
        json!({"operation_id":"isolation-create","name":"Isolated.txt","data_base64":"SGk="}),
    )
    .unwrap();
    let created = f.docs.drive_create(&token("alice"), &input).await.unwrap();
    let rename=serde_json::from_value(json!({"operation_id":"isolation-rename","id":created["id"],"kind":"file","name":"Renamed.txt","expected_revision":1})).unwrap();
    let renamed = f
        .docs
        .drive_rename_file(&token("alice"), &rename)
        .await
        .unwrap();
    assert_eq!(renamed["revision"], 2);
    let activity = serde_json::from_value(json!({})).unwrap();
    let events = f
        .docs
        .drive_activity(&token("alice"), &activity)
        .await
        .unwrap();
    assert!(!events["events"].as_array().unwrap().is_empty());
    let grant = serde_json::from_value(request("isolation-share", "viewer", Value::Null)).unwrap();
    let shared = f.docs.drive_grant(&token("alice"), &grant).await.unwrap();
    assert_eq!(shared["role"], "viewer");
}
