//! Bounded newline-delimited MCP. No sampling, live editor, hardware, resource
//! subscriptions or arbitrary program execution is advertised.
use crate::{Client, Error, MAX_INPUT};
use serde_json::{Value, json};
use std::io::{self, BufRead, Write};

use aether_protocol_core::mcp::{INSTRUCTIONS, VERSIONS, tool_result};

pub struct Server {
    client: Client,
    initialized: bool,
    ready: bool,
}
impl Server {
    pub fn new(client: Client) -> Self {
        Self {
            client,
            initialized: false,
            ready: false,
        }
    }

    pub fn handle(&mut self, message: Value) -> Option<Value> {
        if !message.is_object()
            || message["jsonrpc"] != "2.0"
            || !message["method"].is_string()
            || message
                .get("id")
                .is_some_and(|id| !id.is_string() && !id.is_i64() && !id.is_u64())
        {
            return Some(error(Value::Null, -32600, "Invalid request."));
        }
        let method = message["method"].as_str().unwrap();
        let Some(id) = message.get("id").cloned() else {
            if method == "notifications/initialized" && self.initialized {
                self.ready = true;
            }
            return None;
        };
        let empty = json!({});
        let params = message.get("params").unwrap_or(&empty);
        if !params.is_object() {
            return Some(error(id, -32602, "Parameters must be an object."));
        }
        let result = match method {
            "initialize" => {
                if self.initialized {
                    return Some(error(id, -32600, "Already initialized."));
                }
                if !params["protocolVersion"].is_string()
                    || !params["capabilities"].is_object()
                    || !params["clientInfo"].is_object()
                {
                    return Some(error(
                        id,
                        -32602,
                        "Provide protocolVersion, capabilities and clientInfo.",
                    ));
                }
                self.initialized = true;
                let requested = params["protocolVersion"].as_str().unwrap();
                json!({"protocolVersion": if VERSIONS.contains(&requested) {requested} else {VERSIONS[0]},
                    "capabilities":{"tools":{}}, "serverInfo":{"name":"aether-studio","version":env!("CARGO_PKG_VERSION")},
                    "instructions":INSTRUCTIONS})
            }
            "ping" => json!({}),
            _ if !self.ready => return Some(error(id, -32000, "Initialize the connection first.")),
            "tools/list" => {
                if extra_keys(params, &["_meta"]) {
                    return Some(error(
                        id,
                        -32602,
                        "This server does not paginate its tool catalog.",
                    ));
                }
                match self.client.catalog() {
                    Ok(catalog) => catalog.tools(),
                    Err(e) => return Some(error(id, -32000, &e.message)),
                }
            }
            "tools/call" => {
                if extra_keys(params, &["name", "arguments", "_meta"])
                    || !params["name"].is_string()
                    || params.get("arguments").is_some_and(|a| !a.is_object())
                    || params.get("_meta").is_some_and(|a| !a.is_object())
                    || params["_meta"]
                        .get("aether/operationId")
                        .is_some_and(|a| !a.is_string())
                {
                    return Some(error(
                        id,
                        -32602,
                        "Provide a tool name and argument object.",
                    ));
                }
                // Re-fetch on every call; cached tools must never extend a revoked grant.
                match self.client.catalog() {
                    Err(e) => tool_error(e),
                    Ok(catalog) => {
                        let name = params["name"].as_str().unwrap();
                        let Some(command) = catalog.commands.iter().find(|c| c.tool_name() == name)
                        else {
                            return Some(error(id, -32602, "Unknown or unavailable tool."));
                        };
                        let invocation = catalog.invocation(
                            &command.id,
                            params.get("arguments").unwrap_or(&empty),
                            params["_meta"]["aether/operationId"].as_str(),
                        );
                        match invocation.and_then(|body| self.client.call("run", &body)) {
                            Ok(value) => tool_result(value),
                            Err(e) => tool_error(e),
                        }
                    }
                }
            }
            _ => return Some(error(id, -32601, "Method not found.")),
        };
        Some(json!({"jsonrpc":"2.0","id":id,"result":result}))
    }

    pub fn serve(&mut self, mut input: impl BufRead, mut output: impl Write) -> io::Result<()> {
        let mut bytes = Vec::new();
        loop {
            bytes.clear();
            let mut oversized = false;
            let mut saw_bytes = false;
            loop {
                let chunk = input.fill_buf()?;
                if chunk.is_empty() {
                    break;
                }
                saw_bytes = true;
                let newline = chunk.iter().position(|b| *b == b'\n');
                let n = newline.map_or(chunk.len(), |p| p + 1);
                if bytes.len() + n > MAX_INPUT {
                    oversized = true;
                }
                if !oversized {
                    bytes.extend_from_slice(&chunk[..n]);
                }
                input.consume(n);
                if newline.is_some() {
                    break;
                }
            }
            if !saw_bytes {
                return Ok(());
            }
            let response = if oversized {
                Some(error(
                    Value::Null,
                    -32600,
                    "Request exceeds the 1 MiB limit.",
                ))
            } else {
                match serde_json::from_slice(&bytes) {
                    Ok(message) => self.handle(message),
                    Err(_) => Some(error(Value::Null, -32700, "Invalid JSON.")),
                }
            };
            if let Some(response) = response {
                writeln!(output, "{response}")?;
                output.flush()?;
            }
        }
    }
}
fn extra_keys(params: &Value, allowed: &[&str]) -> bool {
    params
        .as_object()
        .unwrap()
        .keys()
        .any(|key| !allowed.contains(&key.as_str()))
}
fn error(id: Value, code: i32, message: &str) -> Value {
    json!({"jsonrpc":"2.0","id":id,"error":{"code":code,"message":message}})
}
fn tool_error(e: Error) -> Value {
    json!({"content":[{"type":"text","text":json!({"error":e.message,"status":e.status}).to_string()}],"isError":true})
}
