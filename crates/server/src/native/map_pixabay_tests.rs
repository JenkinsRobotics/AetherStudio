use super::super::map_search;
use super::*;
use axum::{
    Router,
    body::Body,
    extract::Query,
    http::HeaderMap,
    response::{IntoResponse, Response},
    routing::get,
};
use serde_json::json;
use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};

async fn upstream(
    status: u16,
    body: String,
) -> (String, Arc<AtomicUsize>, tokio::task::JoinHandle<()>) {
    let count = Arc::new(AtomicUsize::new(0));
    let calls = count.clone();
    let app = Router::new().route(
        "/videos/",
        get(
            move |headers: HeaderMap, Query(query): Query<HashMap<String, String>>| {
                calls.fetch_add(1, Ordering::SeqCst);
                assert_eq!(query["key"], "fixture-key");
                assert_eq!(query["per_page"], "20");
                assert_eq!(query["q"], "green skull");
                assert!(!headers.contains_key("cookie"));
                assert!(!headers.contains_key("authorization"));
                let body = body.clone();
                async move {
                    Response::builder()
                        .status(status)
                        .header("location", "http://127.0.0.1:1/private")
                        .body(Body::from(body))
                        .unwrap()
                }
            },
        ),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}/", listener.local_addr().unwrap());
    (
        url,
        count,
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() }),
    )
}
#[test]
fn page_links_become_ids_and_arbitrary_urls_are_never_fetched() {
    let query: HashMap<_, _> = parameters(
        "https://pixabay.com/videos/skull-skeleton-halloween-scary-133142/",
        "video",
        1,
    )
    .ok()
    .unwrap()
    .into_iter()
    .collect();
    assert_eq!(query["id"], "133142");
    assert!(!query.contains_key("q"));
    for link in [
        "https://127.0.0.1/private-133142/",
        "https://pixabay.com.evil.test/videos/skull-133142/",
        "https://user:secret@pixabay.com/videos/skull-133142/",
        "https://pixabay.com/videos/search/skull/",
    ] {
        assert!(parameters(link, "video", 1).is_err());
    }
    assert!(parameters("https://pixabay.com/videos/skull-133142/", "image", 1).is_err());
    assert!(parameters(&"x".repeat(101), "video", 1).is_err());
    assert!(parameters("skull", "audio", 1).is_err());
}
#[tokio::test]
async fn key_is_required_and_never_echoed() {
    let lib = Library::new(None);
    let error = lib
        .search(&map_search::client().unwrap(), "green skull", "video", 1)
        .await
        .err()
        .unwrap()
        .into_response();
    assert_eq!(error.status(), 503);
}
#[tokio::test]
async fn repeated_and_concurrent_queries_use_the_24_hour_cache() {
    let payload =
        json!({"totalHits":1, "hits":[{"id":133142,"user":"creator","tags":"skull"}]}).to_string();
    let (endpoint, calls, task) = upstream(200, payload).await;
    let lib = Library::new(Some("fixture-key".into()));
    let client = map_search::client().unwrap();
    let (a, b) = tokio::join!(
        lib.search_at(&client, &endpoint, "green skull", "video", 1),
        lib.search_at(&client, &endpoint, "green skull", "video", 1)
    );
    assert_eq!(a.ok(), b.ok());
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    lib.cache
        .lock()
        .await
        .values_mut()
        .for_each(|v| v.at = Instant::now() - TTL);
    assert!(
        lib.search_at(&client, &endpoint, "green skull", "video", 1)
            .await
            .is_ok()
    );
    assert_eq!(calls.load(Ordering::SeqCst), 2);
    task.abort();
}
#[tokio::test]
async fn refused_redirected_oversized_or_invalid_responses_are_not_cached() {
    for (status, body) in [
        (429, "fixture-key".into()),
        (302, "private".into()),
        (200, "bad JSON".into()),
        (200, json!({"hits":[],"totalHits":"bad"}).to_string()),
        (200, "x".repeat(MAX_RESPONSE + 1)),
    ] {
        let (endpoint, _, task) = upstream(status, body).await;
        let lib = Library::new(Some("fixture-key".into()));
        let response = lib
            .search_at(
                &map_search::client().unwrap(),
                &endpoint,
                "green skull",
                "video",
                1,
            )
            .await
            .err()
            .unwrap()
            .into_response();
        assert_eq!(response.status(), 502);
        let body = axum::body::to_bytes(response.into_body(), 4096)
            .await
            .unwrap();
        assert!(!String::from_utf8_lossy(&body).contains("fixture-key"));
        assert!(lib.cache.lock().await.is_empty());
        task.abort();
    }
}
