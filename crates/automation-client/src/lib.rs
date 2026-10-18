//! CLI/MCP transport only. The permission-filtered host catalog owns commands;
//! product adapters own semantics. No local engine or credential issuer is here.
pub mod mcp;

use reqwest::{blocking::Client as HttpClient, header::HeaderValue};
use serde_json::{Value, json};
use std::{collections::HashSet, io::Read, time::Duration};

pub const MAX_INPUT: usize = 1024 * 1024;
const MAX_RESULT: u64 = 8 * 1024 * 1024;

pub use aether_protocol_core::mcp::{Capabilities, Catalog, Command, Error};

pub struct Client {
    http: HttpClient,
    origin: String,
    authorization: HeaderValue,
}

impl Client {
    pub fn new(origin: &str, token: &str) -> Result<Self, Error> {
        // Validate the spelling before URL parsing: URL parsers normalize alternate
        // loopback forms, dot paths and empty query/fragment delimiters.
        let (hostname, rest) = if let Some(rest) = origin.strip_prefix("http://localhost:") {
            ("localhost", Some(rest))
        } else {
            ("127.0.0.1", origin.strip_prefix("http://127.0.0.1:"))
        };
        let port = rest
            .map(|s| s.strip_suffix('/').unwrap_or(s))
            .filter(|s| !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit()))
            .and_then(|s| s.parse::<u16>().ok())
            .filter(|n| *n > 0)
            .ok_or_else(|| {
                Error::new(
                    400,
                    "Use http://localhost:PORT or http://127.0.0.1:PORT. For remote agents use the Studio MCP URL.",
                )
            })?;
        if !(token.starts_with("aether_agent_") || token.starts_with("aether_sa_"))
            || token.len() <= 13
            || token.len() > 512
            || !token
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
        {
            return Err(Error::new(
                400,
                "Create an agent or service connection in Studio and set AETHER_AUTOMATION_TOKEN.",
            ));
        }
        let mut authorization = HeaderValue::from_str(&format!("Bearer {token}"))
            .map_err(|_| Error::new(400, "Invalid agent connection key."))?;
        authorization.set_sensitive(true);
        let http = HttpClient::builder()
            // Preserve the configured Host while pinning localhost to literal loopback.
            .resolve(
                "localhost",
                std::net::SocketAddr::from(([127, 0, 0, 1], port)),
            )
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .retry(reqwest::retry::never())
            .timeout(Duration::from_secs(30))
            .connect_timeout(Duration::from_secs(5))
            .build()
            .map_err(|_| Error::new(503, "Cannot initialize the local command connection."))?;
        Ok(Self {
            http,
            origin: format!("http://{hostname}:{port}"),
            authorization,
        })
    }

    pub fn environment() -> Result<Self, Error> {
        Self::new(
            &std::env::var("AETHER_SERVER_URL").unwrap_or_else(|_| "http://localhost:8780".into()),
            &std::env::var("AETHER_AUTOMATION_TOKEN").unwrap_or_default(),
        )
    }

    pub fn call(&self, action: &str, data: &Value) -> Result<Value, Error> {
        if !matches!(action, "list" | "run") {
            return Err(Error::new(400, "Unknown command transport action."));
        }
        let body =
            serde_json::to_vec(data).map_err(|_| Error::new(400, "Invalid command JSON."))?;
        // Account for the command envelope surrounding bounded stdin arguments.
        if body.len() > MAX_INPUT + 4096 {
            return Err(Error::new(400, "Command exceeds the request limit."));
        }
        let response = self
            .http
            .post(format!("{}/api/automation/commands/{action}", self.origin))
            .header("Content-Type", "application/json")
            .header("Authorization", self.authorization.clone())
            .body(body)
            .send()
            .map_err(|_| transport_error(action))?;
        let status = response.status();
        // Do not echo host diagnostics: they can contain credentials or raw input.
        if !status.is_success() {
            let message = match status.as_u16() {
                401 => "Agent connection expired, revoked or invalid.",
                403 => "This connection is not allowed to run the command.",
                404 => {
                    "Command or document unavailable. Check the server's automation support and your access."
                }
                409 => "The document changed. Inspect its current revision before editing again.",
                _ => "Aether refused the command. Inspect the document before retrying an edit.",
            };
            return Err(Error::new(status.as_u16(), message));
        }
        let mut bytes = Vec::new();
        response
            .take(MAX_RESULT + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| transport_error(action))?;
        if bytes.len() as u64 > MAX_RESULT {
            return Err(Error::new(
                502,
                "Result exceeds 8 MiB. Inspect before retrying an edit.",
            ));
        }
        let value: Value = serde_json::from_slice(&bytes).map_err(|_| {
            Error::new(
                502,
                "Invalid server result. Inspect before retrying an edit.",
            )
        })?;
        if !value.is_object() {
            return Err(Error::new(502, "Expected an object result from Aether."));
        }
        Ok(value)
    }

    pub fn catalog(&self) -> Result<Catalog, Error> {
        validate_catalog(self.call("list", &json!({}))?)
    }
}

fn transport_error(action: &str) -> Error {
    Error::new(
        503,
        if action == "run" {
            "Command outcome is unknown. Inspect the document before retrying; the bridge never automatically retries edits."
        } else {
            "Cannot reach local Aether Studio. Check the server address and connection."
        },
    )
}

fn validate_catalog(value: Value) -> Result<Catalog, Error> {
    let invalid = || Error::new(502, "Invalid Aether command catalog.");
    let catalog: Catalog = serde_json::from_value(value).map_err(|_| invalid())?;
    let mut names = HashSet::new();
    if catalog.commands.len() > 1024 || catalog.apps.len() > 128 {
        return Err(invalid());
    }
    for command in &catalog.commands {
        if command.id.len() > 128
            || command.id.split('.').any(|part| {
                part.is_empty()
                    || !part
                        .bytes()
                        .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
            })
            || !names.insert(command.tool_name())
            || !command.input_schema.is_object()
            || !command.annotations.is_object()
        {
            return Err(invalid());
        }
    }
    Ok(catalog)
}
