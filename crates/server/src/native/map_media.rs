use super::{
    NativeHost,
    boundary::{Failure, Result, device_token, token},
};
use crate::documents::{Error, map_media::mime};
use axum::{
    Json,
    body::Body,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use serde_json::{Value, json};

pub(super) async fn upload(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    Path(name): Path<String>,
    body: Body,
) -> Result<Json<Value>> {
    let session = token(&headers)?;
    let mut lengths = headers.get_all("content-length").iter();
    let size = lengths
        .next()
        .and_then(|v| v.to_str().ok())
        .filter(|s| !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit()))
        .and_then(|s| s.parse::<usize>().ok())
        .ok_or(Error::Invalid)?;
    if lengths.next().is_some() {
        return Err(Error::Invalid.into());
    }
    host.documents
        .as_ref()
        .ok_or(Error::Unavailable)?
        .map_media_upload(&session, &name, size, body)
        .await?;
    Ok(Json(json!({"name":name,"bytes":size})))
}
pub(super) async fn delete(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    Path(name): Path<String>,
) -> Result<Json<Value>> {
    let session = token(&headers)?;
    host.documents
        .as_ref()
        .ok_or(Error::Unavailable)?
        .map_media_delete(&session, &name)
        .await?;
    Ok(Json(json!({"name":name,"deleted":true})))
}
// Single byte ranges include suffix requests used by browser media decoders.
fn range(headers: &HeaderMap, length: usize) -> std::result::Result<Option<(usize, usize)>, ()> {
    let mut values = headers.get_all("range").iter();
    let Some(value) = values.next() else {
        return Ok(None);
    };
    if values.next().is_some() {
        return Err(());
    }
    let (start, end) = value
        .to_str()
        .map_err(|_| ())?
        .strip_prefix("bytes=")
        .ok_or(())?
        .split_once('-')
        .ok_or(())?;
    if !start.bytes().all(|b| b.is_ascii_digit()) || !end.bytes().all(|b| b.is_ascii_digit()) {
        return Err(());
    }
    if start.is_empty() {
        let count = end.parse::<usize>().map_err(|_| ())?;
        if count == 0 || length == 0 {
            return Err(());
        }
        return Ok(Some((length.saturating_sub(count), length)));
    }
    let start = start.parse::<usize>().map_err(|_| ())?;
    let end = if end.is_empty() {
        length
    } else {
        end.parse::<usize>()
            .map_err(|_| ())?
            .saturating_add(1)
            .min(length)
    };
    if start >= end || start >= length {
        return Err(());
    }
    Ok(Some((start, end)))
}
pub(super) async fn read(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    Path(name): Path<String>,
) -> Result<Response> {
    let docs = host.documents.as_ref().ok_or(Error::Unavailable)?;
    let content = if headers.contains_key("authorization") {
        let credential = device_token(&headers, true)?.ok_or(Error::Denied)?;
        docs.map_device_media(&credential, &name).await?
    } else {
        docs.map_media_read(&token(&headers)?, &name).await?
    };
    let length = content.len();
    let (status, start, end) = match range(&headers, length) {
        Ok(None) => (StatusCode::OK, 0, length),
        Ok(Some((start, end))) => (StatusCode::PARTIAL_CONTENT, start, end),
        Err(()) => {
            let mut response = Failure::new(
                StatusCode::RANGE_NOT_SATISFIABLE,
                "invalid_range",
                "Unsupported or out-of-bounds byte range.",
            )
            .into_response();
            response.headers_mut().insert(
                "content-range",
                format!("bytes */{length}").parse().unwrap(),
            );
            return Ok(response);
        }
    };
    let mut builder = Response::builder()
        .status(status)
        .header("content-type", mime(&name).ok_or(Error::Invalid)?)
        .header("content-length", end - start)
        .header("accept-ranges", "bytes")
        .header("content-security-policy", "sandbox; default-src 'none'");
    if status == StatusCode::PARTIAL_CONTENT {
        builder = builder.header(
            "content-range",
            format!("bytes {start}-{}/{length}", end - 1),
        );
    }
    builder
        .body(content.body(start, end))
        .map_err(|_| Error::Incompatible.into())
}
