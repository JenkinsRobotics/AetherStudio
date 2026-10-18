//! Shared wire contracts and Studio compatibility profiles. Product semantics remain product-owned.
pub mod branches;
pub mod browsing;
pub mod directory;
pub mod local_files;
pub mod mcp;
pub mod resources;
pub mod storage;
pub mod studio_commands;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use ts_rs::TS;

pub const PROTOCOL_VERSION: u32 = 1;
pub const MAX_REQUEST_BYTES: usize = 256 * 1024;
pub const MAX_RESPONSE_BYTES: usize = 8 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct CommandRequest {
    pub protocol_version: u32,
    /// Correlation only; NOT an idempotency key. Never automatically retry a write.
    pub request_id: String,
    pub command: String,
    pub arguments: Map<String, Value>,
}

impl CommandRequest {
    pub fn validate(&self) -> Result<(), CommandError> {
        if self.protocol_version != PROTOCOL_VERSION {
            return Err(CommandError::new(
                ErrorCode::UnsupportedVersion,
                "Unsupported command protocol version.",
                ExecutionState::NotStarted,
            ));
        }
        if self.request_id.is_empty()
            || self.request_id.len() > 128
            || !self
                .request_id
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || b"-_.:".contains(&c))
        {
            return Err(CommandError::new(
                ErrorCode::InvalidRequest,
                "Use a request ID of 1–128 ASCII letters, digits, dash, dot, colon or underscore.",
                ExecutionState::NotStarted,
            ));
        }
        if self.command.len() > 160
            || self.command.split('.').count() < 2
            || !self.command.split('.').all(|part| {
                part.as_bytes().first().is_some_and(u8::is_ascii_lowercase)
                    && part
                        .bytes()
                        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
            })
        {
            return Err(CommandError::new(
                ErrorCode::InvalidRequest,
                "Use a namespaced command from the authorized catalog.",
                ExecutionState::NotStarted,
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    InvalidRequest,
    UnsupportedVersion,
    Unauthenticated,
    Forbidden,
    NotFound,
    Conflict,
    Busy,
    Unavailable,
    OutcomeUnknown,
    UpstreamFailure,
}

/// A transport failure after dispatch cannot prove whether a saved edit committed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionState {
    NotStarted,
    Rejected,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct CommandError {
    pub code: ErrorCode,
    pub message: String,
    pub execution: ExecutionState,
}
impl CommandError {
    pub fn new(code: ErrorCode, message: impl Into<String>, execution: ExecutionState) -> Self {
        Self {
            code,
            message: message.into(),
            execution,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum CommandResponse {
    Success {
        protocol_version: u32,
        request_id: String,
        command: String,
        result: Value,
    },
    Error {
        protocol_version: u32,
        request_id: Option<String>,
        error: CommandError,
    },
}
impl CommandResponse {
    pub fn error(request_id: Option<String>, error: CommandError) -> Self {
        Self::Error {
            protocol_version: PROTOCOL_VERSION,
            request_id,
            error,
        }
    }
}

/// Legacy descriptors are forwarded, not redefined by the platform.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct CommandDescriptor {
    pub id: String,
    pub title: String,
    pub description: String,
    #[serde(rename = "inputSchema")]
    pub input_schema: Value,
    pub writes: bool,
    pub annotations: Value,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct CommandCatalog {
    pub schema_version: u32,
    pub apps: Vec<String>,
    pub commands: Vec<CommandDescriptor>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct Capabilities {
    pub protocol_version: u32,
    pub mode: String,
    pub studio_command_profile_version: u32,
    pub persistent_storage: bool,
    pub live_collaboration: bool,
    pub durable_retries: bool,
    pub max_request_bytes: u32,
    pub max_response_bytes: u32,
}
impl Default for Capabilities {
    fn default() -> Self {
        Self {
            protocol_version: PROTOCOL_VERSION,
            mode: "legacy_authority_gateway".into(),
            studio_command_profile_version: studio_commands::STUDIO_COMMAND_PROFILE_VERSION,
            persistent_storage: false,
            live_collaboration: false,
            durable_retries: false,
            max_request_bytes: MAX_REQUEST_BYTES as u32,
            max_response_bytes: MAX_RESPONSE_BYTES as u32,
        }
    }
}

pub fn typescript() -> String {
    let cfg = ts_rs::Config::default();
    let mut definitions = vec![
        <Value as TS>::decl(&cfg),
        ErrorCode::decl(&cfg),
        ExecutionState::decl(&cfg),
        CommandError::decl(&cfg),
        CommandRequest::decl(&cfg),
        CommandResponse::decl(&cfg),
        CommandDescriptor::decl(&cfg),
        CommandCatalog::decl(&cfg),
        Capabilities::decl(&cfg),
    ];
    definitions.extend(browsing::typescript_definitions(&cfg));
    definitions.extend(resources::typescript_definitions(&cfg));
    definitions.extend(directory::typescript_definitions(&cfg));
    definitions.extend(storage::typescript_definitions(&cfg));
    definitions.extend(branches::typescript_definitions(&cfg));
    definitions.extend(local_files::typescript_definitions(&cfg));
    definitions.extend(studio_commands::typescript_definitions(&cfg));
    format!(
        "// Generated from aether-protocol-core. Do not edit.\nexport const PROTOCOL_VERSION = {PROTOCOL_VERSION} as const;\nexport const STUDIO_COMMAND_PROFILE_VERSION = {} as const;\n{}\n",
        studio_commands::STUDIO_COMMAND_PROFILE_VERSION,
        definitions
            .iter()
            .map(|d| format!("export {d}"))
            .collect::<Vec<_>>()
            .join("\n")
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn request() -> CommandRequest {
        serde_json::from_value(json!({"protocol_version":1,"request_id":"test:1",
            "command":"cad.extrude.setdepth","arguments":{"app":"cad","depth_mm":12.5}}))
        .unwrap()
    }
    #[test]
    fn validates_protocol_and_namespace() {
        assert!(request().validate().is_ok());
        let mut r = request();
        r.protocol_version = 2;
        assert_eq!(
            r.validate().unwrap_err().code,
            ErrorCode::UnsupportedVersion
        );
        for name in [
            "",
            "cad.",
            "../execute",
            "cad.foo-bar",
            "CAD.preview",
            "cad..preview",
        ] {
            let mut r = request();
            r.command = name.into();
            assert!(r.validate().is_err(), "{name}");
        }
    }
    #[test]
    fn strict_request_shape_and_correlation() {
        let mut v = serde_json::to_value(request()).unwrap();
        v["upstream"] = json!("http://attacker");
        assert!(serde_json::from_value::<CommandRequest>(v).is_err());
        for id in ["", "a b", "line\nbreak", &"x".repeat(129)] {
            let mut r = request();
            r.request_id = id.into();
            assert!(r.validate().is_err());
        }
    }
    #[test]
    fn error_roundtrip_preserves_uncertain_outcome() {
        let r = CommandResponse::error(
            Some("x".into()),
            CommandError::new(
                ErrorCode::OutcomeUnknown,
                "Check the saved revision before retrying.",
                ExecutionState::Unknown,
            ),
        );
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("outcome_unknown"));
        let _: CommandResponse = serde_json::from_str(&json).unwrap();
    }
    #[test]
    fn checked_in_types_match_rust() {
        assert_eq!(
            typescript(),
            include_str!("../../../core/protocol/src/index.ts")
        );
    }
}
