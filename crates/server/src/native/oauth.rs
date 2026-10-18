use super::{
    NativeHost,
    boundary::{self, Failure, Result},
};
use aether_identity::{
    automation::AgentConnectionInput,
    oauth::{Authorization, Exchange, Registration},
};
use axum::{
    Form, Json,
    extract::{
        Path, Query, State,
        rejection::{FormRejection, JsonRejection, QueryRejection},
    },
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Redirect, Response},
};
use serde::Deserialize;
use serde_json::{Value, json};

pub(super) fn resource(host: &NativeHost) -> String {
    format!("{}/mcp", host.origin)
}
pub(super) async fn metadata(State(host): State<NativeHost>) -> Json<Value> {
    Json(
        json!({"resource":resource(&host),"authorization_servers":[host.origin],"bearer_methods_supported":["header"],"scopes_supported":["aether"],"resource_name":"Aether Studio"}),
    )
}
pub(super) async fn issuer(State(host): State<NativeHost>) -> Json<Value> {
    let origin = &host.origin;
    Json(
        json!({"issuer":origin,"authorization_endpoint":format!("{origin}/oauth/authorize"),"token_endpoint":format!("{origin}/oauth/token"),"registration_endpoint":format!("{origin}/oauth/register"),"response_types_supported":["code"],"grant_types_supported":["authorization_code"],"token_endpoint_auth_methods_supported":["none"],"code_challenge_methods_supported":["S256"],"scopes_supported":["aether"]}),
    )
}
fn anonymous(headers: &HeaderMap) -> Result<()> {
    if headers.contains_key("cookie") || headers.contains_key("authorization") {
        return Err(aether_identity::Error::Unauthorized.into());
    }
    Ok(())
}
pub(super) async fn register(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: std::result::Result<Json<Registration>, JsonRejection>,
) -> Result<Response> {
    anonymous(&headers)?;
    let client = host
        .identity
        .register_oauth_client(boundary::body(input)?)
        .await?;
    Ok((StatusCode::CREATED, Json(client)).into_response())
}
pub(super) async fn authorize(
    State(host): State<NativeHost>,
    input: std::result::Result<Query<Authorization>, QueryRejection>,
) -> Result<Redirect> {
    let Query(input) = input.map_err(|_| aether_identity::Error::InvalidInput)?;
    let id = host.identity.begin_oauth(&input, &resource(&host)).await?;
    Ok(Redirect::to(&format!(
        "{}/?agent-connect={id}",
        host.origin
    )))
}
pub(super) async fn exchange(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: std::result::Result<Form<Exchange>, FormRejection>,
) -> Response {
    if anonymous(&headers).is_err() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error":"invalid_request"})),
        )
            .into_response();
    }
    let Ok(Form(input)) = input else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error":"invalid_request"})),
        )
            .into_response();
    };
    match host.identity.exchange_oauth(&input,&resource(&host)).await {
        Ok((token,seconds)) => Json(json!({"access_token":token.expose(),"token_type":"Bearer","expires_in":seconds,"scope":"aether"})).into_response(),
        Err(aether_identity::Error::Unauthorized | aether_identity::Error::InvalidInput) => (StatusCode::BAD_REQUEST,Json(json!({"error":"invalid_grant"}))).into_response(),
        Err(e) => Failure::from(e).into_response(),
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct ConsentInput {
    request: String,
    access: Option<AgentConnectionInput>,
}
pub(super) async fn consent(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    Path(action): Path<String>,
    input: std::result::Result<Json<ConsentInput>, JsonRejection>,
) -> Result<Json<Value>> {
    let session = boundary::token(&headers)?;
    let input = boundary::body(input)?;
    let docs = host
        .documents
        .as_ref()
        .ok_or(crate::documents::Error::Unavailable)?;
    Ok(Json(
        docs.automation_authorization(
            &session,
            &input.request,
            &resource(&host),
            &action,
            input.access.as_ref(),
        )
        .await?,
    ))
}
