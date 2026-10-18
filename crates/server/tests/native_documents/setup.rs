use super::*;
use aether_server::{
    native::{presentation::Presentation, setup::Setup},
    settings::Settings,
};
async fn fixture() -> (Fixture, tempfile::TempDir, String) {
    fixture_with_browser(false).await
}
async fn fixture_with_browser(browser: bool) -> (Fixture, tempfile::TempDir, String) {
    let mut f = Fixture::new().await;
    f.identity = Identity::new(f.pool.clone(), "first-run", 2).unwrap();
    f.docs = Documents::new(
        f.pool.clone(),
        f.identity.clone(),
        HostedStore::new(
            f.pool.clone(),
            ContentStore::local(f._objects.path()).unwrap(),
        ),
    );
    f.docs.migrate().await.unwrap();
    let settings = Settings::new(f.pool.clone(), f.identity.clone());
    settings.migrate(&Presentation::default()).await.unwrap();
    let dir = tempfile::tempdir().unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(dir.path(), std::fs::Permissions::from_mode(0o700)).unwrap();
    }
    let path = dir.path().join("setup.json");
    let secret = Setup::create_key(&path).unwrap();
    let setup = Setup::load(&path, f.pool.clone()).unwrap();
    f.task.abort();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    f.url = format!("http://{}", listener.local_addr().unwrap());
    let mut host = NativeHost::new(f.identity.clone(), &f.url, 64, Duration::from_secs(30))
        .unwrap()
        .with_documents(f.docs.clone())
        .with_settings(settings)
        .with_setup(setup);
    if browser {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .canonicalize()
            .unwrap();
        let manifest = dir.path().join("frontends.json");
        let config = json!({"schema":1,"studio":root.join("studio/dist"),"session":root.join("core/session"),"icons":root.join("core/assets/icons"),"branding":root.join("core/assets/branding/apps"),"apps":{"map":root.join("../Aether-Map/dist")}});
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
    (f, dir, secret.to_string())
}
async fn post(f: &Fixture, cookie: &str, path: &str, data: Value) -> reqwest::Response {
    f.client
        .post(format!("{}{path}", f.url))
        .header("origin", &f.url)
        .header("cookie", cookie)
        .json(&data)
        .send()
        .await
        .unwrap()
}
fn input() -> Value {
    json!({"name":"Native Company","username":"firstadmin","full_name":"First Administrator","email":"first@example.test","password":"first-admin-password-2026","apps":[]})
}
async fn authorize(f: &Fixture, secret: &str) -> String {
    let r = post(f, "", "/api/setup/authorize", json!({"token":secret})).await;
    assert_eq!(r.status(), 200);
    let cookie = r.headers()["set-cookie"].to_str().unwrap();
    assert!(cookie.contains("HttpOnly"));
    assert!(cookie.contains("SameSite=Strict"));
    cookie.split(';').next().unwrap().to_string()
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn setup_requires_local_key_and_commits_name_admin_and_app_policy_once() {
    let (f, _dir, secret) = fixture().await;
    assert_eq!(post(&f, "", "/api/setup", input()).await.status(), 403);
    assert_eq!(
        post(&f, "", "/api/setup/authorize", json!({"token":"wrong"}))
            .await
            .status(),
        403
    );
    let cookie = authorize(&f, &secret).await;
    let status = f
        .client
        .get(format!("{}/api/status", f.url))
        .header("cookie", &cookie)
        .send()
        .await
        .unwrap()
        .json::<Value>()
        .await
        .unwrap();
    assert_eq!(status["ready"], false);
    assert_eq!(status["installation"]["setup_authorized"], true);
    assert!(!status.to_string().contains(&secret));
    let mut invalid = input();
    invalid["apps"] = json!(["not-installed"]);
    assert_eq!(post(&f, &cookie, "/api/setup", invalid).await.status(), 400);
    assert_eq!(post(&f, &cookie, "/api/setup", input()).await.status(), 200);
    let session = f
        .identity
        .sign_in("firstadmin", "first-admin-password-2026", "test")
        .await
        .unwrap();
    assert_eq!(
        f.identity
            .authenticate(session.expose())
            .await
            .unwrap()
            .role,
        aether_identity::Role::Admin
    );
    let row = f
        .pool
        .get()
        .await
        .unwrap()
        .query_one(
            "SELECT value FROM aether_settings.presentation WHERE tenant='first-run'",
            &[],
        )
        .await
        .unwrap();
    assert_eq!(row.get::<_, Value>(0)["name"], "Native Company");
    let apps = f
        .pool
        .get()
        .await
        .unwrap()
        .query(
            "SELECT id,enabled FROM aether_access.applications WHERE tenant='first-run'",
            &[],
        )
        .await
        .unwrap();
    assert_eq!(apps.len(), 8);
    assert!(
        apps.iter()
            .all(|r| r.get::<_, bool>(1) == (r.get::<_, String>(0) == "ui"))
    );
    assert_eq!(post(&f, &cookie, "/api/setup", input()).await.status(), 409);
    assert_eq!(
        post(&f, "", "/api/setup/authorize", json!({"token":secret}))
            .await
            .status(),
        409
    );
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn setup_audit_failure_rolls_back_identity_and_configuration() {
    let (f, _dir, secret) = fixture().await;
    let cookie = authorize(&f, &secret).await;
    f.sql("ALTER TABLE aether_access.audit ADD CONSTRAINT fail_setup CHECK(action<>'installation_configured') NOT VALID").await;
    assert_eq!(post(&f, &cookie, "/api/setup", input()).await.status(), 503);
    assert!(!f.identity.session_status(None).await.unwrap().ready);
    let c = f.pool.get().await.unwrap();
    assert_eq!(
        c.query_one(
            "SELECT value->>'name' FROM aether_settings.presentation WHERE tenant='first-run'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, String>(0),
        "Aether Studio"
    );
    assert_eq!(
        c.query_one(
            "SELECT count(*) FROM aether_access.applications WHERE tenant='first-run'",
            &[]
        )
        .await
        .unwrap()
        .get::<_, i64>(0),
        0
    );
    drop(c);
    f.sql("ALTER TABLE aether_access.audit DROP CONSTRAINT fail_setup")
        .await;
    let (a, b) = tokio::join!(
        post(&f, &cookie, "/api/setup", input()),
        post(&f, &cookie, "/api/setup", input())
    );
    let mut codes = [a.status().as_u16(), b.status().as_u16()];
    codes.sort();
    assert_eq!(codes, [200, 409]);
}
#[tokio::test]
#[ignore = "disposable PostgreSQL runner"]
async fn setup_keys_cannot_be_replaced_and_ambiguous_cookies_are_rejected() {
    let (f, dir, secret) = fixture().await;
    assert!(Setup::create_key(&dir.path().join("setup.json")).is_err());
    let cookie = authorize(&f, &secret).await;
    assert_eq!(
        post(&f, &format!("{cookie}; {cookie}"), "/api/setup", input())
            .await
            .status(),
        403
    );
    let path = dir.path().join("expired.json");
    std::fs::write(
        &path,
        serde_json::to_vec(&json!({"secret":secret,"expires":1})).unwrap(),
    )
    .unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600)).unwrap();
    }
    // An expired file can load without blocking a configured server's startup;
    // it cannot authorize a new browser setup.
    assert!(Setup::load(&path, f.pool.clone()).is_ok());
    #[cfg(unix)]
    {
        use std::os::unix::fs::{PermissionsExt, symlink};
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).unwrap();
        assert!(Setup::load(&path, f.pool.clone()).is_err());
        let link = dir.path().join("link");
        symlink(dir.path().join("setup.json"), &link).unwrap();
        assert!(Setup::load(&link, f.pool.clone()).is_err());
    }
}

#[tokio::test]
#[ignore = "disposable PostgreSQL and built Studio frontend"]
async fn actual_first_run_browser_creates_admin_and_signs_in() {
    let (f, _dir, secret) = fixture_with_browser(true).await;
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let output = tokio::process::Command::new("node")
        .arg(root.join("dev/rebuild/setup_browser.mjs"))
        .arg(&f.url)
        .arg(secret)
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
