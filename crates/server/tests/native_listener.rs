#[path = "support/tls.rs"]
mod tls;
use aether_server::native::{
    NativeHost,
    configuration::local_identity,
    listener::{Configuration, Listener},
    router,
};
use std::{path::PathBuf, time::Duration};
use tls::certificate;
fn config() -> Configuration {
    Configuration {
        address: "127.0.0.1:0".parse().unwrap(),
        public_origin: None,
        certificate: None,
        private_key: None,
    }
}
fn app(origin: &str) -> axum::Router {
    // Health and boundary checks never connect to this nonexistent database.
    let identity = local_identity(
        "host=/tmp/aether-not-a-running-database user=fixture dbname=fixture",
        "fixture",
    )
    .unwrap();
    router(NativeHost::new(identity, origin, 8, Duration::from_secs(5)).unwrap())
}
#[tokio::test]
async fn loopback_listener_enforces_host_and_stops_gracefully() {
    let listener = Listener::bind(config()).await.unwrap();
    let origin = listener.origin().to_owned();
    let router = app(&origin);
    let (stop, rx) = tokio::sync::oneshot::channel();
    let task = tokio::spawn(listener.serve(router, async move {
        let _ = rx.await;
    }));
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap();
    assert_eq!(
        client
            .get(format!("{origin}/healthz"))
            .send()
            .await
            .unwrap()
            .status(),
        200
    );
    assert_eq!(
        client
            .get(format!("{origin}/healthz"))
            .header("host", "untrusted.example")
            .send()
            .await
            .unwrap()
            .status(),
        403
    );
    stop.send(()).unwrap();
    tokio::time::timeout(Duration::from_secs(5), task)
        .await
        .unwrap()
        .unwrap()
        .unwrap();
    assert!(
        client
            .get(format!("{origin}/healthz"))
            .send()
            .await
            .is_err()
    );
}
#[tokio::test]
async fn remote_plaintext_and_inconsistent_origins_are_refused() {
    let mut value = config();
    value.address = "0.0.0.0:0".parse().unwrap();
    assert!(Listener::bind(value).await.is_err());
    for origin in [
        "http://other.example:1234",
        "https://127.0.0.1:1234",
        "http://a:b@localhost:1234",
        "http://localhost:1234/path",
    ] {
        let mut value = config();
        value.public_origin = Some(origin.into());
        assert!(Listener::bind(value).await.is_err());
    }
    let mut value = config();
    value.certificate = Some(PathBuf::from("/missing-certificate"));
    assert!(Listener::bind(value).await.is_err());
}
#[tokio::test]
async fn tls_verifies_certificate_hostname_host_boundary_and_rejects_plaintext() {
    let (_dir, cert, key) = certificate();
    let mut value = config();
    value.certificate = Some(cert.clone());
    value.private_key = Some(key.clone());
    let listener = Listener::bind(value).await.unwrap();
    let origin = listener.origin().to_owned();
    let router = app(&origin);
    let (stop, rx) = tokio::sync::oneshot::channel();
    let task = tokio::spawn(listener.serve(router, async move {
        let _ = rx.await;
    }));
    let root = reqwest::Certificate::from_pem(&std::fs::read(cert).unwrap()).unwrap();
    let client = reqwest::Client::builder()
        .no_proxy()
        .add_root_certificate(root)
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap();
    assert_eq!(
        client
            .get(format!("{origin}/healthz"))
            .send()
            .await
            .unwrap()
            .status(),
        200
    );
    assert_eq!(
        client
            .get(format!("{origin}/healthz"))
            .header("host", "wrong.example")
            .send()
            .await
            .unwrap()
            .status(),
        403
    );
    assert!(
        reqwest::Client::builder()
            .no_proxy()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap()
            .get(format!("{origin}/healthz"))
            .send()
            .await
            .is_err()
    );
    assert!(
        client
            .get(format!("{}/healthz", origin.replace("https:", "http:")))
            .send()
            .await
            .is_err()
    );
    stop.send(()).unwrap();
    tokio::time::timeout(Duration::from_secs(5), task)
        .await
        .unwrap()
        .unwrap()
        .unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&key, std::fs::Permissions::from_mode(0o644)).unwrap();
        let mut value = config();
        value.certificate = Some(_dir.path().join("certificate.pem"));
        value.private_key = Some(key);
        assert!(Listener::bind(value).await.is_err());
    }
}
