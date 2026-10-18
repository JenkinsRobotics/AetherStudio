//! Separate device bearer authority from browser sessions and agent grants.
use super::{
    NativeHost,
    boundary::{Result, body, device_token, token},
};
use crate::documents::{
    Error,
    map_devices::{Announcement, PlayerSignal, Request},
};
use axum::{
    Json,
    extract::{Path, State, rejection::JsonRejection},
    http::HeaderMap,
};
use serde_json::{Value, json};

pub(super) async fn announce(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: std::result::Result<Json<Announcement>, JsonRejection>,
) -> Result<Json<Value>> {
    let credential = device_token(&headers, false)?;
    Ok(Json(
        host.documents
            .as_ref()
            .ok_or(Error::Unavailable)?
            .map_announce(&body(input)?, credential.as_deref().map(|s| s.as_str()))
            .await?,
    ))
}
pub(super) async fn show(
    State(host): State<NativeHost>,
    headers: HeaderMap,
) -> Result<Json<Value>> {
    let credential = device_token(&headers, true)?.ok_or(aether_identity::Error::Unauthorized)?;
    Ok(Json(
        host.documents
            .as_ref()
            .ok_or(Error::Unavailable)?
            .map_device_show(&credential)
            .await?,
    ))
}
pub(super) async fn list(
    State(host): State<NativeHost>,
    headers: HeaderMap,
) -> Result<Json<Value>> {
    let token = token(&headers)?;
    Ok(Json(
        host.documents
            .as_ref()
            .ok_or(Error::Unavailable)?
            .map_device_action(&token, &Request::List)
            .await?,
    ))
}
pub(super) async fn action(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    Path(action): Path<String>,
    input: std::result::Result<Json<Value>, JsonRejection>,
) -> Result<Json<Value>> {
    let token = token(&headers)?;
    let mut input = body(input)?;
    let object = input.as_object_mut().ok_or(Error::Invalid)?;
    if object.contains_key("action") {
        return Err(Error::Invalid.into());
    }
    object.insert("action".into(), json!(action));
    let request: Request = serde_json::from_value(input).map_err(|_| Error::Invalid)?;
    Ok(Json(
        host.documents
            .as_ref()
            .ok_or(Error::Unavailable)?
            .map_device_action(&token, &request)
            .await?,
    ))
}

pub(super) async fn cast_read(
    State(host): State<NativeHost>,
    headers: HeaderMap,
) -> Result<Json<Value>> {
    let credential = device_token(&headers, true)?.ok_or(aether_identity::Error::Unauthorized)?;
    Ok(Json(
        host.documents
            .as_ref()
            .ok_or(Error::Unavailable)?
            .map_player_cast(&credential, None)
            .await?,
    ))
}
pub(super) async fn cast_write(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: std::result::Result<Json<PlayerSignal>, JsonRejection>,
) -> Result<Json<Value>> {
    let credential = device_token(&headers, true)?.ok_or(aether_identity::Error::Unauthorized)?;
    Ok(Json(
        host.documents
            .as_ref()
            .ok_or(Error::Unavailable)?
            .map_player_cast(&credential, Some(&body(input)?))
            .await?,
    ))
}
