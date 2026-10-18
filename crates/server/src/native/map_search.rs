//! Compatibility transport for Map's Online Library. Only the fixed
//! provider endpoints are queried; Studio credentials never leave this host.
use super::{
    NativeHost,
    boundary::{Failure, Result, token},
};
use axum::{
    Json,
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
};
use futures_util::StreamExt;
use serde::Deserialize;
use serde_json::{Value, json};
use std::time::Duration;

const ENDPOINT: &str = "https://api.openverse.org/v1/images/";
const MAX_RESPONSE: usize = 2 * 1024 * 1024;
#[derive(Default, Deserialize)]
pub(super) struct Search {
    #[serde(default)]
    q: String,
    page: Option<String>,
    provider: Option<String>,
    kind: Option<String>,
}
fn failure(status: StatusCode, message: &str) -> Failure {
    Failure::new(status, "asset_search_failed", message)
}
pub(super) fn client() -> std::result::Result<reqwest::Client, reqwest::Error> {
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(15))
        .connect_timeout(Duration::from_secs(5))
        .user_agent("AetherMap/1.0 (+https://github.com/aether-studio)")
        .build()
}
async fn authorize(host: &NativeHost, session: &str) -> Result<()> {
    let (status, apps) = host
        .documents
        .as_ref()
        .ok_or(crate::documents::Error::Unavailable)?
        .application_status(Some(session), &["map"])
        .await?;
    let user = status
        .user
        .ok_or_else(|| failure(StatusCode::UNAUTHORIZED, "Sign in to search media."))?;
    if user.must_change || !apps.iter().any(|app| app == "map") {
        return Err(failure(
            StatusCode::FORBIDDEN,
            "Aether Map access is required.",
        ));
    }
    Ok(())
}
fn parameters(input: Search) -> Result<(String, u32)> {
    let query = input.q.trim().to_owned();
    if query.len() > 2048 || query.chars().count() > 512 || query.chars().any(char::is_control) {
        return Err(failure(
            StatusCode::BAD_REQUEST,
            "Use a search of at most 512 characters.",
        ));
    }
    let page = input
        .page
        .as_deref()
        .and_then(|v| v.trim().parse::<i64>().ok())
        .unwrap_or(1)
        .clamp(1, 50) as u32;
    Ok((query, page))
}
async fn fetch(client: &reqwest::Client, endpoint: &str, query: &str, page: u32) -> Result<Value> {
    let response = client
        .get(endpoint)
        .query(&[
            ("q", query),
            ("page", &page.to_string()),
            ("page_size", "20"),
            ("license_type", "all-cc"),
        ])
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|_| {
            failure(
                StatusCode::GATEWAY_TIMEOUT,
                "Could not reach Openverse. Check this machine's connection.",
            )
        })?;
    if !response.status().is_success() {
        return Err(failure(
            StatusCode::BAD_GATEWAY,
            if response.status().as_u16() == 429 {
                "Openverse is rate limiting searches. Wait a moment and try again."
            } else {
                "Openverse refused the search. Try again later."
            },
        ));
    }
    if response
        .content_length()
        .is_some_and(|length| length > MAX_RESPONSE as u64)
    {
        return Err(failure(
            StatusCode::BAD_GATEWAY,
            "Openverse returned too much data.",
        ));
    }
    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| {
            failure(
                StatusCode::GATEWAY_TIMEOUT,
                "Openverse did not complete the search.",
            )
        })?;
        if chunk.len() > MAX_RESPONSE.saturating_sub(bytes.len()) {
            return Err(failure(
                StatusCode::BAD_GATEWAY,
                "Openverse returned too much data.",
            ));
        }
        bytes.extend_from_slice(&chunk);
    }
    let value: Value = serde_json::from_slice(&bytes).map_err(|_| {
        failure(
            StatusCode::BAD_GATEWAY,
            "Openverse returned something unreadable.",
        )
    })?;
    if !value
        .get("results")
        .and_then(Value::as_array)
        .is_some_and(|items| items.len() <= 20)
        || ["result_count", "page", "page_count"]
            .iter()
            .any(|key| value.get(key).and_then(Value::as_u64).is_none())
    {
        return Err(failure(
            StatusCode::BAD_GATEWAY,
            "Openverse returned an invalid search result.",
        ));
    }
    Ok(value)
}
pub(super) async fn search(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    Query(input): Query<Search>,
) -> Result<Json<Value>> {
    let session = token(&headers)?;
    authorize(&host, &session).await?;
    let provider = input.provider.clone().unwrap_or_else(|| "openverse".into());
    let kind = input.kind.clone().unwrap_or_else(|| "video".into());
    if !["openverse", "pixabay"].contains(&provider.as_str()) {
        return Err(failure(
            StatusCode::BAD_REQUEST,
            "Choose a supported asset provider.",
        ));
    }
    let (query, page) = parameters(input)?;
    if query.is_empty() {
        return Ok(Json(
            json!({"results":[], "result_count":0, "page":1, "page_count":0}),
        ));
    }
    let result = if provider == "pixabay" {
        host.map_pixabay
            .search(&host.map_search_client, &query, &kind, page)
            .await
    } else {
        fetch(&host.map_search_client, ENDPOINT, &query, page).await
    };
    // Network IO never holds identity/ACL locks. Recheck before returning data.
    authorize(&host, &session).await?;
    result.map(Json)
}

#[cfg(test)]
#[path = "map_search_tests.rs"]
mod tests;
