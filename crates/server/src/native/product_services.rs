//! Browser-only CAD compatibility routes; product packages own their semantics.
use super::{
    NativeHost,
    boundary::{Failure, Result, body, token},
};
use crate::documents::Error;
use axum::{
    Json,
    extract::{Path, State, rejection::JsonRejection},
    http::{HeaderMap, StatusCode},
};
use serde_json::Value;
pub(super) async fn cad(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    Path(action): Path<String>,
    input: std::result::Result<Json<Value>, JsonRejection>,
) -> Result<Json<Value>> {
    let token = token(&headers)?;
    let user = host.identity.authenticate(&token).await?;
    if user.must_change {
        return Err(aether_identity::Error::Forbidden.into());
    }
    if !matches!(
        action.as_str(),
        "geometry" | "export" | "analysis" | "assembly" | "assembly-compose" | "mate-kinds" | "engine"
    ) {
        return Err(Failure::new(
            StatusCode::NOT_FOUND,
            "not_found",
            "Unknown CAD operation.",
        ));
    }
    let input = body(input)?;
    let docs = host.documents.as_ref().ok_or(Error::Unavailable)?;
    match docs
        .product_service(&token, "cad", &format!("/api/cad/{action}"), &input)
        .await
    {
        Ok(result) => Ok(Json(result)),
        Err(error) => Err(match error {
            Error::Invalid => Failure::new(
                StatusCode::BAD_REQUEST,
                "invalid_input",
                "Invalid CAD request.",
            ),
            Error::TooLarge => Failure::new(
                StatusCode::PAYLOAD_TOO_LARGE,
                "too_large",
                "CAD request or result exceeds the supported limit.",
            ),
            Error::Unavailable | Error::Incompatible | Error::Unsupported => Failure::new(
                StatusCode::SERVICE_UNAVAILABLE,
                "unavailable",
                "The CAD service is unavailable. Ask the server administrator to check the installed CAD runtime.",
            ),
            error => error.into(),
        }),
    }
}
