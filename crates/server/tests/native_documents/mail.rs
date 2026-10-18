use super::*;
use aether_server::{
    mail::{Configuration, Delivery, Mail, Vault},
    native::presentation::Presentation,
    settings::{Result as MailResult, Settings},
};
use std::{future::Future, pin::Pin, sync::Arc};
use tokio::sync::Mutex;
use zeroize::Zeroizing;
#[derive(Default)]
struct Sink {
    messages: Mutex<Vec<String>>,
}
impl Delivery for Sink {
    fn send<'a>(
        &'a self,
        _: &'a Configuration,
        _: Zeroizing<String>,
        message: lettre::Message,
    ) -> Pin<Box<dyn Future<Output = MailResult<()>> + Send + 'a>> {
        Box::pin(async move {
            self.messages
                .lock()
                .await
                .push(String::from_utf8(message.formatted()).unwrap());
            Ok(())
        })
    }
}
async fn fixture() -> (Fixture, Settings, Vault, tempfile::TempDir, Arc<Sink>) {
    fixture_with_browser(false).await
}
async fn fixture_with_browser(
    browser: bool,
) -> (Fixture, Settings, Vault, tempfile::TempDir, Arc<Sink>) {
    let mut f = Fixture::new().await;
    f.sql("UPDATE aether_identity.users SET email=username || '@example.test',full_name=username")
        .await;
    let settings = Settings::new(f.pool.clone(), f.identity.clone());
    settings.migrate(&Presentation::default()).await.unwrap();
    let dir = tempfile::tempdir().unwrap();
    let vault = Vault::open(&dir.path().join("private-mail"), "company").unwrap();
    let sink = Arc::new(Sink::default());
    f.task.abort();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    f.url = format!("http://{}", listener.local_addr().unwrap());
    let mut host = NativeHost::new(f.identity.clone(), &f.url, 64, Duration::from_secs(30))
        .unwrap()
        .with_settings(settings.clone())
        .with_documents(f.docs.clone())
        .with_mail(Mail::with_delivery(
            settings.clone(),
            vault.clone(),
            sink.clone(),
        ));
    host = host.with_listen_address(listener.local_addr().unwrap());
    if browser {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .canonicalize()
            .unwrap();
        let config = json!({"schema":1,"studio":root.join("studio/dist"),"session":root.join("core/session"),"icons":root.join("core/assets/icons"),"branding":root.join("core/assets/branding/apps"),"apps":{"map":root.join("../Aether-Map/dist")}});
        let manifest = dir.path().join("frontends.json");
        std::fs::write(&manifest, serde_json::to_vec(&config).unwrap()).unwrap();
        host = host
            .with_frontends(aether_server::native::frontends::Frontends::load(&manifest).unwrap());
    }
    f.task = tokio::spawn(async move {
        axum::serve(
            listener,
            router(host).into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        .unwrap();
    });
    (f, settings, vault, dir, sink)
}
async fn post(f: &Fixture, user: &str, path: &str, value: Value) -> reqwest::Response {
    let mut req = f
        .client
        .post(format!("{}{path}", f.url))
        .header("origin", &f.url)
        .json(&value);
    if !user.is_empty() {
        req = req.header("cookie", format!("{COOKIE}={}", token(user)));
    }
    req.send().await.unwrap()
}
async fn read(f: &Fixture, user: &str, path: &str) -> reqwest::Response {
    let mut req = f.client.get(format!("{}{path}", f.url));
    if !user.is_empty() {
        req = req.header("cookie", format!("{COOKIE}={}", token(user)));
    }
    req.send().await.unwrap()
}
fn config() -> Value {
    json!({"enabled":true,"host":"smtp.example.test","port":587,"security":"starttls","username":"sender","sender":"sender@example.test","password":"private-fixture-password"})
}
async fn wait_event(f: &Fixture, event: &str) {
    tokio::time::timeout(Duration::from_secs(10), async {
        loop {
            let events = read(f, "admin", "/api/admin/mail/events")
                .await
                .json::<Value>()
                .await
                .unwrap();
            if events
                .as_array()
                .unwrap()
                .iter()
                .any(|e| e["action"] == event)
            {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .unwrap();
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn mail_settings_require_current_admin_and_never_disclose_credentials() {
    let (f, s, v, dir, _) = fixture().await;
    assert_eq!(read(&f, "", "/api/admin/mail").await.status(), 401);
    assert_eq!(
        post(&f, "alice", "/api/admin/mail", config())
            .await
            .status(),
        403
    );
    assert_eq!(
        post(&f, "admin", "/api/admin/mail", config())
            .await
            .status(),
        200
    );
    let saved = read(&f, "admin", "/api/admin/mail")
        .await
        .json::<Value>()
        .await
        .unwrap();
    assert_eq!(saved["password_set"], true);
    assert!(saved.get("secret_id").is_none());
    assert!(saved.get("password").is_none());
    let raw: Value = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one("SELECT value FROM aether_settings.mail", &[])
        .await
        .unwrap()
        .get(0);
    assert!(!raw.to_string().contains("private-fixture-password"));
    assert_eq!(
        v.get(raw["secret_id"].as_str().unwrap())
            .await
            .unwrap()
            .as_str(),
        "private-fixture-password"
    );
    let mut keep = config();
    keep["password"] = json!("");
    keep["sender"] = json!("other@example.test");
    assert_eq!(
        post(&f, "admin", "/api/admin/mail", keep.clone())
            .await
            .status(),
        200
    );
    keep["host"] = json!("other.example.test");
    assert_eq!(
        post(&f, "admin", "/api/admin/mail", keep).await.status(),
        400
    );
    assert_eq!(s.mail_snapshot().await.unwrap().host, "smtp.example.test");
    let public = read(&f, "", "/api/status")
        .await
        .json::<Value>()
        .await
        .unwrap();
    assert_eq!(public["email_recovery_available"], true);
    f.sql("UPDATE aether_identity.users SET role='member' WHERE id='admin'")
        .await;
    assert_eq!(
        post(&f, "admin", "/api/admin/mail", config())
            .await
            .status(),
        403
    );
    // Existing SQL configuration survives reopen, credentials remain private.
    assert!(
        Vault::open(&dir.path().join("private-mail"), "company")
            .unwrap()
            .get(raw["secret_id"].as_str().unwrap())
            .await
            .is_ok()
    );
    assert_eq!(
        s.mail_snapshot().await.unwrap().sender,
        "other@example.test"
    );
    drop(f);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn recovery_delivers_only_to_account_uses_single_use_token_and_revokes_sessions() {
    let (f, _, _, _dir, sink) = fixture().await;
    assert_eq!(
        post(&f, "admin", "/api/admin/mail", config())
            .await
            .status(),
        200
    );
    let unknown = post(&f, "", "/api/recovery/request", json!({"account":"nobody"}))
        .await
        .json::<Value>()
        .await
        .unwrap();
    let known = post(
        &f,
        "",
        "/api/recovery/request",
        json!({"account":"alice@example.test"}),
    )
    .await
    .json::<Value>()
    .await
    .unwrap();
    assert_eq!(unknown, known);
    assert!(known.get("token").is_none());
    wait_event(&f, "recovery_sent").await;
    let messages = sink.messages.lock().await;
    assert_eq!(messages.len(), 1);
    let message = &messages[0];
    assert!(message.contains("To: alice@example.test"));
    // Lettre quoted-printable may insert soft wrapping; decode fixture body.
    let body = message.split_once("\r\n\r\n").unwrap().1;
    let body = body.replace("=\r\n", "").replace("=3D", "=");
    let reset = body
        .split("#reset=")
        .nth(1)
        .unwrap()
        .chars()
        .take(64)
        .collect::<String>();
    assert_eq!(reset.len(), 64);
    assert!(body.contains(&f.url));
    drop(messages);
    assert!(f.identity.authenticate(&token("alice")).await.is_ok());
    let response = post(
        &f,
        "",
        "/api/recovery/reset",
        json!({"token":reset,"password":"replacement-test-password-2026"}),
    )
    .await;
    assert_eq!(response.status(), 200);
    assert!(
        response.headers()["set-cookie"]
            .to_str()
            .unwrap()
            .contains("Max-Age=0")
    );
    assert!(f.identity.authenticate(&token("alice")).await.is_err());
    wait_event(&f, "password_notice_sent").await;
    assert_eq!(sink.messages.lock().await.len(), 2);
    assert_eq!(
        post(
            &f,
            "",
            "/api/recovery/reset",
            json!({"token":reset,"password":"second-test-password-2026"})
        )
        .await
        .status(),
        400
    );
    assert!(
        f.identity
            .recovery_delivery(&reset)
            .await
            .unwrap()
            .is_none()
    );
    let events = read(&f, "admin", "/api/admin/mail/events")
        .await
        .text()
        .await
        .unwrap();
    assert!(!events.contains(&reset));
    drop(f);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn mail_test_target_throttles_and_invalid_configuration_fail_closed() {
    let (f, _, _, _dir, sink) = fixture().await;
    for (key, value) in [
        ("security", json!("none")),
        ("port", json!(0)),
        ("host", json!("evil\r\nRCPT TO:x")),
        ("sender", json!("wrong\r\nBCC: x@example.test")),
    ] {
        let mut bad = config();
        bad[key] = value;
        assert_eq!(
            post(&f, "admin", "/api/admin/mail", bad).await.status(),
            400
        );
    }
    assert_eq!(
        post(&f, "admin", "/api/admin/mail", config())
            .await
            .status(),
        200
    );
    assert_eq!(
        post(&f, "alice", "/api/admin/mail/test", json!({}))
            .await
            .status(),
        403
    );
    assert_eq!(
        post(
            &f,
            "admin",
            "/api/admin/mail/test",
            json!({"to":"attacker@example.test"})
        )
        .await
        .status(),
        400
    );
    assert_eq!(
        post(&f, "admin", "/api/admin/mail/test", json!({}))
            .await
            .status(),
        200
    );
    wait_event(&f, "mail_test_sent").await;
    assert!(sink.messages.lock().await[0].contains("To: admin@example.test"));
    for _ in 0..5 {
        assert_eq!(
            post(&f, "", "/api/recovery/request", json!({"account":"alice"}))
                .await
                .status(),
            200
        );
    }
    tokio::time::timeout(Duration::from_secs(10), async {
        loop {
            let count: i64 = f
                .pool
                .get()
                .await
                .unwrap()
                .query_one(
                    "SELECT count(*) FROM aether_identity.audit WHERE action='recovery_requested'",
                    &[],
                )
                .await
                .unwrap()
                .get(0);
            if count == 3 {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .unwrap();
    let row = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one(
            "SELECT count FROM aether_identity.attempts WHERE key='recovery:account:alice'",
            &[],
        )
        .await
        .unwrap();
    assert_eq!(row.get::<_, i32>(0), 3);
    drop(f);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn mail_schema_upgrade_and_audit_failure_preserve_previous_settings() {
    let (f, s, _, _dir, _) = fixture().await;
    f.sql("DROP TABLE aether_settings.mail,aether_settings.mail_events,aether_settings.backups,aether_settings.network")
        .await;
    let checksum = format!(
        "{:x}",
        Sha256::digest(include_str!("../../src/settings/schema.sql"))
    );
    f.pool
        .get()
        .await
        .unwrap()
        .execute(
            "UPDATE aether_settings.schema_state SET version=1,checksum=$1",
            &[&checksum],
        )
        .await
        .unwrap();
    assert!(s.check_schema().await.is_err());
    s.migrate(&Presentation::default()).await.unwrap();
    s.check_schema().await.unwrap();
    assert_eq!(
        post(&f, "admin", "/api/admin/mail", config())
            .await
            .status(),
        200
    );
    f.sql("ALTER TABLE aether_settings.mail_events ADD CONSTRAINT fail_test CHECK(action='never') NOT VALID").await;
    let mut changed = config();
    changed["sender"] = json!("changed@example.test");
    assert_eq!(
        post(&f, "admin", "/api/admin/mail", changed).await.status(),
        503
    );
    assert_eq!(
        s.mail_snapshot().await.unwrap().sender,
        "sender@example.test"
    );
    drop(f);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn native_admin_envelope_keeps_disabled_apps_visible_and_real_mail_audit() {
    let (f, _, _, _dir, _) = fixture().await;
    assert_eq!(read(&f, "alice", "/api/admin/state").await.status(), 403);
    assert_eq!(read(&f, "", "/api/admin/state").await.status(), 401);
    assert_eq!(
        post(&f, "admin", "/api/admin/mail", config())
            .await
            .status(),
        200
    );
    assert_eq!(
        post(
            &f,
            "admin",
            "/api/admin/apps",
            json!({"id":"map","enabled":false})
        )
        .await
        .status(),
        200
    );
    let response = read(&f, "admin", "/api/admin/state").await;
    assert_eq!(response.status(), 200);
    let state = response.json::<Value>().await.unwrap();
    assert_eq!(state["runtime"], "rust");
    assert!(state["storage"].is_null());
    assert!(state["backups"].is_null());
    assert_eq!(state["capabilities"]["backups"], false);
    let app = state["applications"]
        .as_array()
        .unwrap()
        .iter()
        .find(|a| a["id"] == "map")
        .unwrap();
    assert_eq!(app["enabled"], false);
    assert!(
        state["audit"]
            .as_array()
            .unwrap()
            .iter()
            .any(|a| a["action"] == "mail_configured")
    );
    assert!(!state.to_string().contains("private-fixture-password"));
    assert!(!state.to_string().contains("secret_id"));
    assert_eq!(
        post(
            &f,
            "admin",
            "/api/admin/apps",
            json!({"id":"map","enabled":true})
        )
        .await
        .status(),
        200
    );
    f.sql("UPDATE aether_identity.users SET active=false WHERE id='admin'")
        .await;
    assert_eq!(read(&f, "admin", "/api/admin/state").await.status(), 401);
}

#[tokio::test]
#[ignore = "disposable PostgreSQL runner and built Studio/Map frontends"]
async fn actual_admin_browser_edits_team_mail_and_reenables_disabled_app() {
    let (f, _, _, _dir, _) = fixture_with_browser(true).await;
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let output = tokio::process::Command::new("node")
        .arg(root.join("dev/rebuild/admin_browser.mjs"))
        .arg(&f.url)
        .arg(token("admin"))
        .kill_on_drop(true)
        .output()
        .await
        .unwrap();
    assert!(
        output.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    println!("{}", String::from_utf8_lossy(&output.stdout));
}
