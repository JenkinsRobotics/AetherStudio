use super::*;
use aether_server::{
    native::{maintenance::Diagnostics, presentation::Presentation},
    settings::Settings,
};
async fn read(f: &Fixture, user: &str) -> reqwest::Response {
    let mut req = f.client.get(format!("{}/api/admin/maintenance", f.url));
    if !user.is_empty() {
        req = req.header("cookie", format!("{COOKIE}={}", token(user)));
    }
    req.send().await.unwrap()
}
#[tokio::test]
#[ignore = "requires disposable PostgreSQL runner"]
async fn maintenance_is_current_admin_only_redacted_and_tenant_scoped() {
    let mut f = Fixture::new().await;
    let settings = Settings::new(f.pool.clone(), f.identity.clone());
    settings.migrate(&Presentation::default()).await.unwrap();
    f.docs
        .mutate(&token("admin"), &create("private-drawing"))
        .await
        .unwrap();
    let dir = tempfile::tempdir().unwrap();
    let diag = Diagnostics::new(dir.path()).unwrap();
    f.task.abort();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    f.url = format!("http://{address}");
    let host = NativeHost::new(f.identity.clone(), &f.url, 64, Duration::from_secs(30))
        .unwrap()
        .with_documents(f.docs.clone())
        .with_settings(settings)
        .with_diagnostics(diag)
        .with_listen_address(address);
    f.task = tokio::spawn(async move {
        axum::serve(
            listener,
            router(host).into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        .unwrap();
    });
    assert_eq!(read(&f, "").await.status(), 401);
    assert_eq!(read(&f, "alice").await.status(), 403);
    let response = read(&f, "admin").await;
    assert_eq!(response.status(), 200);
    let report: Value = response.json().await.unwrap();
    assert_eq!(report["installation"]["runtime"], "Rust");
    assert_eq!(report["network"]["port"], address.port());
    assert_eq!(
        report["counts"],
        json!({"users":4,"documents":1,"trashed_documents":0})
    );
    assert_eq!(report["capabilities"]["backups"], false);
    assert_eq!(
        report["storage"]["data_directory"],
        dir.path().canonicalize().unwrap().to_str().unwrap()
    );
    #[cfg(unix)]
    assert!(report["storage"]["free_bytes"].as_u64().unwrap() > 0);
    assert!(!report.to_string().contains("private-drawing"));
    assert!(!report.to_string().contains("fixture-hash"));
    assert!(!report.to_string().contains("alice"));
    f.sql("UPDATE aether_identity.users SET role='member' WHERE id='admin'")
        .await;
    assert_eq!(read(&f, "admin").await.status(), 403);
}
#[test]
fn diagnostics_require_an_existing_operator_directory() {
    assert!(Diagnostics::new(std::path::Path::new("relative")).is_err());
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("not-a-directory");
    std::fs::write(&file, b"test").unwrap();
    assert!(Diagnostics::new(&file).is_err());
}
