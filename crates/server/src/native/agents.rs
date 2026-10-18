use super::{
    NativeHost,
    boundary::{Failure, Result, body, token},
};
use crate::agents::{Authority, Error};
use axum::{
    Json,
    extract::{Path, State, rejection::JsonRejection},
    http::{HeaderMap, StatusCode},
};
use serde_json::Value;
impl From<Error> for Failure {
    fn from(error: Error) -> Self {
        if error == Error::OutcomeUnknown {
            return aether_identity::Error::OutcomeUnknown.into();
        }
        let (status, code, message) = match error {
            Error::Invalid => (
                StatusCode::BAD_REQUEST,
                "invalid_input",
                "Invalid agent request.",
            ),
            Error::Forbidden => (
                StatusCode::FORBIDDEN,
                "forbidden",
                "This account cannot perform that agent operation.",
            ),
            Error::NotFound => (
                StatusCode::NOT_FOUND,
                "not_found",
                "Agent request not found.",
            ),
            Error::Conflict => (
                StatusCode::CONFLICT,
                "conflict",
                "Enable and connect the provider first, or wait for the current request to stop.",
            ),
            Error::Busy => (
                StatusCode::TOO_MANY_REQUESTS,
                "busy",
                "The agent service is busy. Try again shortly.",
            ),
            Error::Unavailable => (
                StatusCode::SERVICE_UNAVAILABLE,
                "unavailable",
                "The Studio agent runtime is unavailable.",
            ),
            Error::OutcomeUnknown => unreachable!("handled above"),
            Error::Unsupported => (
                StatusCode::NOT_IMPLEMENTED,
                "unsupported",
                "This provider runtime has not been migrated to the native host.",
            ),
        };
        Self::new(status, code, message)
    }
}
pub(super) async fn dispatch(
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
    let data = body(input)?;
    if !data.is_object() {
        return Err(Error::Invalid.into());
    }
    let Some(agents) = &host.agents else {
        if action == "catalog" && data.as_object().is_some_and(|m| m.is_empty()) {
            return Ok(Json(crate::agents::unavailable_catalog()));
        }
        return Err(Error::Unsupported.into());
    };
    let app = if action == "chat" {
        Some(
            data["app"]
                .as_str()
                .filter(|s| !s.is_empty() && s.len() <= 64)
                .ok_or(Error::Invalid)?
                .to_owned(),
        )
    } else {
        None
    };
    let authority = Authority {
        identity: host.identity.clone(),
        documents: host.documents.clone(),
        token,
        app,
    };
    Ok(Json(agents.dispatch(authority, &action, data).await?))
}
