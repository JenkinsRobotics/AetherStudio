use super::*;
use axum::{
    Router,
    body::{Body, Bytes},
    response::{IntoResponse, Response},
    routing::get,
};
use std::sync::{Arc, Mutex};

async fn upstream(response: Response) -> (String, tokio::task::JoinHandle<()>) {
    let reply = Arc::new(Mutex::new(Some(response)));
    let app = Router::new().route(
        "/",
        get(
            move |headers: HeaderMap,
                  Query(query): Query<std::collections::HashMap<String, String>>| {
                let response = reply.lock().unwrap().take().unwrap();
                async move {
                    assert!(!headers.contains_key("cookie"));
                    assert!(!headers.contains_key("authorization"));
                    assert_eq!(query["q"], "blue & gold");
                    assert_eq!(query["page_size"], "20");
                    assert_eq!(query["license_type"], "all-cc");
                    response
                }
            },
        ),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let endpoint = format!("http://{}/", listener.local_addr().unwrap());
    (
        endpoint,
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() }),
    )
}
async fn request(response: Response) -> Response {
    let (url, task) = upstream(response).await;
    let value = fetch(&client().unwrap(), &url, "blue & gold", 2).await;
    task.abort();
    match value {
        Ok(value) => Json(value).into_response(),
        Err(error) => error.into_response(),
    }
}
#[test]
fn search_parameters_are_bounded_and_legacy_pages_are_clamped() {
    for (page, expected) in [("-2", 1), ("75", 50), ("nonsense", 1), ("2", 2)] {
        let (query, actual) = parameters(Search {
            q: "  wheel  ".into(),
            page: Some(page.into()),
            ..Default::default()
        })
        .ok()
        .unwrap();
        assert_eq!(query, "wheel");
        assert_eq!(actual, expected);
    }
    for q in ["x".repeat(513), "bad\u{0}query".into()] {
        assert!(
            parameters(Search {
                q,
                ..Default::default()
            })
            .is_err()
        );
    }
}
#[tokio::test]
async fn provider_payload_keeps_attribution_and_license_fields() {
    let payload = json!({"results":[{"id":"sample","title":"Wheel","license":"cc0","creator":"Artist","foreign_landing_url":"https://example.org/photo"}],"result_count":1,"page":2,"page_count":1});
    let response = request(Json(payload.clone()).into_response()).await;
    assert_eq!(response.status(), 200);
    let bytes = axum::body::to_bytes(response.into_body(), MAX_RESPONSE)
        .await
        .unwrap();
    assert_eq!(serde_json::from_slice::<Value>(&bytes).unwrap(), payload);
}
#[tokio::test]
async fn provider_errors_redirects_and_malformed_results_fail_closed() {
    for status in [429, 500, 302] {
        let response = request(
            Response::builder()
                .status(status)
                .header("location", "http://127.0.0.1:1/private")
                .body(Body::from("secret diagnostic"))
                .unwrap(),
        )
        .await;
        assert_eq!(response.status(), 502);
        let bytes = axum::body::to_bytes(response.into_body(), 4096)
            .await
            .unwrap();
        assert!(!String::from_utf8_lossy(&bytes).contains("secret diagnostic"));
    }
    for body in [
        "not JSON".to_string(),
        json!({"results":null}).to_string(),
        json!({"results":vec![json!({});21],"result_count":21,"page":1,"page_count":1}).to_string(),
    ] {
        assert_eq!(
            request(Body::from(body).into_response()).await.status(),
            502
        );
    }
}
#[tokio::test]
async fn oversized_declared_and_chunked_responses_are_bounded() {
    let huge = vec![b'x'; MAX_RESPONSE + 1];
    assert_eq!(
        request(
            Response::builder()
                .header("content-length", huge.len())
                .body(Body::from(huge))
                .unwrap()
        )
        .await
        .status(),
        502
    );
    let chunks = futures_util::stream::iter(
        (0..4).map(|_| Ok::<_, std::io::Error>(Bytes::from(vec![b'x'; 1024 * 1024]))),
    );
    assert_eq!(
        request(Body::from_stream(chunks).into_response())
            .await
            .status(),
        502
    );
}
#[tokio::test]
async fn slow_provider_has_a_total_deadline() {
    let app = Router::new().route(
        "/",
        get(|| async {
            tokio::time::sleep(Duration::from_secs(2)).await;
            "late"
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}/", listener.local_addr().unwrap());
    let task = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(50))
        .build()
        .unwrap();
    let response = fetch(&client, &url, "wheel", 1)
        .await
        .err()
        .unwrap()
        .into_response();
    task.abort();
    assert_eq!(response.status(), 504);
}
