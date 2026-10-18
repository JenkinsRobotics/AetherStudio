//! Incremental gateway plus a separately configured native identity host.
pub mod agents;
pub mod attachments;
pub mod backup;
pub mod documents;
pub mod mail;
pub mod native;
pub mod products;
pub mod settings;
pub mod workspace_assets;
use aether_protocol_core::studio_commands::{
    self, CommandProfileCatalog, ProfiledCommand, STUDIO_COMMAND_PROFILE_VERSION,
    SavedDocumentEffect,
};
use aether_protocol_core::{
    Capabilities, CommandCatalog, CommandError, CommandRequest, CommandResponse, ErrorCode,
    ExecutionState, MAX_REQUEST_BYTES, MAX_RESPONSE_BYTES, PROTOCOL_VERSION,
};
use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State, rejection::JsonRejection},
    http::{HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde_json::{Value, json};
use std::{sync::Arc, time::Duration};
use tokio::sync::Semaphore;

#[derive(Clone)]
pub struct Gateway {
    inner: Arc<Inner>,
}
struct Inner {
    upstream: String,
    client: reqwest::Client,
    admission: Arc<Semaphore>,
}

impl Gateway {
    pub fn new(upstream: &str, max_in_flight: usize, timeout: Duration) -> Result<Self, String> {
        let url = reqwest::Url::parse(upstream).map_err(|_| "Invalid upstream URL.")?;
        // An operator-selected, literal local origin only. No proxy env or redirects.
        if url.scheme() != "http"
            || url.host_str() != Some("127.0.0.1")
            || url.port_or_known_default().is_none()
            || !url.username().is_empty()
            || url.password().is_some()
            || url.query().is_some()
            || url.fragment().is_some()
            || url.path() != "/"
        {
            return Err("Upstream must be a literal http://127.0.0.1:PORT origin.".into());
        }
        if !(1..=256).contains(&max_in_flight)
            || timeout.is_zero()
            || timeout > Duration::from_secs(120)
        {
            return Err(
                "Use 1–256 in-flight commands and a timeout of at most 120 seconds.".into(),
            );
        }
        let client = reqwest::Client::builder()
            .no_proxy()
            .retry(reqwest::retry::never())
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_secs(2).min(timeout))
            .timeout(timeout)
            .build()
            .map_err(|_| "Could not create upstream transport.")?;
        Ok(Self {
            inner: Arc::new(Inner {
                upstream: upstream.trim_end_matches('/').into(),
                client,
                admission: Arc::new(Semaphore::new(max_in_flight)),
            }),
        })
    }

    async fn forward(
        &self,
        headers: &HeaderMap,
        action: &str,
        body: Value,
    ) -> Result<Reply, Failure> {
        let authorization = agent_header(headers)?;
        let _permit = self
            .inner
            .admission
            .clone()
            .try_acquire_owned()
            .map_err(|_| {
                Failure::new(
                    StatusCode::TOO_MANY_REQUESTS,
                    ErrorCode::Busy,
                    "The command gateway is busy. No command was sent.",
                    ExecutionState::NotStarted,
                )
            })?;
        let mut upstream = self
            .inner
            .client
            .post(format!(
                "{}/api/automation/commands/{action}",
                self.inner.upstream
            ))
            .header("Authorization", authorization)
            .json(&body)
            .send()
            .await
            .map_err(|_| uncertain(action))?;
        let status = upstream.status();
        if status.is_redirection() {
            return Err(uncertain(action));
        }
        let mut bytes = Vec::new();
        if upstream
            .content_length()
            .is_some_and(|n| n > MAX_RESPONSE_BYTES as u64)
        {
            return Err(uncertain(action));
        }
        while let Some(chunk) = upstream.chunk().await.map_err(|_| uncertain(action))? {
            if chunk.len() > MAX_RESPONSE_BYTES.saturating_sub(bytes.len()) {
                return Err(uncertain(action));
            }
            bytes.extend_from_slice(&chunk);
        }
        let body = serde_json::from_slice(&bytes).map_err(|_| uncertain(action))?;
        Ok(Reply { status, body })
    }
}
struct Reply {
    status: StatusCode,
    body: Value,
}
struct Failure {
    status: StatusCode,
    error: CommandError,
}
impl Failure {
    fn new(
        status: StatusCode,
        code: ErrorCode,
        message: impl Into<String>,
        execution: ExecutionState,
    ) -> Self {
        Self {
            status,
            error: CommandError::new(code, message, execution),
        }
    }
    fn typed(self, id: Option<String>) -> Response {
        (self.status, Json(CommandResponse::error(id, self.error))).into_response()
    }
    fn legacy(self) -> Response {
        (
            self.status,
            Json(json!({"error":self.error.message,"execution":self.error.execution})),
        )
            .into_response()
    }
}
fn uncertain(action: &str) -> Failure {
    if action == "run" {
        Failure::new(
            StatusCode::BAD_GATEWAY,
            ErrorCode::OutcomeUnknown,
            "The upstream command outcome is unknown. Inspect the saved revision before retrying; this request was not replayed.",
            ExecutionState::Unknown,
        )
    } else {
        Failure::new(
            StatusCode::BAD_GATEWAY,
            ErrorCode::Unavailable,
            "The upstream command catalog is unavailable.",
            ExecutionState::NotStarted,
        )
    }
}
fn agent_header(headers: &HeaderMap) -> Result<HeaderValue, Failure> {
    // This stage serves local CLI/MCP clients only. A browser transport needs
    // its own trusted-origin/session boundary; do not silently strip Origin.
    if headers.contains_key("origin") {
        return Err(Failure::new(
            StatusCode::FORBIDDEN,
            ErrorCode::Forbidden,
            "Browser origins are not enabled on the migration gateway.",
            ExecutionState::NotStarted,
        ));
    }
    let values = headers.get_all("authorization").iter().collect::<Vec<_>>();
    if values.len() != 1 {
        return Err(unauthenticated());
    }
    let value = values[0].to_str().map_err(|_| unauthenticated())?;
    let token = value
        .strip_prefix("Bearer aether_agent_")
        .ok_or_else(unauthenticated)?;
    if token.is_empty()
        || value.len() > 512
        || !token
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"-_".contains(&c))
    {
        return Err(unauthenticated());
    }
    let mut value = values[0].clone();
    value.set_sensitive(true);
    Ok(value)
}
fn unauthenticated() -> Failure {
    Failure::new(
        StatusCode::UNAUTHORIZED,
        ErrorCode::Unauthenticated,
        "An Aether agent connection is required.",
        ExecutionState::NotStarted,
    )
}
fn rejected_json(error: JsonRejection) -> Failure {
    let status = if error.status() == StatusCode::UNPROCESSABLE_ENTITY {
        StatusCode::BAD_REQUEST
    } else {
        error.status()
    };
    Failure::new(
        status,
        ErrorCode::InvalidRequest,
        "Send a valid JSON command within the request size limit.",
        ExecutionState::NotStarted,
    )
}
fn upstream_failure(reply: Reply) -> Failure {
    let code = match reply.status {
        StatusCode::BAD_REQUEST
        | StatusCode::UNPROCESSABLE_ENTITY
        | StatusCode::PAYLOAD_TOO_LARGE => ErrorCode::InvalidRequest,
        StatusCode::UNAUTHORIZED => ErrorCode::Unauthenticated,
        StatusCode::FORBIDDEN => ErrorCode::Forbidden,
        StatusCode::NOT_FOUND => ErrorCode::NotFound,
        StatusCode::CONFLICT => ErrorCode::Conflict,
        _ => ErrorCode::UpstreamFailure,
    };
    // A server failure may follow a committed write. Never imply safe retry.
    let state = if reply.status.is_client_error() {
        ExecutionState::Rejected
    } else {
        ExecutionState::Unknown
    };
    let message = reply
        .body
        .get("error")
        .and_then(Value::as_str)
        .unwrap_or("The authority refused or could not finish the command.");
    Failure::new(
        reply.status,
        code,
        message.chars().take(1024).collect::<String>(),
        state,
    )
}

