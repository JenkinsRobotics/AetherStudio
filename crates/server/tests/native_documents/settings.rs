use super::*;
use aether_server::{
    native::presentation::Presentation,
    settings::{Change, Settings},
};

fn presentation(name: &str) -> Value {
    json!({"schema":1,"name":name,"theme":{"base":"aether-light","apps":{"map":"aether-dark"}}})
}
fn change(revision: i64, name: &str) -> Change {
    serde_json::from_value(json!({"expected_revision":revision,"presentation":presentation(name)}))
        .unwrap()
}
async fn fixture() -> (Fixture, Settings) {
    let mut f = Fixture::new().await;
    let settings = Settings::new(f.pool.clone(), f.identity.clone());
    assert!(settings.check_schema().await.is_err());
    settings.migrate(&Presentation::default()).await.unwrap();
    settings.check_schema().await.unwrap();
    f.task.abort();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    f.url = format!("http://{}", listener.local_addr().unwrap());
    let host = NativeHost::new(f.identity.clone(), &f.url, 64, Duration::from_secs(30))
        .unwrap()
        .with_documents(f.docs.clone())
        .with_settings(settings.clone());
    f.task = tokio::spawn(async move {
        axum::serve(
            listener,
            router(host).into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        .unwrap();
    });
    (f, settings)
}
async fn post(f: &Fixture, who: &str, path: &str, value: Value) -> reqwest::Response {
    f.client
        .post(format!("{}{path}", f.url))
        .header("origin", &f.url)
        .header("cookie", format!("{COOKIE}={}", token(who)))
        .json(&value)
        .send()
        .await
        .unwrap()
}
async fn status(f: &Fixture) -> Value {
    let r = f
        .client
        .get(format!("{}/api/status", f.url))
        .send()
        .await
        .unwrap();
    assert_eq!(r.status(), 200);
    r.json().await.unwrap()
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn settings_roundtrip_legacy_theme_public_status_and_restart() {
    let (f, s) = fixture().await;
    assert_eq!(status(&f).await["name"], "Aether Studio");
    let r = post(
        &f,
        "admin",
        "/api/v1/server/presentation",
        json!({"expected_revision":1,"presentation":presentation("Workshop")}),
    )
    .await;
    assert_eq!(r.status(), 200);
    let value: Value = r.json().await.unwrap();
    assert_eq!(value["settings"]["revision"], 2);
    assert_eq!(value["restart_required"], false);
    assert_eq!(status(&f).await["name"], "Workshop");
    assert_eq!(
        post(
            &f,
            "admin",
            "/api/admin/theme",
            json!({"base":"aether-default","apps":{}})
        )
        .await
        .status(),
        200
    );
    let value = status(&f).await;
    assert_eq!(value["name"], "Workshop");
    assert_eq!(value["theme"], json!({"base":"aether-default","apps":{}}));
    assert_eq!(value["capabilities"]["server_presentation"], true);
    assert_eq!(value["capabilities"]["server_settings"], false);
    let reopened = Settings::new(f.pool.clone(), f.identity.clone());
    // Repeated migrations and different operator seed never overwrite saved data.
    reopened
        .migrate(&serde_json::from_value(presentation("Other seed")).unwrap())
        .await
        .unwrap();
    assert_eq!(
        serde_json::to_value(reopened.snapshot().await.unwrap()).unwrap(),
        serde_json::to_value(s.snapshot().await.unwrap()).unwrap()
    );
    assert_eq!(reopened.snapshot().await.unwrap().revision, 3);
    let audit = f
        .pool
        .get()
        .await
        .unwrap()
        .query(
            "SELECT actor,action FROM aether_settings.audit ORDER BY revision",
            &[],
        )
        .await
        .unwrap();
    assert_eq!(audit.len(), 2);
    assert_eq!(audit[0].get::<_, String>(0), "admin");
    assert_eq!(audit[1].get::<_, String>(1), "theme_updated");
    assert_eq!(
        post(
            &f,
            "admin",
            "/api/admin/theme",
            json!({"base":" aether-dark ","apps":{"map":" "}})
        )
        .await
        .status(),
        200
    );
    assert_eq!(
        status(&f).await["theme"],
        json!({"base":"aether-dark","apps":{}})
    );
    assert_eq!(
        post(
            &f,
            "admin",
            "/api/admin/theme",
            json!({"base":"aether-default"})
        )
        .await
        .status(),
        200
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn settings_current_admin_only_and_strict_input() {
    let (f, s) = fixture().await;
    let endpoint = "/api/v1/server/presentation";
    for (who, expected) in [("alice", 403), ("missing", 401)] {
        assert_eq!(
            post(
                &f,
                who,
                endpoint,
                json!({"expected_revision":1,"presentation":presentation("Company")})
            )
            .await
            .status(),
            expected
        );
        assert_eq!(
            f.client
                .get(format!("{}{endpoint}", f.url))
                .header("cookie", format!("{COOKIE}={}", token(who)))
                .send()
                .await
                .unwrap()
                .status(),
            expected
        );
        assert_eq!(
            post(
                &f,
                who,
                "/api/admin/theme",
                json!({"base":"aether-default","apps":{}})
            )
            .await
            .status(),
            expected
        );
    }
    for bad in [
        json!({"name":""}),
        json!({"name":"x".repeat(81)}),
        json!({"name":"line\nbreak"}),
        json!({"schema":2}),
        json!({"bind_address":"0.0.0.0"}),
        json!({"theme":{"base":"https://elsewhere.test","apps":{}}}),
        json!({"theme":{"base":"aether-default","apps":{"unknown":"dark"}}}),
    ] {
        let mut p = presentation("Company");
        for (k, v) in bad.as_object().unwrap() {
            p[k] = v.clone();
        }
        assert_eq!(
            post(
                &f,
                "admin",
                endpoint,
                json!({"expected_revision":1,"presentation":p})
            )
            .await
            .status(),
            400
        );
    }
    assert_eq!(
        post(
            &f,
            "admin",
            endpoint,
            json!({"expected_revision":1,"presentation":null})
        )
        .await
        .status(),
        400
    );
    assert_eq!(
        post(
            &f,
            "admin",
            endpoint,
            json!({"expected_revision":1,"presentation":presentation(&"x".repeat(20000))})
        )
        .await
        .status(),
        413
    );
    assert_eq!(
        f.client
            .post(format!("{}{endpoint}", f.url))
            .header("origin", "https://elsewhere.test")
            .header("cookie", format!("{COOKIE}={}", token("admin")))
            .json(&json!({"expected_revision":1,"presentation":presentation("Company")}))
            .send()
            .await
            .unwrap()
            .status(),
        403
    );
    f.sql("UPDATE aether_identity.users SET must_change=true WHERE id='admin'")
        .await;
    assert_eq!(
        post(
            &f,
            "admin",
            "/api/admin/theme",
            json!({"base":"aether-default","apps":{}})
        )
        .await
        .status(),
        403
    );
    f.sql("UPDATE aether_identity.users SET must_change=false,role='member' WHERE id='admin'")
        .await;
    assert!(s.change(&token("admin"), &change(1, "No")).await.is_err());
    f.sql("UPDATE aether_identity.users SET role='admin',active=false WHERE id='admin'")
        .await;
    assert_eq!(
        post(
            &f,
            "admin",
            "/api/admin/theme",
            json!({"base":"aether-default","apps":{}})
        )
        .await
        .status(),
        401
    );
    assert_eq!(s.snapshot().await.unwrap().revision, 1);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn settings_concurrent_guard_and_audit_rollback() {
    let (f, s) = fixture().await;
    let a = change(1, "First");
    let b = change(1, "Second");
    let session = token("admin");
    let (a, b) = tokio::join!(s.change(&session, &a), s.change(&session, &b));
    assert_eq!(usize::from(a.is_ok()) + usize::from(b.is_ok()), 1);
    let failure = match (a, b) {
        (Err(error), Ok(_)) | (Ok(_), Err(error)) => error,
        _ => panic!("Exactly one guarded save must succeed"),
    };
    assert!(matches!(failure, aether_server::settings::Error::Conflict));
    let before = serde_json::to_value(s.snapshot().await.unwrap()).unwrap();
    f.sql("ALTER TABLE aether_settings.audit ADD CONSTRAINT reject_write CHECK(false) NOT VALID")
        .await;
    assert!(
        s.change(&token("admin"), &change(2, "Failed"))
            .await
            .is_err()
    );
    assert_eq!(
        serde_json::to_value(s.snapshot().await.unwrap()).unwrap(),
        before
    );
    assert_eq!(
        post(
            &f,
            "admin",
            "/api/v1/server/presentation",
            json!({"expected_revision":1,"presentation":presentation("Stale")})
        )
        .await
        .status(),
        409
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn settings_waiting_write_observes_committed_revocation() {
    let (f, s) = fixture().await;
    let mut c = f.pool.get().await.unwrap();
    let tx = c.transaction().await.unwrap();
    tx.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('company',1095062603))",
        &[],
    )
    .await
    .unwrap();
    let pending =
        tokio::spawn(async move { s.change(&token("admin"), &change(1, "Denied")).await });
    f.waiting("pg_advisory_xact_lock_shared(hashtextextended($1,1095062603))")
        .await;
    tx.execute(
        "DELETE FROM aether_identity.sessions WHERE tenant='company' AND user_id='admin'",
        &[],
    )
    .await
    .unwrap();
    tx.commit().await.unwrap();
    assert!(matches!(
        pending.await.unwrap(),
        Err(aether_server::settings::Error::Identity(
            aether_identity::Error::Unauthorized
        ))
    ));
    assert_eq!(status(&f).await["name"], "Aether Studio");
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn settings_tenant_isolation_and_corrupt_schema_refusal() {
    let (f, s) = fixture().await;
    f.sql("INSERT INTO aether_identity.users SELECT 'other',id,username,password,role,active,must_change,full_name,email,email_verified FROM aether_identity.users; INSERT INTO aether_identity.sessions SELECT 'other',token_hash,user_id,created,expires FROM aether_identity.sessions").await;
    let other = Settings::new(
        f.pool.clone(),
        Identity::new(f.pool.clone(), "other", 2).unwrap(),
    );
    assert!(other.snapshot().await.is_err());
    other
        .migrate(&serde_json::from_value(presentation("Other company")).unwrap())
        .await
        .unwrap();
    other
        .change(&token("admin"), &change(1, "Other saved"))
        .await
        .unwrap();
    assert_eq!(s.snapshot().await.unwrap().revision, 1);
    assert_eq!(status(&f).await["name"], "Aether Studio");
    f.sql("UPDATE aether_settings.schema_state SET version=999")
        .await;
    assert!(s.check_schema().await.is_err());
    assert!(s.migrate(&Presentation::default()).await.is_err());
    f.sql("UPDATE aether_settings.schema_state SET version=1,checksum='corrupt'")
        .await;
    assert!(s.check_schema().await.is_err());
    f.sql("DROP SCHEMA aether_settings CASCADE").await;
    assert!(s.check_schema().await.is_err());
    // No implicit schema creation from read/status or startup checks.
    assert_eq!(
        f.client
            .get(format!("{}/api/status", f.url))
            .send()
            .await
            .unwrap()
            .status(),
        503
    );
    s.migrate(&Presentation::default()).await.unwrap();
    f.sql("UPDATE aether_settings.presentation SET value='{}'")
        .await;
    assert!(s.check_schema().await.is_err());
    assert!(s.migrate(&Presentation::default()).await.is_err());
}
