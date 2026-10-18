use super::*;
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
fn secret(n: u8) -> String {
    URL_SAFE_NO_PAD.encode([n; 32])
}
async fn call(f: &Fixture, actor: &str, action: &str, input: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/drive/{action}", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(actor)))
        .json(&input)
        .send()
        .await
        .unwrap()
}
fn issue(op: &str, n: u8) -> Value {
    json!({"id":"drawing","role":"viewer","days":7,"token":secret(n),"operation_id":op})
}
async fn seed() -> Fixture {
    let f = Fixture::new().await;
    f.docs
        .mutate(&token("alice"), &create("drawing"))
        .await
        .unwrap();
    f.docs
        .set_organization_member(&token("admin"), "default", "bob", Some("member"))
        .await
        .unwrap();
    f
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn links_retry_redemption_revocation_and_expiry_never_become_permanent_grants() {
    let f = seed().await;
    let request = issue("issue", 1);
    let r = call(&f, "alice", "link_create", request.clone()).await;
    assert_eq!(r.status(), 200);
    let first: Value = r.json().await.unwrap();
    assert_eq!(first["url"], format!("/drive/?share={}", secret(1)));
    assert_eq!(first["active"], true);
    assert!(f.docs.read(&token("bob"), "drawing", None).await.is_err());
    for _ in 0..2 {
        let r = call(&f, "bob", "redeem", json!({"token":secret(1)})).await;
        assert_eq!(r.status(), 200);
        assert_eq!(r.json::<Value>().await.unwrap()["role"], "viewer");
    }
    assert!(f.docs.read(&token("bob"), "drawing", None).await.is_ok());
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.link_visits", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        1
    );
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.grants", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
    let replay: Value = call(&f, "alice", "link_create", request.clone())
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(replay["id"], first["id"]);
    assert_eq!(replay["expires"], first["expires"]);
    assert_eq!(replay["replayed"], true);
    let revoke = json!({"id":"drawing","link":first["id"],"operation_id":"revoke"});
    for _ in 0..2 {
        assert_eq!(
            call(&f, "alice", "link_revoke", revoke.clone())
                .await
                .status(),
            200
        );
    }
    assert!(f.docs.read(&token("bob"), "drawing", None).await.is_err());
    assert_eq!(
        call(&f, "bob", "redeem", json!({"token":secret(1)}))
            .await
            .status(),
        404
    );
    let replay: Value = call(&f, "alice", "link_create", request)
        .await
        .json()
        .await
        .unwrap();
    assert_eq!(replay["active"], false);
    assert_eq!(replay["revoked"], true);
    assert_eq!(
        call(&f, "alice", "link_create", issue("issue", 2))
            .await
            .status(),
        409
    );
    assert_eq!(
        call(&f, "alice", "link_create", issue("second", 1))
            .await
            .status(),
        409
    );
    assert_eq!(
        call(&f, "alice", "link_create", issue("second", 2))
            .await
            .status(),
        200
    );
    assert_eq!(
        call(&f, "bob", "redeem", json!({"token":secret(2)}))
            .await
            .status(),
        200
    );
    f.sql("UPDATE aether_access.links SET expires=clock_timestamp()-interval '1 second'")
        .await;
    assert!(f.docs.read(&token("bob"), "drawing", None).await.is_err());
    assert_eq!(
        call(&f, "bob", "redeem", json!({"token":secret(2)}))
            .await
            .status(),
        404
    );
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.audit WHERE action='link_create'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        2
    );
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.audit WHERE action='link_revoke'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        1
    );
    for table in ["link_credentials", "resource_receipts", "audit"] {
        let raw: String = c
            .query_one(
                &format!("SELECT coalesce(json_agg(t)::text,'') FROM aether_access.{table} t"),
                &[],
            )
            .await
            .unwrap()
            .get(0);
        assert!(!raw.contains(&secret(1)));
        assert!(!raw.contains(&secret(2)));
    }
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn links_require_current_organization_apps_and_owner_without_enrollment() {
    let f = seed().await;
    for user in ["admin", "bob", "eve"] {
        assert_eq!(
            call(&f, user, "link_create", issue("forbidden", 3))
                .await
                .status(),
            404
        );
    }
    assert_eq!(
        call(&f, "alice", "link_create", issue("issue", 3))
            .await
            .status(),
        200
    );
    assert_eq!(
        call(&f, "eve", "redeem", json!({"token":secret(3)}))
            .await
            .status(),
        404
    );
    let c = f.pool.get().await.unwrap();
    for table in ["enrolled", "members", "link_visits"] {
        assert_eq!(
            c.query_one(
                &format!("SELECT count(*) FROM aether_access.{table} WHERE user_id='eve'"),
                &[]
            )
            .await
            .unwrap()
            .get::<_, i64>(0),
            0
        );
    }
    assert_eq!(
        call(&f, "bob", "redeem", json!({"token":secret(3)}))
            .await
            .status(),
        200
    );
    f.docs
        .set_organization_member(&token("admin"), "default", "bob", None)
        .await
        .unwrap();
    assert!(f.docs.read(&token("bob"), "drawing", None).await.is_err());
    assert_eq!(
        call(&f, "bob", "redeem", json!({"token":secret(3)}))
            .await
            .status(),
        404
    );
    f.docs
        .set_organization_member(&token("admin"), "default", "bob", Some("member"))
        .await
        .unwrap();
    assert!(f.docs.read(&token("bob"), "drawing", None).await.is_err());
    f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert_eq!(
        call(&f, "bob", "redeem", json!({"token":secret(3)}))
            .await
            .status(),
        404
    );
    assert_eq!(
        call(&f, "alice", "link_create", issue("issue", 3))
            .await
            .status(),
        404
    );
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.link_visits", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn links_validate_strictly_and_rollback_audit_and_visit_failures() {
    let f = seed().await;
    for (field, value) in [
        ("days", json!(0)),
        ("days", json!(366)),
        ("days", json!(1.5)),
        ("role", json!("owner")),
        ("token", json!("weak")),
        ("actor", json!("alice")),
    ] {
        let mut input = issue("invalid", 4);
        input[field] = value;
        assert_eq!(call(&f, "alice", "link_create", input).await.status(), 400);
    }
    f.sql("CREATE FUNCTION reject_link_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$; CREATE TRIGGER reject_link_audit BEFORE INSERT ON aether_access.audit FOR EACH ROW EXECUTE FUNCTION reject_link_audit()").await;
    assert!(
        !call(&f, "alice", "link_create", issue("issue", 4))
            .await
            .status()
            .is_success()
    );
    let c = f.pool.get().await.unwrap();
    for table in ["links", "link_credentials", "resource_receipts"] {
        assert_eq!(
            c.query_one(&format!("SELECT count(*) FROM aether_access.{table}"), &[])
                .await
                .unwrap()
                .get::<_, i64>(0),
            0
        );
    }
    f.sql("DROP TRIGGER reject_link_audit ON aether_access.audit")
        .await;
    let (a, b) = tokio::join!(
        call(&f, "alice", "link_create", issue("issue", 4)),
        call(&f, "alice", "link_create", issue("issue", 4))
    );
    assert_eq!(a.status(), 200);
    assert_eq!(b.status(), 200);
    let a: Value = a.json().await.unwrap();
    let b: Value = b.json().await.unwrap();
    assert_eq!(a["id"], b["id"]);
    assert_ne!(a["replayed"], b["replayed"]);
    f.sql("UPDATE aether_access.resources SET trashed=true WHERE id='drawing'")
        .await;
    assert_eq!(
        call(&f, "bob", "redeem", json!({"token":secret(4)}))
            .await
            .status(),
        404
    );
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.link_visits", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn links_waiting_redemption_observes_revocation_and_wrong_resource_cannot_revoke() {
    let f = seed().await;
    let issued: Value = call(&f, "alice", "link_create", issue("issue", 5))
        .await
        .json()
        .await
        .unwrap();
    f.docs
        .mutate(&token("alice"), &create("other"))
        .await
        .unwrap();
    assert_eq!(
        call(
            &f,
            "alice",
            "link_revoke",
            json!({"id":"other","link":issued["id"],"operation_id":"wrong"})
        )
        .await
        .status(),
        404
    );
    let mut c = f.pool.get().await.unwrap();
    let tx = c.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062604))",
        &[],
    )
    .await
    .unwrap();
    tx.execute("UPDATE aether_access.links SET revoked=true", &[])
        .await
        .unwrap();
    let req = f
        .client
        .post(format!("{}/api/drive/redeem", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token("bob")))
        .json(&json!({"token":secret(5)}));
    let pending = tokio::spawn(async move { req.send().await.unwrap() });
    f.waiting("1095062604").await;
    tx.commit().await.unwrap();
    assert_eq!(pending.await.unwrap().status(), 404);
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_access.link_visits", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn links_schema_upgrade_failure_is_atomic_and_preserves_existing_links() {
    let f = seed().await;
    f.access_before_branch_metadata().await;
    f.sql("DROP TABLE aether_access.link_credentials").await;
    let mut sha = Sha256::new();
    for path in [
        "schema.sql",
        "002-directory.sql",
        "003-folders.sql",
        "004-resource-lifecycle.sql",
        "005-library-recents.sql",
        "006-legacy-history.sql",
        "007-named-versions.sql",
        "008-collaboration.sql",
        "009-workspace-preferences.sql",
        "010-legacy-file-metadata.sql",
        "011-file-favorites.sql",
        "012-sharing-provenance.sql",
        "013-legacy-drive-events.sql",
        "014-uploads.sql",
    ] {
        sha.update(
            std::fs::read(format!(
                "{}/src/documents/{path}",
                env!("CARGO_MANIFEST_DIR")
            ))
            .unwrap(),
        );
    }
    let checksum = format!("{:x}", sha.finalize());
    let c = f.pool.get().await.unwrap();
    c.execute(
        "UPDATE aether_access.schema_state SET version=14,checksum=$1",
        &[&checksum],
    )
    .await
    .unwrap();
    f.sql("INSERT INTO aether_access.links VALUES('company','retained','drawing','viewer',clock_timestamp()+interval '1 day',false); CREATE TABLE aether_access.link_credentials(blocker integer)").await;
    assert!(f.docs.check_schema().await.is_err());
    assert!(f.docs.migrate().await.is_err());
    assert_eq!(
        c.query_one("SELECT version FROM aether_access.schema_state", &[])
            .await
            .unwrap()
            .get::<_, i32>(0),
        14
    );
    f.sql("DROP TABLE aether_access.link_credentials").await;
    f.docs.migrate().await.unwrap();
    f.docs.check_schema().await.unwrap();
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.links WHERE id='retained'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        1
    );
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_store.revisions", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        1
    );
}
