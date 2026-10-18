use super::{
    NativeHost,
    boundary::{Failure, Result, agent_token, body, token},
};
use crate::documents::{Error, automation::Run};
use aether_identity::automation::AgentConnectionInput;
use axum::{
    Json,
    extract::{Path, State, rejection::JsonRejection},
    http::{HeaderMap, StatusCode},
};
use serde::Deserialize;
use serde_json::{Value, json};
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Revoke {
    id: String,
}
fn empty(value: &Value) -> Result<()> {
    if !value.as_object().is_some_and(|v| v.is_empty()) {
        return Err(Error::Invalid.into());
    }
    Ok(())
}
pub(super) async fn connections(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    Path(action): Path<String>,
    input: std::result::Result<Json<Value>, JsonRejection>,
) -> Result<Json<Value>> {
    let session = token(&headers)?;
    let user = host.identity.authenticate(&session).await?;
    if user.must_change {
        return Err(aether_identity::Error::Forbidden.into());
    }
    let data = body(input)?;
    let docs = host.documents.as_ref().ok_or(Error::Unavailable)?;
    let value = match action.as_str() {
        "list" => {
            empty(&data)?;
            docs.automation_connections(&session, None).await?
        }
        "create" => {
            let request: AgentConnectionInput =
                serde_json::from_value(data).map_err(|_| Error::Invalid)?;
            docs.automation_connections(&session, Some(&request))
                .await?
        }
        "revoke" => {
            let request: Revoke = serde_json::from_value(data).map_err(|_| Error::Invalid)?;
            host.identity
                .revoke_agent_connection(&session, &request.id)
                .await?;
            json!({"ok":true})
        }
        _ => {
            return Err(Failure::new(
                StatusCode::NOT_FOUND,
                "not_found",
                "Unknown connection operation.",
            ));
        }
    };
    Ok(Json(value))
}
pub(super) async fn commands(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    Path(action): Path<String>,
    input: std::result::Result<Json<Value>, JsonRejection>,
) -> Result<Json<Value>> {
    let key = agent_token(&headers)?;
    let docs = host.documents.as_ref().ok_or(Error::Unavailable)?;
    // Authenticate even unknown command names before exposing capabilities/errors.
    let catalog = docs.automation_catalog(&key).await?;
    let data = body(input)?;
    let value = match action.as_str() {
        "list" => {
            empty(&data)?;
            catalog
        }
        "run" => {
            let request: Run = serde_json::from_value(data).map_err(|_| Error::Invalid)?;
            docs.automation_run(key, request).await?
        }
        _ => {
            return Err(Failure::new(
                StatusCode::NOT_FOUND,
                "not_found",
                "Unknown command operation.",
            ));
        }
    };
    Ok(Json(value))
}

pub(super) async fn editor(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    Path(action): Path<String>,
    input: std::result::Result<Json<Value>, JsonRejection>,
) -> Result<Json<Value>> {
    let session = token(&headers)?;
    let docs = host.documents.as_ref().ok_or(Error::Unavailable)?;
    Ok(Json(
        docs.live_editor_browser(&session, &action, body(input)?)
            .await?,
    ))
}
