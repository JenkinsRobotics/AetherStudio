//! Status uses actual identity and ACL rows, with no lazy enrollment or writes.
use super::*;
async fn status(f: &Fixture, user: Option<&str>) -> Value {
    let mut request = f.client.get(format!("{}/api/status", f.url));
    if let Some(user) = user {
        request = request.header("cookie", format!("{COOKIE}={}", token(user)));
    }
    let response = request.send().await.unwrap();
    assert_eq!(response.status(), 200);
    assert_eq!(response.headers()["cache-control"], "no-store");
    assert!(response.headers().get("set-cookie").is_none());
    response.json().await.unwrap()
}
fn ids(value: &Value) -> Vec<&str> {
    value["apps"]
        .as_array()
        .unwrap()
        .iter()
        .map(|a| a["id"].as_str().unwrap())
        .collect()
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn status_contract_is_readonly_and_does_not_claim_frontend_readiness() {
    let f = Fixture::new().await;
    let anonymous = status(&f, None).await;
    assert_eq!(anonymous["ready"], true);
    assert!(anonymous["user"].is_null());
    assert!(ids(&anonymous).is_empty());
    assert!(anonymous["installation"].is_null());
    assert_eq!(anonymous["email_recovery_available"], false);
    let value = status(&f, Some("alice")).await;
    assert_eq!(value["name"], "Aether Studio");
    assert_eq!(value["theme"], json!({"base":"aether-default","apps":{}}));
    assert_eq!(value["user"]["id"], "alice");
    assert_eq!(value["user"]["username"], "alice");
    assert_eq!(value["applications_ready"], false);
    assert_eq!(value["capabilities"]["document_changes"], 1);
    assert_eq!(ids(&value), ["drive", "map"]);
    for app in value["apps"].as_array().unwrap() {
        assert_eq!(app["installed"], false);
        assert_eq!(app["coming_soon"], false);
        assert_eq!(app["runtime_ready"], false);
        assert!(
            app["runtime_missing"]
                .as_array()
                .unwrap()
                .contains(&json!("frontend"))
        );
        assert_eq!(app["enabled"], true);
        assert!(app["url"].as_str().unwrap().starts_with('/'));
    }
    for secret in [
        "password",
        "token_hash",
        "data_directory",
        "connection_string",
    ] {
        assert!(!value.to_string().contains(secret));
    }
    let c = f.pool.get().await.unwrap();
    let enrolled: i64 = c
        .query_one(
            "SELECT count(*) FROM aether_access.members WHERE user_id='alice'",
            &[],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(enrolled, 0);
    let events: i64 = c
        .query_one(
            "SELECT count(*) FROM aether_identity.audit WHERE actor='alice'",
            &[],
        )
        .await
        .unwrap()
        .get(0);
    assert_eq!(events, 0);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn status_catalog_obeys_app_team_admin_and_disable_authority() {
    let f = Fixture::new().await;
    f.docs
        .configure_app(&token("admin"), "map", true, true)
        .await
        .unwrap();
    f.docs
        .configure_app(&token("admin"), "unknown-product", true, false)
        .await
        .unwrap();
    assert_eq!(ids(&status(&f, Some("alice")).await), ["drive"]);
    assert_eq!(ids(&status(&f, Some("admin")).await), ["drive", "map"]);
    f.docs
        .configure_team(
            &token("admin"),
            "design",
            &["alice".into()],
            &["map".into()],
        )
        .await
        .unwrap();
    assert_eq!(ids(&status(&f, Some("alice")).await), ["drive", "map"]);
    assert_eq!(ids(&status(&f, Some("bob")).await), ["drive"]);
    f.docs
        .configure_team(&token("admin"), "design", &[], &["map".into()])
        .await
        .unwrap();
    assert_eq!(ids(&status(&f, Some("alice")).await), ["drive"]);
    f.docs
        .configure_app(&token("admin"), "map", false, false)
        .await
        .unwrap();
    assert_eq!(ids(&status(&f, Some("admin")).await), ["drive"]);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn status_expired_revoked_disabled_and_forced_password_sessions() {
    let f = Fixture::new().await;
    assert!(status(&f, Some("unknown")).await["user"].is_null());
    f.sql("UPDATE aether_identity.sessions SET expires=clock_timestamp()-interval '1 second' WHERE user_id='alice'").await;
    assert!(status(&f, Some("alice")).await["user"].is_null());
    f.identity.sign_out(&token("bob")).await.unwrap();
    assert!(status(&f, Some("bob")).await["user"].is_null());
    f.sql("UPDATE aether_identity.users SET active=false WHERE id='eve'")
        .await;
    let inactive = status(&f, Some("eve")).await;
    assert!(inactive["user"].is_null());
    assert_eq!(inactive["ready"], true);
    f.sql("UPDATE aether_identity.users SET must_change=true WHERE id='admin'")
        .await;
    let forced = status(&f, Some("admin")).await;
    assert_eq!(forced["user"]["id"], "admin");
    assert_eq!(forced["user"]["must_change"], true);
    assert!(ids(&forced).is_empty());
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn status_rejects_malformed_cookies_but_allows_anonymous_legacy_cookie() {
    let f = Fixture::new().await;
    for cookie in [
        COOKIE.to_owned(),
        format!("{COOKIE}=short"),
        format!("{COOKIE}={}; {COOKIE}={}", token("alice"), token("alice")),
        format!("{COOKIE}={}", "g".repeat(64)),
        "x".repeat(8193),
    ] {
        let r = f
            .client
            .get(format!("{}/api/status", f.url))
            .header("cookie", cookie)
            .send()
            .await
            .unwrap();
        assert_eq!(r.status(), 401);
    }
    let r = f
        .client
        .get(format!("{}/api/status", f.url))
        .header("cookie", format!("{COOKIE}={}", token("alice")))
        .header("cookie", "legacy=old")
        .send()
        .await
        .unwrap();
    assert_eq!(r.status(), 401);
    let r = f
        .client
        .get(format!("{}/api/status", f.url))
        .header("cookie", "aether_session=old")
        .send()
        .await
        .unwrap();
    assert_eq!(r.status(), 200);
    assert!(r.json::<Value>().await.unwrap()["user"].is_null());
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn status_identity_only_empty_tenant_and_operator_presentation() {
    let f = Fixture::new().await;
    let identity = Identity::new(f.pool.clone(), "other-company", 1).unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("presentation.json");
    std::fs::write(&path,r#"{"schema":1,"name":"Workshop","theme":{"base":"aether-dark","apps":{"map":"aether-light"}}}"#).unwrap();
    let config = aether_server::native::presentation::Presentation::load(&path).unwrap();
    let host = NativeHost::new(identity, &url, 4, Duration::from_secs(10))
        .unwrap()
        .with_presentation(config);
    let task = tokio::spawn(async move {
        axum::serve(
            listener,
            router(host).into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        .unwrap();
    });
    let request = || {
        f.client
            .get(format!("{url}/api/status"))
            .header("cookie", format!("{COOKIE}={}", token("admin")))
    };
    let first = request()
        .send()
        .await
        .unwrap()
        .json::<Value>()
        .await
        .unwrap();
    assert_eq!(first["ready"], false);
    assert_eq!(first["name"], "Workshop");
    assert_eq!(first["theme"]["apps"]["map"], "aether-light");
    assert!(first["user"].is_null());
    assert!(first["installation"].is_null());
    f.sql("INSERT INTO aether_identity.users(tenant,id,username,password,role,active) VALUES('other-company','owner','owner','fixture','admin',false)").await;
    let second = request()
        .send()
        .await
        .unwrap()
        .json::<Value>()
        .await
        .unwrap();
    assert_eq!(second["ready"], true); // disabled accounts do not reopen bootstrap
    assert!(ids(&second).is_empty());
    task.abort();
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn status_database_failure_never_becomes_false_setup_or_anonymous_success() {
    let f = Fixture::new().await;
    f.sql("ALTER TABLE aether_identity.users RENAME TO unavailable_users")
        .await;
    let r = f
        .client
        .get(format!("{}/api/status", f.url))
        .send()
        .await
        .unwrap();
    assert_eq!(r.status(), 503);
    let value = r.json::<Value>().await.unwrap();
    assert!(value.get("ready").is_none());
    assert!(!value.to_string().contains("unavailable_users"));
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn status_waits_for_committed_acl_and_identity_changes() {
    let f = Fixture::new().await;
    let mut c = f.pool.get().await.unwrap();
    let tx = c.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062604))",
        &[],
    )
    .await
    .unwrap();
    tx.execute(
        "UPDATE aether_access.applications SET enabled=false WHERE tenant='company' AND id='map'",
        &[],
    )
    .await
    .unwrap();
    let request = f
        .client
        .get(format!("{}/api/status", f.url))
        .header("cookie", format!("{COOKIE}={}", token("alice")));
    let pending = tokio::spawn(async move { request.send().await.unwrap() });
    f.waiting("1095062604").await;
    tx.commit().await.unwrap();
    let value = pending.await.unwrap().json::<Value>().await.unwrap();
    assert_eq!(ids(&value), ["drive"]);
    let tx = c.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062603))",
        &[],
    )
    .await
    .unwrap();
    tx.execute(
        "UPDATE aether_identity.users SET active=false WHERE tenant='company' AND id='alice'",
        &[],
    )
    .await
    .unwrap();
    let request = f
        .client
        .get(format!("{}/api/status", f.url))
        .header("cookie", format!("{COOKIE}={}", token("alice")));
    let pending = tokio::spawn(async move { request.send().await.unwrap() });
    f.waiting("1095062603").await;
    tx.commit().await.unwrap();
    let value = pending.await.unwrap().json::<Value>().await.unwrap();
    assert!(value["user"].is_null());
    assert!(ids(&value).is_empty());
}
