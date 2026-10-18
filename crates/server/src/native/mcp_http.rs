//! Stateless Streamable HTTP: JSON responses, no subscriptions or in-memory sessions.
use super::{
    NativeHost,
    boundary::{self, Failure},
    oauth,
};
use aether_protocol_core::mcp::{Catalog, INSTRUCTIONS, VERSIONS, tool_result};
use axum::{
    Json,
    extract::{State, rejection::JsonRejection},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use serde_json::{Value, json};
use zeroize::Zeroizing;

fn key(headers: &HeaderMap) -> Option<Zeroizing<String>> {
    if headers.contains_key("cookie") {
        return None;
    }
    let mut values = headers.get_all("authorization").iter();
    let raw = values.next()?.to_str().ok()?.strip_prefix("Bearer ")?;
    if values.next().is_some() {
        return None;
    }
    let suffix = raw
        .strip_prefix("aether_mcp_")
        .or_else(|| raw.strip_prefix("aether_agent_"))
        .or_else(|| raw.strip_prefix("aether_sa_"))?;
    (suffix.len() == 64 && suffix.bytes().all(|b| b.is_ascii_hexdigit()))
        .then(|| Zeroizing::new(raw.into()))
}
fn unauthorized(host: &NativeHost) -> Response {
    (
        StatusCode::UNAUTHORIZED,
        [(
            "www-authenticate",
            format!(
                "Bearer resource_metadata=\"{}/.well-known/oauth-protected-resource/mcp\"",
                host.origin
            ),
        )],
        Json(json!({"error":"invalid_token"})),
    )
        .into_response()
}
fn error(id: Value, code: i32, message: &str) -> Response {
    Json(json!({"jsonrpc":"2.0","id":id,"error":{"code":code,"message":message}})).into_response()
}
fn extra(params: &Value, allowed: &[&str]) -> bool {
    params
        .as_object()
        .is_some_and(|p| p.keys().any(|k| !allowed.contains(&k.as_str())))
}
pub(super) async fn post(
    State(host): State<NativeHost>,
    headers: HeaderMap,
    input: std::result::Result<Json<Value>, JsonRejection>,
) -> Response {
    let Some(key) = key(&headers) else {
        return unauthorized(&host);
    };
    if let Err(e) = host
        .identity
        .authorize_mcp(&key, &oauth::resource(&host))
        .await
    {
        return if e == aether_identity::Error::Unauthorized {
            unauthorized(&host)
        } else {
            Failure::from(e).into_response()
        };
    }
    if headers.get_all("mcp-protocol-version").iter().count() > 1
        || headers
            .get("mcp-protocol-version")
            .is_some_and(|v| !v.to_str().is_ok_and(|s| VERSIONS.contains(&s)))
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error":"Unsupported MCP protocol version."})),
        )
            .into_response();
    }
    let Some(docs) = &host.documents else {
        return Failure::from(crate::documents::Error::Unavailable).into_response();
    };
    let value = match boundary::body(input) {
        Ok(v) => v,
        Err(e) => return e.into_response(),
    };
    if !value.is_object()
        || value["jsonrpc"] != "2.0"
        || !value["method"].is_string()
        || value
            .get("id")
            .is_some_and(|id| !id.is_string() && !id.is_i64() && !id.is_u64())
    {
        return error(Value::Null, -32600, "Invalid request.");
    }
    let Some(id) = value.get("id").cloned() else {
        return StatusCode::ACCEPTED.into_response();
    };
    let empty = json!({});
    let params = value.get("params").unwrap_or(&empty);
    if !params.is_object() {
        return error(id, -32602, "Parameters must be an object.");
    }
    let result = match value["method"].as_str().unwrap() {
        "initialize" => {
            let Some(version) = params["protocolVersion"].as_str() else {
                return error(
                    id,
                    -32602,
                    "Provide protocolVersion, capabilities and clientInfo.",
                );
            };
            if !params["capabilities"].is_object() || !params["clientInfo"].is_object() {
                return error(
                    id,
                    -32602,
                    "Provide protocolVersion, capabilities and clientInfo.",
                );
            }
            json!({"protocolVersion":if VERSIONS.contains(&version){version}else{VERSIONS[0]},"capabilities":{"tools":{}},"serverInfo":{"name":"aether-studio","version":env!("CARGO_PKG_VERSION")},"instructions":INSTRUCTIONS})
        }
        "ping" => json!({}),
        method @ ("tools/list" | "tools/call") => {
            let catalog = match docs.automation_catalog(&key).await {
                Ok(v) => v,
                Err(e) => return Failure::from(e).into_response(),
            };
            let Ok(catalog) = serde_json::from_value::<Catalog>(catalog) else {
                return error(id, -32603, "Command catalog unavailable.");
            };
            if method == "tools/list" {
                if extra(params, &["_meta"]) {
                    return error(
                        id,
                        -32602,
                        "This server does not paginate its tool catalog.",
                    );
                }
                catalog.tools()
            } else {
                if extra(params, &["name", "arguments", "_meta"])
                    || !params["name"].is_string()
                    || params.get("arguments").is_some_and(|v| !v.is_object())
                    || params.get("_meta").is_some_and(|v| !v.is_object())
                    || params["_meta"]
                        .get("aether/operationId")
                        .is_some_and(|v| !v.is_string())
                {
                    return error(id, -32602, "Provide a tool name and argument object.");
                }
                let Some(command) = catalog
                    .commands
                    .iter()
                    .find(|c| c.tool_name() == params["name"].as_str().unwrap())
                else {
                    return error(id, -32602, "Unknown or unavailable tool.");
                };
                let run = match catalog.invocation(
                    &command.id,
                    params.get("arguments").unwrap_or(&empty),
                    params["_meta"]["aether/operationId"].as_str(),
                ) {
                    Ok(v) => v,
                    Err(e) => return error(id, -32602, &e.message),
                };
                let Ok(run) = serde_json::from_value(run) else {
                    return error(id, -32602, "Invalid command arguments.");
                };
                match docs.automation_run(key, run).await {
                    Ok(result) => tool_result(result),
                    Err(e) => {
                        // Reuse the canonical safe error projection, including uncertain commits.
                        let response = Failure::from(e).into_response();
                        let bytes = axum::body::to_bytes(response.into_body(), 16384)
                            .await
                            .unwrap_or_default();
                        let text = String::from_utf8_lossy(&bytes);
                        json!({"content":[{"type":"text","text":text}],"isError":true})
                    }
                }
            }
        }
        _ => return error(id, -32601, "Method not found."),
    };
    Json(json!({"jsonrpc":"2.0","id":id,"result":result})).into_response()
}
