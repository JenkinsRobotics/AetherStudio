use super::{
    NativeHost,
    boundary::{Failure, Result, body, token},
    presentation::Theme,
};
use crate::settings::{Change, Error, Settings};
use axum::{
    Json,
    extract::{State, rejection::JsonRejection},
    http::{HeaderMap, StatusCode},
};
use serde_json::{Value, json};

impl From<Error> for Failure {
    fn from(error: Error) -> Self {
        match error {
            Error::Identity(error) => error.into(),
            Error::Invalid => Self::new(
                StatusCode::BAD_REQUEST,
                "invalid_input",
                "Invalid server settings.",
            ),
            Error::Conflict => Self::new(
                StatusCode::CONFLICT,
                "conflict",
                "Server settings changed. Reload before saving.",
            ),
            Error::Unavailable | Error::Incompatible => Self::new(
                StatusCode::SERVICE_UNAVAILABLE,
                "unavailable",
                "Server settings are unavailable.",
            ),
            Error::OutcomeUnknown => aether_identity::Error::OutcomeUnknown.into(),
        }
    }
}
fn service(host: &NativeHost) -> Result<&Settings> {
    host.settings.as_ref().ok_or_else(|| {
        Failure::new(
            StatusCode::NOT_IMPLEMENTED,
            "unsupported",
            "Persistent server settings are not configured.",
        )
    })
}
pub(super) async fn read(
    State(host): State<NativeHost>,
    headers: HeaderMap,
) -> Result<Json<Value>> {
    let value = service(&host)?.read(&token(&headers)?).await?;
    Ok(Json(
        json!({"settings":value,"restart_required":false,"network_settings_supported":false}),
    ))
}
pub(super) async fn change(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: std::result::Result<Json<Change>, JsonRejection>,
) -> Result<Json<Value>> {
    let input = body(input)?;
    let value = service(&host)?.change(&token(&headers)?, &input).await?;
    Ok(Json(
        json!({"ok":true,"settings":value,"restart_required":false}),
    ))
}
pub(super) async fn theme(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: std::result::Result<Json<Theme>, JsonRejection>,
) -> Result<Json<Value>> {
    let input = body(input)?;
    service(&host)?.theme(&token(&headers)?, &input).await?;
    Ok(Json(json!({"ok":true})))
}
