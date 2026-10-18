use super::{
    NativeHost,
    boundary::{Result, body, cookie, token},
    routes::Empty,
};
use axum::{
    Json,
    extract::{ConnectInfo, State, rejection::JsonRejection},
    http::{HeaderMap, header::SET_COOKIE},
    response::{IntoResponse, Response},
};
use serde::Deserialize;
use serde_json::{Value, json};
use std::net::SocketAddr;
use zeroize::Zeroizing;
fn service(host: &NativeHost) -> Result<&crate::mail::Mail> {
    Ok(host
        .mail
        .as_ref()
        .ok_or(crate::settings::Error::Unavailable)?)
}
pub(super) async fn read(
    State(host): State<NativeHost>,
    headers: HeaderMap,
) -> Result<Json<Value>> {
    Ok(Json(
        service(&host)?
            .settings
            .mail_read(&token(&headers)?)
            .await?,
    ))
}
pub(super) async fn events(
    State(host): State<NativeHost>,
    headers: HeaderMap,
) -> Result<Json<Value>> {
    Ok(Json(
        service(&host)?
            .settings
            .mail_events(&token(&headers)?)
            .await?,
    ))
}
pub(super) async fn change(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: std::result::Result<Json<crate::mail::Change>, JsonRejection>,
) -> Result<Json<Value>> {
    let mail = service(&host)?;
    let settings = mail
        .settings
        .mail_change(&token(&headers)?, body(input)?, &mail.vault)
        .await?;
    Ok(Json(json!({"ok":true,"mail":settings})))
}
pub(super) async fn test(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: std::result::Result<Json<Empty>, JsonRejection>,
) -> Result<Json<Value>> {
    body(input)?;
    service(&host)?
        .test(host.identity.clone(), token(&headers)?)
        .await?;
    Ok(Json(json!({"ok":true})))
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Request {
    account: String,
}
pub(super) async fn request(
    State(host): State<NativeHost>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    input: std::result::Result<Json<Request>, JsonRejection>,
) -> Result<Json<Value>> {
    let input = body(input)?;
    if input.account.len() > 1024 {
        return Err(aether_identity::Error::InvalidInput.into());
    }
    if let Some(mail) = &host.mail {
        mail.recovery(
            host.identity.clone(),
            input.account,
            peer.ip().to_string(),
            host.origin.clone(),
        )
        .await?;
    }
    Ok(Json(
        json!({"ok":true,"message":"If that account has an email address and delivery is configured, a recovery link will be sent. Check your inbox and spam folder."}),
    ))
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Reset {
    token: Zeroizing<String>,
    password: Zeroizing<String>,
}
pub(super) async fn reset(
    State(host): State<NativeHost>,
    input: std::result::Result<Json<Reset>, JsonRejection>,
) -> Result<Response> {
    let input = body(input)?;
    let recipient = host.identity.recovery_delivery(&input.token).await?;
    host.identity
        .recover_password(&input.token, &input.password)
        .await?;
    if let (Some(mail), Some(recipient)) = (&host.mail, recipient) {
        mail.password_changed(recipient).await;
    }
    Ok(([(SET_COOKIE, cookie(&host, ""))], Json(json!({"ok":true}))).into_response())
}
