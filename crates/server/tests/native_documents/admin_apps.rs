use super::*;
async fn toggle(f: &Fixture, user: &str, data: Value) -> reqwest::Response {
    f.client
        .post(format!("{}/api/admin/apps", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(user)))
        .json(&data)
        .send()
        .await
        .unwrap()
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn admin_toggle_preserves_restrictions_checks_current_authority_and_audits_once() {
    let f = Fixture::new().await;
    f.docs
        .configure_app(&token("admin"), "map", true, true)
        .await
        .unwrap();
    let off = json!({"id":"map","enabled":false});
    assert_eq!(toggle(&f, "alice", off.clone()).await.status(), 403);
    assert_eq!(
        toggle(&f, "admin", json!({"id":"unknown","enabled":false}))
            .await
            .status(),
        400
    );
    assert_eq!(
        toggle(&f, "admin", json!({"id":"map","enabled":0}))
            .await
            .status(),
        400
    );
    assert_eq!(toggle(&f, "admin", off.clone()).await.status(), 200);
    assert_eq!(toggle(&f, "admin", off).await.status(), 200);
    let row=f.pool.get().await.unwrap().query_one("SELECT enabled,restricted FROM aether_access.applications WHERE tenant='company' AND id='map'",&[]).await.unwrap();
    assert!(!row.get::<_, bool>(0));
    assert!(row.get::<_, bool>(1));
    assert_eq!(f.pool.get().await.unwrap().query_one("SELECT count(*) FROM aether_access.audit WHERE tenant='company' AND action='app_disabled'",&[]).await.unwrap().get::<_,i64>(0),1);
    assert_eq!(
        toggle(&f, "admin", json!({"id":"map","enabled":true}))
            .await
            .status(),
        200
    );
    assert!(
        f.docs
            .application_status(Some(&token("alice")), &["map"])
            .await
            .unwrap()
            .1
            .is_empty()
    );
    f.sql("UPDATE aether_identity.users SET must_change=true WHERE id='admin'")
        .await;
    assert_eq!(
        toggle(&f, "admin", json!({"id":"map","enabled":false}))
            .await
            .status(),
        403
    );
    f.sql("UPDATE aether_identity.users SET must_change=false,role='member' WHERE id='admin'")
        .await;
    assert_eq!(
        toggle(&f, "admin", json!({"id":"map","enabled":false}))
            .await
            .status(),
        403
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn ui_enablement_remains_admin_only_and_audit_failure_rolls_back() {
    let f = Fixture::new().await;
    f.sql("INSERT INTO aether_access.applications VALUES('company','ui',false,false)")
        .await;
    assert_eq!(
        toggle(&f, "admin", json!({"id":"ui","enabled":true}))
            .await
            .status(),
        200
    );
    for (user, visible) in [("admin", true), ("alice", false)] {
        let result = f
            .client
            .get(format!("{}/api/status", f.url))
            .header("cookie", format!("{COOKIE}={}", token(user)))
            .send()
            .await
            .unwrap()
            .json::<Value>()
            .await
            .unwrap();
        assert_eq!(
            result["apps"]
                .as_array()
                .unwrap()
                .iter()
                .any(|app| app["id"] == "ui"),
            visible
        );
    }
    f.sql("CREATE FUNCTION reject_app_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$; CREATE TRIGGER reject_app_change BEFORE INSERT ON aether_access.audit FOR EACH ROW EXECUTE FUNCTION reject_app_audit()").await;
    assert_eq!(
        toggle(&f, "admin", json!({"id":"ui","enabled":false}))
            .await
            .status(),
        503
    );
    assert!(
        f.pool
            .get()
            .await
            .unwrap()
            .query_one(
                "SELECT enabled FROM aether_access.applications WHERE tenant='company' AND id='ui'",
                &[]
            )
            .await
            .unwrap()
            .get::<_, bool>(0)
    );
}