pub fn router(gateway: Gateway) -> Router {
    Router::new()
        .route(
            "/healthz",
            get(|| async { Json(json!({"status":"ok","storage_authority":"legacy"})) }),
        )
        .route(
            "/v1/capabilities",
            get(|| async { Json(Capabilities::default()) }),
        )
        .route("/v1/commands", get(catalog))
        .route("/v1/commands/profiles", get(profiles))
        .route("/v1/commands/run", post(run))
        // Existing CLI/MCP clients can opt into this origin without changed semantics.
        .route("/api/automation/commands/list", post(legacy_list))
        .route("/api/automation/commands/run", post(legacy_run))
        .layer(DefaultBodyLimit::max(MAX_REQUEST_BYTES))
        .with_state(gateway)
}
async fn catalog(State(g): State<Gateway>, headers: HeaderMap) -> Response {
    match g.forward(&headers, "list", json!({})).await {
        Ok(reply) if reply.status.is_success() => {
            match serde_json::from_value::<CommandCatalog>(reply.body) {
                Ok(c) if c.schema_version == 1 => (StatusCode::OK, Json(c)).into_response(),
                _ => uncertain("list").typed(None),
            }
        }
        Ok(reply) => upstream_failure(reply).typed(None),
        Err(error) => error.typed(None),
    }
}
// Authentication, app/grant filtering and revocation are rechecked by the
// authority for every discovery request. No static or cached public catalog.
async fn profiles(State(g): State<Gateway>, headers: HeaderMap) -> Response {
    match g.forward(&headers, "list", json!({})).await {
        Ok(reply) if reply.status.is_success() => {
            let Ok(catalog) = serde_json::from_value::<CommandCatalog>(reply.body) else {
                return uncertain("list").typed(None);
            };
            if catalog.schema_version != 1 {
                return uncertain("list").typed(None);
            }
            let mut commands = Vec::new();
            for descriptor in catalog.commands {
                let semantics = studio_commands::semantics(&descriptor.id);
                if let Some(s) = &semantics
                    && descriptor.writes != !matches!(s.effect, SavedDocumentEffect::Read)
                {
                    return uncertain("list").typed(None);
                }
                commands.push(ProfiledCommand {
                    descriptor,
                    semantics,
                });
            }
            Json(CommandProfileCatalog {
                protocol_version: PROTOCOL_VERSION,
                profile_version: STUDIO_COMMAND_PROFILE_VERSION,
                apps: catalog.apps,
                commands,
            })
            .into_response()
        }
        Ok(reply) => upstream_failure(reply).typed(None),
        Err(error) => error.typed(None),
    }
}
async fn run(
    State(g): State<Gateway>,
    headers: HeaderMap,
    request: Result<Json<CommandRequest>, JsonRejection>,
) -> Response {
    if let Err(error) = agent_header(&headers) {
        return error.typed(None);
    }
    let request = match request {
        Ok(Json(r)) => r,
        Err(e) => return rejected_json(e).typed(None),
    };
    if let Err(error) = request.validate() {
        return (
            StatusCode::BAD_REQUEST,
            Json(CommandResponse::error(Some(request.request_id), error)),
        )
            .into_response();
    }
    let invocation = if studio_commands::semantics(&request.command).is_some() {
        match studio_commands::decode_invocation(&request.command, &json!(request.arguments)) {
            Ok(invocation) if invocation.validate() => Some(invocation),
            _ => {
                return Failure::new(
                    StatusCode::BAD_REQUEST,
                    ErrorCode::InvalidRequest,
                    "Arguments do not match this Studio command's typed contract.",
                    ExecutionState::NotStarted,
                )
                .typed(Some(request.request_id));
            }
        }
    } else {
        None
    };
    let id = Some(request.request_id.clone());
    match g
        .forward(
            &headers,
            "run",
            json!({"id":request.command,"arguments":request.arguments}),
        )
        .await
    {
        Ok(reply) if reply.status.is_success() => {
            if reply.body.get("command").and_then(Value::as_str) != Some(request.command.as_str())
                || reply.body.get("result").is_none()
                || invocation.as_ref().is_some_and(|invocation| {
                    !studio_commands::validate_result(invocation, &reply.body["result"])
                })
            {
                return uncertain("run").typed(id);
            }
            Json(CommandResponse::Success {
                protocol_version: PROTOCOL_VERSION,
                request_id: request.request_id,
                command: request.command,
                result: reply.body["result"].clone(),
            })
            .into_response()
        }
        Ok(reply) => upstream_failure(reply).typed(id),
        Err(error) => error.typed(id),
    }
}
async fn legacy_list(
    State(g): State<Gateway>,
    headers: HeaderMap,
    request: Result<Json<Value>, JsonRejection>,
) -> Response {
    legacy(g, headers, request, "list").await
}
async fn legacy_run(
    State(g): State<Gateway>,
    headers: HeaderMap,
    request: Result<Json<Value>, JsonRejection>,
) -> Response {
    legacy(g, headers, request, "run").await
}
async fn legacy(
    g: Gateway,
    headers: HeaderMap,
    request: Result<Json<Value>, JsonRejection>,
    action: &str,
) -> Response {
    if let Err(e) = agent_header(&headers) {
        return e.legacy();
    }
    let body = match request {
        Ok(Json(v)) if v.is_object() => v,
        Ok(_) => {
            return Failure::new(
                StatusCode::BAD_REQUEST,
                ErrorCode::InvalidRequest,
                "Expected a JSON object.",
                ExecutionState::NotStarted,
            )
            .legacy();
        }
        Err(e) => return rejected_json(e).legacy(),
    };
    match g.forward(&headers, action, body).await {
        Ok(r) => (r.status, Json(r.body)).into_response(),
        Err(e) => e.legacy(),
    }
}
