use super::{COOKIE, NativeHost};
use aether_identity::Error;
use axum::{
    Json,
    extract::{Request, State, rejection::JsonRejection},
    http::{HeaderMap, HeaderValue, Method, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde::de::DeserializeOwned;
use serde_json::json;
use zeroize::Zeroizing;

pub(super) struct Failure(
    StatusCode,
    &'static str,
    String,
    &'static str,
    Option<serde_json::Value>,
);
impl Failure {
    pub(super) fn new(status: StatusCode, code: &'static str, message: impl Into<String>) -> Self {
        Self(status, code, message.into(), "rejected", None)
    }
}
impl Failure {
    pub(super) fn with_detail(mut self, detail: serde_json::Value) -> Self {
        self.4 = Some(detail);
        self
    }
}
impl From<Error> for Failure {
    fn from(error: Error) -> Self {
        let (status, code) = match error {
            Error::InvalidInput | Error::InvalidRecovery => {
                (StatusCode::BAD_REQUEST, "invalid_input")
            }
            Error::InvalidCredentials | Error::Unauthorized => {
                (StatusCode::UNAUTHORIZED, "unauthenticated")
            }
            Error::Forbidden => (StatusCode::FORBIDDEN, "forbidden"),
            Error::Conflict => (StatusCode::CONFLICT, "conflict"),
            Error::Throttled => (StatusCode::TOO_MANY_REQUESTS, "throttled"),
            Error::Busy => (StatusCode::SERVICE_UNAVAILABLE, "busy"),
            Error::Unavailable | Error::Incompatible => {
                (StatusCode::SERVICE_UNAVAILABLE, "unavailable")
            }
            Error::OutcomeUnknown => (StatusCode::SERVICE_UNAVAILABLE, "outcome_unknown"),
        };
        let mut failure = Self::new(status, code, error.to_string());
        if error == Error::OutcomeUnknown {
            failure.3 = "unknown";
        }
        failure
    }
}
impl IntoResponse for Failure {
    fn into_response(self) -> Response {
        let mut body = json!({"error":self.2,"code":self.1,"execution":self.3});
        if let Some(detail) = self.4 {
            body["detail"] = detail;
        }
        (self.0, Json(body)).into_response()
    }
}
pub(super) type Result<T> = std::result::Result<T, Failure>;

pub(super) fn body<T: DeserializeOwned>(
    body: std::result::Result<Json<T>, JsonRejection>,
) -> Result<T> {
    body.map(|Json(value)| value).map_err(|error| {
        let (status, code, message) = match error.status() {
            StatusCode::PAYLOAD_TOO_LARGE => (
                StatusCode::PAYLOAD_TOO_LARGE,
                "too_large",
                "Request is too large.",
            ),
            StatusCode::UNSUPPORTED_MEDIA_TYPE => (
                StatusCode::UNSUPPORTED_MEDIA_TYPE,
                "invalid_input",
                "A JSON request is required.",
            ),
            _ => (StatusCode::BAD_REQUEST, "invalid_input", "Invalid request."),
        };
        // Serde diagnostics can include input values. Never echo credentials.
        Failure::new(status, code, message)
    })
}
fn unique<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    let mut values = headers.get_all(name).iter();
    let value = values.next()?.to_str().ok()?;
    if values.next().is_some() {
        return None;
    }
    Some(value)
}
pub(super) fn agent_token(headers: &HeaderMap) -> Result<Zeroizing<String>> {
    if headers.contains_key("cookie") {
        return Err(Error::Unauthorized.into());
    }
    let value = unique(headers, "authorization")
        .and_then(|s| s.strip_prefix("Bearer "))
        .ok_or(Error::Unauthorized)?;
    let suffix = value
        .strip_prefix("aether_agent_")
        .or_else(|| value.strip_prefix("aether_sa_"))
        .ok_or(Error::Unauthorized)?;
    if suffix.len() != 64 || !suffix.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(Error::Unauthorized.into());
    }
    Ok(Zeroizing::new(value.to_owned()))
}
pub(super) fn device_token(
    headers: &HeaderMap,
    required: bool,
) -> Result<Option<Zeroizing<String>>> {
    if headers.contains_key("cookie") {
        return Err(Error::Unauthorized.into());
    }
    if !headers.contains_key("authorization") && !required {
        return Ok(None);
    }
    let value = unique(headers, "authorization")
        .and_then(|s| s.strip_prefix("Bearer "))
        .ok_or(Error::Unauthorized)?;
    let suffix = value
        .strip_prefix("aether_dev_")
        .ok_or(Error::Unauthorized)?;
    // Accept the original URL-safe player tokens during the separate data import.
    if !(32..=128).contains(&suffix.len())
        || !suffix
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    {
        return Err(Error::Unauthorized.into());
    }
    Ok(Some(Zeroizing::new(value.to_owned())))
}
pub(super) fn token(headers: &HeaderMap) -> Result<Zeroizing<String>> {
    optional_token(headers)?.ok_or_else(|| Error::Unauthorized.into())
}
pub(super) fn optional_token(headers: &HeaderMap) -> Result<Option<Zeroizing<String>>> {
    if !headers.contains_key("cookie") {
        return Ok(None);
    }
    let cookie = unique(headers, "cookie")
        .filter(|s| s.len() <= 8192)
        .ok_or(Error::Unauthorized)?;
    let mut found = None;
    for part in cookie.split(';') {
        let Some((name, value)) = part.trim().split_once('=') else {
            if part.trim() == COOKIE {
                return Err(Error::Unauthorized.into());
            }
            continue;
        };
        if name == COOKIE {
            if found.is_some() || value.len() != 64 || !value.bytes().all(|b| b.is_ascii_hexdigit())
            {
                return Err(Error::Unauthorized.into());
            }
            found = Some(Zeroizing::new(value.to_string()));
        }
    }
    Ok(found)
}
pub(super) fn cookie(host: &NativeHost, value: &str) -> HeaderValue {
    // Tokens originate in Identity's random-hex generator, never request input.
    let mut header = HeaderValue::from_str(&format!(
        "{COOKIE}={value}; Path=/; HttpOnly; SameSite=Strict; Max-Age={}{}",
        if value.is_empty() { 0 } else { 43200 },
        if host.secure { "; Secure" } else { "" }
    ))
    .expect("generated cookie");
    header.set_sensitive(true);
    header
}
fn check(host: &NativeHost, request: &Request) -> Result<()> {
    let headers = request.headers();
    if unique(headers, "host") != Some(host.authority.as_str()) {
        return Err(Failure::new(
            StatusCode::FORBIDDEN,
            "forbidden",
            "Unrecognized host name.",
        ));
    }
    // Only relative-form requests are valid at this origin. Reverse proxies
    // must preserve the configured Host; forwarded host/address is not trusted.
    if request.uri().authority().is_some()
        || request.uri().scheme().is_some()
        || request.uri().query().is_some_and(|q| {
            q.len() > 4096
                || (request.uri().path() != "/api/drive/download"
                    && !(request.method() == Method::GET
                        && request.uri().path() == "/oauth/authorize")
                    && !(request.method() == Method::GET
                        && request.uri().path() == "/api/library/changes")
                    && !(matches!(*request.method(), Method::GET | Method::HEAD)
                        && request.uri().path() == "/api/map/assets/search")
                    && super::workspace::path(request.uri().path()).is_none()
                    && !host
                        .frontends
                        .as_ref()
                        .is_some_and(|web| web.accepts_path(request.uri().path())))
        })
    {
        return Err(Failure::new(
            StatusCode::BAD_REQUEST,
            "invalid_input",
            "Use the route without a query string.",
        ));
    }
    let mcp = request.uri().path() == "/mcp";
    let oauth_machine = request.method() == Method::POST
        && matches!(request.uri().path(), "/oauth/register" | "/oauth/token");
    let oauth_navigation =
        request.method() == Method::GET && request.uri().path() == "/oauth/authorize";
    let agent_command = request.method() == Method::POST
        && matches!(
            request.uri().path(),
            "/api/automation/commands/list" | "/api/automation/commands/run"
        );
    let service_rpc = request.method() == Method::POST
        && matches!(request.uri().path(), "/animation/rpc" | "/cad/rpc")
        && headers.contains_key("authorization");
    if service_rpc {
        agent_token(headers)?;
    }
    let media_route = request
        .uri()
        .path()
        .strip_prefix("/api/map/media/")
        .is_some_and(|s| !s.is_empty() && !s.contains('/'));
    let device_request = ((media_route || request.uri().path() == "/api/map/app.zip")
        && matches!(*request.method(), Method::GET | Method::HEAD)
        && headers.contains_key("authorization"))
        || (request.method() == Method::POST
            && request.uri().path() == "/api/map/devices/announce")
        || (matches!(*request.method(), Method::GET | Method::HEAD)
            && matches!(
                request.uri().path(),
                "/api/map/device/show" | "/api/map/device/cast"
            ))
        || (request.method() == Method::POST && request.uri().path() == "/api/map/device/cast");
    if device_request {
        device_token(headers, request.uri().path() != "/api/map/devices/announce")?;
    }
    let delegated = mcp
        || oauth_machine
        || service_rpc
        || device_request
        || (agent_command && headers.contains_key("authorization"));
    if headers.contains_key("authorization") && !device_request && !mcp {
        if !agent_command && !service_rpc {
            return Err(Error::Unauthorized.into());
        }
        agent_token(headers)?;
    }
    let safe = matches!(*request.method(), Method::GET | Method::HEAD);
    if ((!safe && !delegated) || headers.contains_key("origin"))
        && unique(headers, "origin") != Some(host.origin.as_str())
    {
        return Err(Failure::new(
            StatusCode::FORBIDDEN,
            "forbidden",
            "A same-origin request is required.",
        ));
    }
    if !oauth_navigation
        && headers.contains_key("sec-fetch-site")
        && !matches!(
            unique(headers, "sec-fetch-site"),
            Some("same-origin" | "none")
        )
    {
        return Err(Failure::new(
            StatusCode::FORBIDDEN,
            "forbidden",
            "Cross-site account requests are not permitted.",
        ));
    }
    if !safe
        && !(media_route && matches!(*request.method(), Method::PUT | Method::DELETE))
        && !unique(headers, "content-type").is_some_and(|s| {
            s.split(';').next().is_some_and(|v| {
                v.trim()
                    .eq_ignore_ascii_case(if request.uri().path() == "/oauth/token" {
                        "application/x-www-form-urlencoded"
                    } else {
                        "application/json"
                    })
            })
        })
    {
        return Err(Failure::new(
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            "invalid_input",
            "A JSON request is required.",
        ));
    }
    Ok(())
}
pub(super) async fn guard(
    State(host): State<NativeHost>,
    request: Request,
    next: Next,
) -> Response {
    let result = match check(&host, &request) {
        Err(error) => error.into_response(),
        Ok(()) => match if request.method() == Method::PUT
            && request.uri().path().starts_with("/api/map/media/")
        {
            super::admission::acquire_media_upload(&host)
        } else {
            super::admission::acquire(&host, request.uri().path()).await
        } {
            Err(_) => Failure(
                StatusCode::TOO_MANY_REQUESTS,
                "busy",
                "Server is busy. No operation was started.".into(),
                "not_started",
                None,
            )
            .into_response(),
            Ok(permit) => {
                let safe = matches!(*request.method(), Method::GET | Method::HEAD);
                match tokio::time::timeout(permit.remaining, next.run(request)).await {
                    Ok(response) => response,
                    Err(_) if safe => Failure(
                        StatusCode::GATEWAY_TIMEOUT,
                        "unavailable",
                        "Read timed out.".into(),
                        "not_started",
                None,
                    )
                    .into_response(),
                    Err(_) => Failure(
                        StatusCode::GATEWAY_TIMEOUT,
                        "outcome_unknown",
                        "Request timed out. Check current state; repeat document mutations only with the same operation ID and arguments.".into(),
                        "unknown",
                        None,
                    )
                    .into_response(),
                }
            }
        },
    };
    let mut response = result;
    let headers = response.headers_mut();
    headers.insert("cache-control", HeaderValue::from_static("no-store"));
    headers.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    headers.insert("referrer-policy", HeaderValue::from_static("no-referrer"));
    headers.insert(
        "cross-origin-resource-policy",
        HeaderValue::from_static("same-origin"),
    );
    response
}
