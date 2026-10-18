use super::{
    NativeHost,
    boundary::{Failure, Result, body, cookie, token},
};
use aether_identity::{NewAccount, Role};
use axum::{
    Json,
    extract::{ConnectInfo, State, rejection::JsonRejection},
    http::{HeaderMap, StatusCode, header::SET_COOKIE},
    response::{IntoResponse, Response},
};
use serde::Deserialize;
use serde_json::{Value, json};
use std::net::SocketAddr;
use zeroize::Zeroizing;

type Input<T> = std::result::Result<Json<T>, JsonRejection>;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Login {
    username: String,
    password: Zeroizing<String>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Empty {}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Password {
    current_password: Zeroizing<String>,
    password: Zeroizing<String>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Profile {
    current_password: Zeroizing<String>,
    full_name: String,
    email: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct CreateUser {
    username: String,
    password: Zeroizing<String>,
    role: Role,
    full_name: String,
    email: String,
}
#[derive(Deserialize)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
pub(super) enum AdminUser {
    Update {
        id: String,
        role: Role,
        active: bool,
    },
    ResetPassword {
        id: String,
        password: Zeroizing<String>,
    },
    RevokeSessions {
        id: String,
    },
}
fn ok() -> Json<Value> {
    Json(json!({"ok":true}))
}
fn with_cookie(host: &NativeHost, value: &str) -> Response {
    ([(SET_COOKIE, cookie(host, value))], ok()).into_response()
}
pub(super) async fn health() -> Json<Value> {
    Json(json!({"status":"ok","authority":"native_identity","applications_ready":false}))
}
pub(super) async fn ready(State(host): State<NativeHost>) -> Result<Json<Value>> {
    host.identity.check_schema().await?;
    if let Some(settings) = &host.settings {
        settings.check_schema().await?;
    }
    if let Some(documents) = &host.documents {
        documents.check_schema().await?;
    }
    Ok(Json(
        json!({"status":"ok","identity_ready":true,"documents_ready":host.documents.is_some(),"applications_ready":false}),
    ))
}
pub(super) async fn session(
    State(host): State<NativeHost>,
    headers: HeaderMap,
) -> Result<Json<Value>> {
    let user = host.identity.session_profile(&token(&headers)?).await?;
    Ok(Json(json!({"user":user})))
}
pub(super) async fn login(
    State(host): State<NativeHost>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    input: Input<Login>,
) -> Result<Response> {
    let input = body(input)?;
    let session = host
        .identity
        .sign_in(&input.username, &input.password, &peer.ip().to_string())
        .await?;
    Ok(with_cookie(&host, session.expose()))
}
pub(super) async fn logout(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: Input<Empty>,
) -> Result<Response> {
    body(input)?;
    host.identity.sign_out(&token(&headers)?).await?;
    Ok(with_cookie(&host, ""))
}
pub(super) async fn password(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: Input<Password>,
) -> Result<Response> {
    let input = body(input)?;
    host.identity
        .change_password(&token(&headers)?, &input.current_password, &input.password)
        .await?;
    Ok(with_cookie(&host, ""))
}
pub(super) async fn profile(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: Input<Profile>,
) -> Result<Json<Value>> {
    let input = body(input)?;
    host.identity
        .update_profile(
            &token(&headers)?,
            &input.current_password,
            &input.full_name,
            &input.email,
        )
        .await?;
    Ok(ok())
}
pub(super) async fn create_user(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: Input<CreateUser>,
) -> Result<Json<Value>> {
    let input = body(input)?;
    let account = NewAccount {
        username: input.username,
        role: input.role,
        must_change: true,
        full_name: input.full_name,
        email: input.email,
    };
    let user = host
        .identity
        .create_user(&token(&headers)?, &account, &input.password)
        .await?;
    Ok(Json(json!({"ok":true,"user":user})))
}
pub(super) async fn admin_user(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: Input<AdminUser>,
) -> Result<Json<Value>> {
    let input = body(input)?;
    let session = token(&headers)?;
    match input {
        AdminUser::Update { id, role, active } => {
            host.identity
                .set_account_state(&session, &id, role, active)
                .await?
        }
        AdminUser::ResetPassword { id, password } => {
            host.identity
                .reset_password(&session, &id, &password)
                .await?
        }
        AdminUser::RevokeSessions { id } => host.identity.revoke_sessions(&session, &id).await?,
    }
    Ok(ok())
}
pub(super) async fn not_found() -> Response {
    Failure::new(
        StatusCode::NOT_FOUND,
        "not_found",
        "This route is not available on the native identity host.",
    )
    .into_response()
}
pub(super) async fn method_not_allowed() -> Response {
    Failure::new(
        StatusCode::METHOD_NOT_ALLOWED,
        "invalid_method",
        "This method is not supported.",
    )
    .into_response()
}

pub(super) async fn preferences(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: Input<aether_identity::PreferencePatch>,
) -> Result<Json<Value>> {
    let input = body(input)?;
    host.identity
        .update_preferences(&token(&headers)?, &input)
        .await?;
    Ok(ok())
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct AppEnabled {
    id: String,
    enabled: bool,
}
pub(super) async fn app_enabled(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: Input<AppEnabled>,
) -> Result<Json<Value>> {
    let input = body(input)?;
    if !host.catalog.iter().any(|app| app.id == input.id) {
        return Err(crate::documents::Error::Invalid.into());
    }
    host.documents
        .as_ref()
        .ok_or(crate::documents::Error::Unavailable)?
        .set_app_enabled(&token(&headers)?, &input.id, input.enabled)
        .await?;
    Ok(ok())
}
