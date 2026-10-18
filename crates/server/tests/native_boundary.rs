//! Fast HTTP boundary tests; PostgreSQL intentionally absent for rejected calls.
use aether_identity::Identity;
use aether_server::native::{NativeHost, configuration::local_identity, router};
use axum::{
    body::{Body, to_bytes},
    http::{Request, StatusCode},
};
use deadpool_postgres::{Manager, Pool};
use std::time::Duration;
use tokio_postgres::NoTls;
use tower::ServiceExt;

fn host(origin: &str, deadline: Duration) -> NativeHost {
    let pool = Pool::builder(Manager::new(
        "host=/tmp/aether-no-database".parse().unwrap(),
        NoTls,
    ))
    .max_size(1)
    .build()
    .unwrap();
    NativeHost::new(Identity::new(pool, "test", 1).unwrap(), origin, 1, deadline).unwrap()
}
async fn send(request: Request<Body>) -> (StatusCode, serde_json::Value) {
    let response = router(host("http://127.0.0.1:8880", Duration::from_secs(1)))
        .oneshot(request)
        .await
        .unwrap();
    assert_eq!(response.headers()["cache-control"], "no-store");
    assert!(
        !response
            .headers()
            .contains_key("access-control-allow-origin")
    );
    let status = response.status();
    let data = to_bytes(response.into_body(), 65536).await.unwrap();
    (status, serde_json::from_slice(&data).unwrap())
}
fn post() -> axum::http::request::Builder {
    Request::builder()
        .method("POST")
        .uri("/api/profile")
        .header("host", "127.0.0.1:8880")
        .header("content-type", "application/json")
}
#[tokio::test]
async fn origin_host_authorization_and_fetch_metadata_refuse_before_database_access() {
    let cases = [
        post(),
        post().header("origin", "null"),
        post().header("origin", "http://evil.test"),
        post()
            .header("origin", "http://127.0.0.1:8880")
            .header("origin", "http://evil.test"),
        post()
            .header("origin", "http://127.0.0.1:8880")
            .header("host", "evil.test"),
        post()
            .header("origin", "http://127.0.0.1:8880")
            .header("sec-fetch-site", "cross-site"),
        post()
            .header("origin", "http://127.0.0.1:8880")
            .header("sec-fetch-site", "same-site"),
    ];
    for request in cases {
        assert_eq!(
            send(request.body(Body::from("{}")).unwrap()).await.0,
            StatusCode::FORBIDDEN
        );
    }
    let result = send(
        post()
            .header("origin", "http://127.0.0.1:8880")
            .header("authorization", "Bearer aether_agent_test")
            .body(Body::from("{}"))
            .unwrap(),
    )
    .await;
    assert_eq!(result.0, StatusCode::UNAUTHORIZED);
}
#[tokio::test]
async fn input_errors_are_json_bounded_and_never_echo_secrets() {
    for text in [
        r#"{"current_password":"a-secret", "full_name":"a", "email":"a@example.test", "tenant":"b"}"#,
        r#"{"current_password":"a-secret","full_name":"a-secret","email":3}"#,
        r#"[]"#,
        r#"{bad"#,
    ] {
        let response = send(
            post()
                .header("origin", "http://127.0.0.1:8880")
                .body(Body::from(text))
                .unwrap(),
        )
        .await;
        assert_eq!(response.0, StatusCode::BAD_REQUEST);
        assert!(!response.1.to_string().contains("a-secret"));
    }
    assert_eq!(
        send(
            post()
                .header("origin", "http://127.0.0.1:8880")
                .body(Body::from("x".repeat(17 * 1024)))
                .unwrap()
        )
        .await
        .0,
        StatusCode::PAYLOAD_TOO_LARGE
    );
    let request = Request::builder()
        .method("POST")
        .uri("/api/login")
        .header("host", "127.0.0.1:8880")
        .header("origin", "http://127.0.0.1:8880")
        .header("content-type", "text/plain")
        .body(Body::from("{}"))
        .unwrap();
    assert_eq!(send(request).await.0, StatusCode::UNSUPPORTED_MEDIA_TYPE);
}
#[tokio::test]
async fn cookies_cannot_mix_identity_authorities_or_duplicate_sessions() {
    let token = "a".repeat(64);
    for cookie in [
        "aether_session=old".to_string(),
        "aether_native_session=bad".into(),
        format!("aether_native_session={token}; aether_native_session={token}"),
        "x".repeat(9000),
    ] {
        let request = Request::builder()
            .uri("/api/v1/identity/session")
            .header("host", "127.0.0.1:8880")
            .header("cookie", cookie)
            .body(Body::empty())
            .unwrap();
        assert_eq!(send(request).await.0, StatusCode::UNAUTHORIZED);
    }
}
#[tokio::test]
async fn methods_queries_and_unmigrated_routes_are_explicitly_unavailable() {
    for path in ["/"] {
        let r = Request::builder()
            .uri(path)
            .header("host", "127.0.0.1:8880")
            .body(Body::empty())
            .unwrap();
        assert_eq!(send(r).await.0, StatusCode::NOT_FOUND);
    }
    for path in [
        "/api/setup",
        "/api/recovery/request",
        "/api/library/list",
        "/api/library/read",
        "/api/v1/documents/mutate",
    ] {
        let r = Request::builder()
            .uri(path)
            .header("host", "127.0.0.1:8880")
            .body(Body::empty())
            .unwrap();
        let (status, error) = send(r).await;
        assert_eq!(status, StatusCode::METHOD_NOT_ALLOWED);
        assert_eq!(error["execution"], "rejected");
    }
    let r = Request::builder()
        .uri("/api/login")
        .header("host", "127.0.0.1:8880")
        .body(Body::empty())
        .unwrap();
    assert_eq!(send(r).await.0, StatusCode::METHOD_NOT_ALLOWED);
    let r = Request::builder()
        .uri("/api/v1/identity/session?token=secret")
        .header("host", "127.0.0.1:8880")
        .body(Body::empty())
        .unwrap();
    assert_eq!(send(r).await.0, StatusCode::BAD_REQUEST);
    let r = Request::builder()
        .uri("/healthz")
        .header("host", "127.0.0.1:8880")
        .body(Body::empty())
        .unwrap();
    let result = send(r).await;
    assert_eq!(result.0, StatusCode::OK);
    assert_eq!(result.1["applications_ready"], false);
}
#[test]
fn local_database_configuration_never_downgrades_remote_tls() {
    for dsn in [
        "",
        "host=localhost",
        "host=127.0.0.1",
        "host=company.example",
        "host=/tmp hostaddr=127.0.0.1",
        "host=/tmp,/other",
    ] {
        assert!(local_identity(dsn, "test").is_err());
    }
    assert!(local_identity("host=/tmp dbname=test", "test").is_ok());
}
#[test]
fn configured_origin_requires_https_except_loopback_and_no_url_secrets() {
    let identity = local_identity("host=/tmp dbname=test", "test").unwrap();
    for origin in [
        "http://company.example",
        "https://user:pass@company.example",
        "https://company.example/path",
        "https://company.example/?secret=x",
        "https://company.example/#x",
        "file:///tmp/test",
    ] {
        assert!(NativeHost::new(identity.clone(), origin, 1, Duration::from_secs(1)).is_err());
    }
    assert!(
        NativeHost::new(
            identity.clone(),
            "https://company.example",
            1,
            Duration::from_secs(1)
        )
        .is_ok()
    );
    assert!(NativeHost::new(identity, "http://[::1]:8880", 1, Duration::from_secs(1)).is_ok());
}

#[tokio::test]
async fn status_preserves_same_origin_and_read_only_method_boundary() {
    let post = Request::builder()
        .method("POST")
        .uri("/api/status")
        .header("host", "127.0.0.1:8880")
        .header("origin", "http://127.0.0.1:8880")
        .header("content-type", "application/json")
        .body(Body::from("{}"))
        .unwrap();
    assert_eq!(send(post).await.0, StatusCode::METHOD_NOT_ALLOWED);
    let query = Request::builder()
        .uri("/api/status?tenant=other")
        .header("host", "127.0.0.1:8880")
        .body(Body::empty())
        .unwrap();
    assert_eq!(send(query).await.0, StatusCode::BAD_REQUEST);
    let cross = Request::builder()
        .uri("/api/status")
        .header("host", "127.0.0.1:8880")
        .header("origin", "https://other.invalid")
        .body(Body::empty())
        .unwrap();
    assert_eq!(send(cross).await.0, StatusCode::FORBIDDEN);
}
