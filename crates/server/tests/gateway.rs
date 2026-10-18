use aether_protocol_core::MAX_REQUEST_BYTES;
use aether_server::{Gateway, router};
use axum::{
    Json, Router,
    body::{Body, to_bytes},
    http::{HeaderMap, Request, StatusCode},
    routing::post,
};
use serde_json::{Value, json};
use std::{
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
    time::Duration,
};
use tower::ServiceExt;

#[derive(Clone)]
struct Mock {
    calls: Arc<AtomicUsize>,
    delay: Duration,
    status: StatusCode,
}
async fn authority(
    axum::extract::State(s): axum::extract::State<Mock>,
    h: HeaderMap,
    Json(body): Json<Value>,
) -> (StatusCode, Json<Value>) {
    s.calls.fetch_add(1, Ordering::SeqCst);
    assert!(
        h["authorization"]
            .to_str()
            .unwrap()
            .starts_with("Bearer aether_agent_")
    );
    tokio::time::sleep(s.delay).await;
    if s.status != StatusCode::OK {
        return (
            s.status,
            Json(json!({"error":"Expected authority refusal."})),
        );
    }
    if body.get("id").is_none() {
        return (
            StatusCode::OK,
            Json(json!({"schema_version":1,"apps":["cad"],"commands":[]})),
        );
    }
    (
        StatusCode::OK,
        Json(json!({"command":body["id"],"result":{"received":body["arguments"]}})),
    )
}
async fn setup(
    status: StatusCode,
    delay: Duration,
    limit: usize,
    timeout: Duration,
) -> (Router, Arc<AtomicUsize>, tokio::task::JoinHandle<()>) {
    let calls = Arc::new(AtomicUsize::new(0));
    let state = Mock {
        calls: calls.clone(),
        delay,
        status,
    };
    let r = Router::new()
        .route("/api/automation/commands/run", post(authority))
        .route("/api/automation/commands/list", post(authority))
        .with_state(state);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let task = tokio::spawn(async move { axum::serve(listener, r).await.unwrap() });
    (
        router(Gateway::new(&url, limit, timeout).unwrap()),
        calls,
        task,
    )
}
fn payload() -> Value {
    json!({"protocol_version":1,"request_id":"r1","command":"cad.extrude.setdepth","arguments":{"app":"cad","id":"fixture","depth_mm":5.5,"expected_revision":7}})
}
fn request(path: &str, body: Value, token: Option<&str>) -> Request<Body> {
    let mut b = Request::builder()
        .uri(path)
        .method("POST")
        .header("content-type", "application/json");
    if let Some(t) = token {
        b = b.header("authorization", t)
    }
    b.body(Body::from(serde_json::to_vec(&body).unwrap()))
        .unwrap()
}
async fn decoded(r: axum::response::Response) -> (StatusCode, Value) {
    let status = r.status();
    (
        status,
        serde_json::from_slice(&to_bytes(r.into_body(), 16 * 1024 * 1024).await.unwrap()).unwrap(),
    )
}
const TOKEN: &str = "Bearer aether_agent_test";
#[tokio::test]
async fn valid_command_preserves_arguments_and_legacy_compatibility() {
    let (app, calls, task) = setup(StatusCode::OK, Duration::ZERO, 8, Duration::from_secs(2)).await;
    let (status, v) = decoded(
        app.clone()
            .oneshot(request("/v1/commands/run", payload(), Some(TOKEN)))
            .await
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(v["request_id"], "r1");
    assert_eq!(v["result"]["received"], payload()["arguments"]);
    let legacy = json!({"id":"cad.part.inspect","arguments":{"app":"cad","id":"fixture"}});
    let (_, v) = decoded(
        app.oneshot(request(
            "/api/automation/commands/run",
            legacy.clone(),
            Some(TOKEN),
        ))
        .await
        .unwrap(),
    )
    .await;
    assert_eq!(v["command"], legacy["id"]);
    assert_eq!(v["result"]["received"], legacy["arguments"]);
    assert!(v.get("status").is_none());
    assert_eq!(calls.load(Ordering::SeqCst), 2);
    task.abort();
}
#[tokio::test]
async fn missing_auth_and_bad_protocol_never_reach_authority() {
    let (app, calls, task) = setup(StatusCode::OK, Duration::ZERO, 8, Duration::from_secs(2)).await;
    for token in [
        None,
        Some("Bearer aether_sa_other"),
        Some("Bearer aether_agent_"),
    ] {
        let (s, _) = decoded(
            app.clone()
                .oneshot(request("/v1/commands/run", payload(), token))
                .await
                .unwrap(),
        )
        .await;
        assert_eq!(s, StatusCode::UNAUTHORIZED);
    }
    for change in [
        json!({"protocol_version":2}),
        json!({"upstream":"http://other"}),
        json!({"request_id":""}),
    ] {
        let mut v = payload();
        for (k, x) in change.as_object().unwrap() {
            v[k] = x.clone();
        }
        let (s, _) = decoded(
            app.clone()
                .oneshot(request("/v1/commands/run", v, Some(TOKEN)))
                .await
                .unwrap(),
        )
        .await;
        assert_eq!(s, StatusCode::BAD_REQUEST);
    }
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    task.abort();
}
#[tokio::test]
async fn permission_revocation_and_revision_refusals_are_not_cached() {
    for status in [
        StatusCode::UNAUTHORIZED,
        StatusCode::FORBIDDEN,
        StatusCode::CONFLICT,
    ] {
        let (app, calls, task) = setup(status, Duration::ZERO, 8, Duration::from_secs(2)).await;
        for _ in 0..2 {
            let (s, v) = decoded(
                app.clone()
                    .oneshot(request("/v1/commands/run", payload(), Some(TOKEN)))
                    .await
                    .unwrap(),
            )
            .await;
            assert_eq!(s, status);
            assert_eq!(v["error"]["execution"], "rejected");
        }
        assert_eq!(calls.load(Ordering::SeqCst), 2);
        task.abort();
    }
}
#[tokio::test]
async fn uncertain_write_is_never_retried() {
    let (app, calls, task) = setup(
        StatusCode::OK,
        Duration::from_millis(150),
        8,
        Duration::from_millis(40),
    )
    .await;
    let (s, v) = decoded(
        app.oneshot(request("/v1/commands/run", payload(), Some(TOKEN)))
            .await
            .unwrap(),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_GATEWAY);
    assert_eq!(v["error"]["code"], "outcome_unknown");
    assert_eq!(v["error"]["execution"], "unknown");
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    task.abort();
}
#[tokio::test]
async fn admission_is_bounded_and_health_remains_responsive() {
    let (app, calls, task) = setup(
        StatusCode::OK,
        Duration::from_millis(200),
        1,
        Duration::from_secs(2),
    )
    .await;
    let a = app.clone();
    let first = tokio::spawn(async move {
        a.oneshot(request("/v1/commands/run", payload(), Some(TOKEN)))
            .await
            .unwrap()
    });
    tokio::time::timeout(Duration::from_secs(1), async {
        while calls.load(Ordering::SeqCst) == 0 {
            tokio::task::yield_now().await
        }
    })
    .await
    .unwrap();
    let (s, v) = decoded(
        app.clone()
            .oneshot(request("/v1/commands/run", payload(), Some(TOKEN)))
            .await
            .unwrap(),
    )
    .await;
    assert_eq!(s, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(v["error"]["execution"], "not_started");
    let health = tokio::time::timeout(
        Duration::from_millis(50),
        app.oneshot(
            Request::builder()
                .uri("/healthz")
                .body(Body::empty())
                .unwrap(),
        ),
    )
    .await
    .unwrap()
    .unwrap();
    assert_eq!(health.status(), StatusCode::OK);
    assert_eq!(first.await.unwrap().status(), StatusCode::OK);
    task.abort();
}
#[tokio::test]
async fn oversized_request_is_rejected_before_forwarding() {
    let (app, calls, task) = setup(StatusCode::OK, Duration::ZERO, 8, Duration::from_secs(2)).await;
    let mut v = payload();
    v["arguments"]["padding"] = json!("x".repeat(MAX_REQUEST_BYTES));
    let (s, _) = decoded(
        app.oneshot(request("/v1/commands/run", v, Some(TOKEN)))
            .await
            .unwrap(),
    )
    .await;
    assert_eq!(s, StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    task.abort();
}
#[test]
fn unsafe_upstreams_are_refused() {
    for url in [
        "https://example.com",
        "http://localhost:8781",
        "http://127.0.0.1:8781/api",
        "http://user:pw@127.0.0.1:8781",
        "http://127.0.0.1:8781/?token=x",
    ] {
        assert!(Gateway::new(url, 1, Duration::from_secs(1)).is_err());
    }
}

#[tokio::test]
async fn browser_origins_and_duplicate_credentials_are_rejected_before_dispatch() {
    let (app, calls, task) = setup(StatusCode::OK, Duration::ZERO, 8, Duration::from_secs(2)).await;
    for path in ["/v1/commands/run", "/api/automation/commands/run"] {
        let mut req = request(path, payload(), Some(TOKEN));
        req.headers_mut()
            .insert("origin", "https://untrusted.test".parse().unwrap());
        let (status, _) = decoded(app.clone().oneshot(req).await.unwrap()).await;
        assert_eq!(status, StatusCode::FORBIDDEN);
    }
    let mut req = request("/v1/commands/run", payload(), Some(TOKEN));
    req.headers_mut()
        .append("authorization", TOKEN.parse().unwrap());
    assert_eq!(
        app.oneshot(req).await.unwrap().status(),
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    task.abort();
}

#[tokio::test]
async fn broken_and_oversized_upstream_replies_never_claim_a_write_failed_safely() {
    use aether_protocol_core::MAX_RESPONSE_BYTES;
    use axum::response::IntoResponse;
    for (status, body) in [
        (StatusCode::TEMPORARY_REDIRECT, "redirect".to_owned()),
        (StatusCode::OK, "not JSON".to_owned()),
        (
            StatusCode::OK,
            json!({"command":"different.command","result":{}}).to_string(),
        ),
        (StatusCode::OK, "x".repeat(MAX_RESPONSE_BYTES + 1)),
    ] {
        let calls = Arc::new(AtomicUsize::new(0));
        let count = calls.clone();
        let authority = Router::new().route(
            "/api/automation/commands/run",
            post(move || {
                let body = body.clone();
                let count = count.clone();
                async move {
                    count.fetch_add(1, Ordering::SeqCst);
                    // Following this redirect would repeatedly hit the authority.
                    (status, [("location", "/api/automation/commands/run")], body).into_response()
                }
            }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let task = tokio::spawn(async move { axum::serve(listener, authority).await.unwrap() });
        let app = router(Gateway::new(&url, 1, Duration::from_secs(2)).unwrap());
        let (status, value) = decoded(
            app.oneshot(request("/v1/commands/run", payload(), Some(TOKEN)))
                .await
                .unwrap(),
        )
        .await;
        assert_eq!(status, StatusCode::BAD_GATEWAY);
        assert_eq!(value["error"]["execution"], "unknown");
        assert_eq!(value["error"]["code"], "outcome_unknown");
        assert_eq!(calls.load(Ordering::SeqCst), 1);
        task.abort();
    }
}

#[tokio::test]
async fn malformed_typed_studio_write_never_reaches_the_authority() {
    let (app, calls, task) = setup(StatusCode::OK, Duration::ZERO, 8, Duration::from_secs(2)).await;
    for arguments in [
        json!({"app":"map","id":"fixture","name":"Next"}),
        json!({"app":"map","id":"fixture","name":"Next","expected_revision":0}),
        json!({"app":"map","id":"fixture","name":"Next","expected_revision":1,"actor":"forged"}),
    ] {
        let body = json!({"protocol_version":1,"request_id":"shape:1","command":"document.rename","arguments":arguments});
        let (status, response) = decoded(
            app.clone()
                .oneshot(request("/v1/commands/run", body, Some(TOKEN)))
                .await
                .unwrap(),
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(response["error"]["execution"], "not_started");
    }
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    task.abort();
}

#[tokio::test]
async fn malformed_typed_result_is_unknown_and_never_replayed() {
    // This authority claims success but returns the wrong result shape. The write
    // could already have committed; validation cannot turn that into a rejection.
    let (app, calls, task) = setup(StatusCode::OK, Duration::ZERO, 8, Duration::from_secs(2)).await;
    let body = json!({"protocol_version":1,"request_id":"shape:2","command":"document.rename","arguments":{"app":"map","id":"fixture","name":"Next","expected_revision":1}});
    let (status, response) = decoded(
        app.oneshot(request("/v1/commands/run", body, Some(TOKEN)))
            .await
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_GATEWAY);
    assert_eq!(response["error"]["execution"], "unknown");
    assert_eq!(response["error"]["code"], "outcome_unknown");
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    task.abort();
}

#[tokio::test]
async fn discovery_leaves_product_semantics_unknown_and_refuses_conflicting_write_flags() {
    for (writes, expected_status) in [(true, StatusCode::OK), (false, StatusCode::BAD_GATEWAY)] {
        let catalog = json!({"schema_version":1,"apps":["cad"],"commands":[
            {"id":"document.rename","title":"Rename","description":"Rename","inputSchema":{},"writes":writes,"annotations":{}},
            {"id":"cad.part.inspect","title":"Inspect","description":"Inspect","inputSchema":{},"writes":false,"annotations":{}}
        ]});
        let authority = Router::new().route(
            "/api/automation/commands/list",
            post(move || {
                let catalog = catalog.clone();
                async move { Json(catalog) }
            }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let task = tokio::spawn(async move { axum::serve(listener, authority).await.unwrap() });
        let app = router(Gateway::new(&url, 1, Duration::from_secs(2)).unwrap());
        let req = Request::builder()
            .uri("/v1/commands/profiles")
            .header("authorization", TOKEN)
            .body(Body::empty())
            .unwrap();
        let (status, body) = decoded(app.oneshot(req).await.unwrap()).await;
        assert_eq!(status, expected_status);
        if status == StatusCode::OK {
            assert_eq!(
                body["commands"][0]["semantics"]["history"],
                "append_revision"
            );
            assert!(body["commands"][1]["semantics"].is_null());
            assert_eq!(body["commands"][1]["descriptor"]["id"], "cad.part.inspect");
        }
        task.abort();
    }
}
