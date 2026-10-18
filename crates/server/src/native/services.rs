use super::{
    NativeHost,
    boundary::{Result, body, token},
};
use crate::documents::Error;
use aether_identity::automation::AgentConnectionInput;
use axum::{
    Json,
    extract::{State, rejection::JsonRejection},
    http::HeaderMap,
};
use serde::Deserialize;
use serde_json::{Value, json};
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Create {
    name: String,
    apps: Vec<String>,
    days: u32,
    #[serde(default)]
    can_write: bool,
    #[serde(default)]
    can_edit_content: bool,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Revoke {
    id: String,
    action: String,
}
pub(super) async fn change(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: std::result::Result<Json<Value>, JsonRejection>,
) -> Result<Json<Value>> {
    let session = token(&headers)?;
    let data = body(input)?;
    if data.get("action").is_some() {
        let request: Revoke = serde_json::from_value(data).map_err(|_| Error::Invalid)?;
        if request.action != "revoke" {
            return Err(Error::Invalid.into());
        }
        host.identity
            .revoke_service_connection(&session, &request.id)
            .await?;
        return Ok(Json(json!({"ok":true})));
    }
    let request: Create = serde_json::from_value(data).map_err(|_| Error::Invalid)?;
    if !(1..=365).contains(&request.days) {
        return Err(Error::Invalid.into());
    }
    let input = AgentConnectionInput {
        label: request.name,
        apps: request.apps,
        lifetime_hours: request.days * 24,
        can_write: request.can_write,
        can_edit_content: request.can_edit_content,
    };
    Ok(Json(
        host.documents
            .as_ref()
            .ok_or(Error::Unavailable)?
            .services(&session, Some(&input))
            .await?,
    ))
}
