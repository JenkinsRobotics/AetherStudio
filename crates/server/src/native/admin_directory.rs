use super::{
    NativeHost,
    boundary::{Result, body, token},
};
use crate::documents::{Documents, Error, admin_directory::TeamChange};
use axum::{
    Json,
    extract::{State, rejection::JsonRejection},
    http::HeaderMap,
};
use serde::Deserialize;
use serde_json::{Value, json};
fn service(host: &NativeHost) -> Result<&Documents> {
    Ok(host.documents.as_ref().ok_or(Error::Unavailable)?)
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Access {
    id: String,
    restricted: bool,
}
pub(super) async fn access(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: std::result::Result<Json<Access>, JsonRejection>,
) -> Result<Json<Value>> {
    let input = body(input)?;
    if !host
        .catalog
        .iter()
        .any(|app| app.id == input.id && !app.admin_only)
    {
        return Err(Error::Invalid.into());
    }
    service(&host)?
        .set_app_restricted(&token(&headers)?, &input.id, input.restricted)
        .await?;
    Ok(Json(json!({"ok":true})))
}
pub(super) async fn team(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: std::result::Result<Json<TeamChange>, JsonRejection>,
) -> Result<Json<Value>> {
    let input = body(input)?;
    if input.apps.as_ref().is_some_and(|apps| {
        apps.iter().any(|id| {
            !host
                .catalog
                .iter()
                .any(|app| &app.id == id && !app.admin_only)
        })
    }) {
        return Err(Error::Invalid.into());
    }
    let id = service(&host)?
        .admin_team(&token(&headers)?, &input)
        .await?;
    Ok(Json(json!({"ok":true,"id":id})))
}
pub(super) async fn read(
    State(host): State<NativeHost>,
    headers: HeaderMap,
) -> Result<Json<Value>> {
    Ok(Json(
        service(&host)?.admin_directory(&token(&headers)?).await?,
    ))
}
