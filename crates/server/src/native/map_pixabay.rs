//! Fixed-origin Pixabay transport. Credentials never enter documents or responses.
use super::boundary::{Failure, Result};
use axum::http::StatusCode;
use futures_util::StreamExt;
use serde_json::Value;
use std::{
    collections::HashMap,
    time::{Duration, Instant},
};
use tokio::sync::Mutex;

const ENDPOINT: &str = "https://pixabay.com/api/";
const TTL: Duration = Duration::from_secs(24 * 60 * 60);
const MAX_RESPONSE: usize = 2 * 1024 * 1024;
const MAX_ENTRIES: usize = 128;
struct Cached {
    at: Instant,
    body: Value,
}
pub(super) struct Library {
    key: Option<zeroize::Zeroizing<String>>,
    cache: Mutex<HashMap<String, Cached>>,
}
fn failure(status: StatusCode, message: &str) -> Failure {
    Failure::new(status, "asset_search_failed", message)
}
impl Library {
    pub fn from_environment() -> Self {
        Self::new(std::env::var("AETHER_PIXABAY_API_KEY").ok())
    }
    fn new(key: Option<String>) -> Self {
        Self {
            key: key
                .filter(|k| !k.trim().is_empty())
                .map(zeroize::Zeroizing::new),
            cache: Mutex::new(HashMap::new()),
        }
    }
    pub async fn search(
        &self,
        client: &reqwest::Client,
        query: &str,
        kind: &str,
        page: u32,
    ) -> Result<Value> {
        self.search_at(client, ENDPOINT, query, kind, page).await
    }
    async fn search_at(
        &self,
        client: &reqwest::Client,
        endpoint: &str,
        query: &str,
        kind: &str,
        page: u32,
    ) -> Result<Value> {
        let parameters = parameters(query, kind, page)?;
        let key = self.key.as_ref().ok_or_else(|| failure(StatusCode::SERVICE_UNAVAILABLE,
            "Pixabay is not connected. Ask your Studio administrator to configure the Pixabay API key."))?;
        let cache_key = format!("{kind}:{parameters:?}");
        // Serialize cache fills: repeated concurrent searches make only one request.
        let mut cache = self.cache.lock().await;
        cache.retain(|_, item| item.at.elapsed() < TTL);
        if let Some(cached) = cache.get(&cache_key) {
            return Ok(cached.body.clone());
        }
        // Never evict an unexpired query and re-request it before Pixabay's 24h TTL.
        if cache.len() >= MAX_ENTRIES {
            return Err(failure(
                StatusCode::TOO_MANY_REQUESTS,
                "The Pixabay search cache is full. Try a previous search or return later.",
            ));
        }
        let url = format!("{endpoint}{}", if kind == "video" { "videos/" } else { "" });
        let response = client
            .get(url)
            .query(&parameters)
            .query(&[("key", key.as_str())])
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|_| {
                failure(
                    StatusCode::GATEWAY_TIMEOUT,
                    "Could not reach Pixabay. Try again later.",
                )
            })?;
        if !response.status().is_success() {
            return Err(failure(
                StatusCode::BAD_GATEWAY,
                match response.status().as_u16() {
                    429 => "Pixabay is rate limiting searches. Wait a moment and try again.",
                    400 | 401 | 403 => {
                        "Pixabay refused the search. Ask your Studio administrator to check the API key."
                    }
                    _ => "Pixabay search is unavailable. Try again later.",
                },
            ));
        }
        if response
            .content_length()
            .is_some_and(|n| n > MAX_RESPONSE as u64)
        {
            return Err(failure(
                StatusCode::BAD_GATEWAY,
                "Pixabay returned too much data.",
            ));
        }
        let mut stream = response.bytes_stream();
        let mut bytes = Vec::new();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|_| {
                failure(
                    StatusCode::GATEWAY_TIMEOUT,
                    "Pixabay did not complete the search.",
                )
            })?;
            if chunk.len() > MAX_RESPONSE.saturating_sub(bytes.len()) {
                return Err(failure(
                    StatusCode::BAD_GATEWAY,
                    "Pixabay returned too much data.",
                ));
            }
            bytes.extend_from_slice(&chunk);
        }
        let body: Value = serde_json::from_slice(&bytes).map_err(|_| {
            failure(
                StatusCode::BAD_GATEWAY,
                "Pixabay returned an unreadable result.",
            )
        })?;
        if !body
            .get("hits")
            .and_then(Value::as_array)
            .is_some_and(|v| v.len() <= 20)
            || body.get("totalHits").and_then(Value::as_u64).is_none()
        {
            return Err(failure(
                StatusCode::BAD_GATEWAY,
                "Pixabay returned an invalid search result.",
            ));
        }
        cache.insert(
            cache_key,
            Cached {
                at: Instant::now(),
                body: body.clone(),
            },
        );
        Ok(body)
    }
}
fn parameters(query: &str, kind: &str, page: u32) -> Result<Vec<(String, String)>> {
    if !["image", "video"].contains(&kind) {
        return Err(failure(StatusCode::BAD_REQUEST, "Choose images or videos."));
    }
    let mut values = vec![
        ("per_page".into(), "20".into()),
        ("page".into(), page.clamp(1, 25).to_string()),
        ("safesearch".into(), "true".into()),
    ];
    if query.contains("://") {
        let url = reqwest::Url::parse(query)
            .map_err(|_| failure(StatusCode::BAD_REQUEST, "Paste a Pixabay asset page link."))?;
        if url.scheme() != "https"
            || !matches!(url.host_str(), Some("pixabay.com" | "www.pixabay.com"))
            || !url.username().is_empty()
            || url.password().is_some()
            || url.port().is_some()
        {
            return Err(failure(
                StatusCode::BAD_REQUEST,
                "Paste a Pixabay asset page link.",
            ));
        }
        if (kind == "video") != url.path().contains("/videos/") {
            return Err(failure(
                StatusCode::BAD_REQUEST,
                "Choose the matching media type for this Pixabay link.",
            ));
        }
        let id = url
            .path()
            .trim_end_matches('/')
            .rsplit('-')
            .next()
            .unwrap_or("");
        if id.is_empty() || id.len() > 16 || !id.bytes().all(|b| b.is_ascii_digit()) {
            return Err(failure(
                StatusCode::BAD_REQUEST,
                "This Pixabay link does not identify an asset.",
            ));
        }
        values.push(("id".into(), id.into()));
    } else {
        if query.chars().count() > 100 {
            return Err(failure(
                StatusCode::BAD_REQUEST,
                "Pixabay searches can contain at most 100 characters.",
            ));
        }
        values.push(("q".into(), query.into()));
    }
    Ok(values)
}

#[cfg(test)]
#[path = "map_pixabay_tests.rs"]
mod tests;
