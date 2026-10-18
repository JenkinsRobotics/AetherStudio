//! One local JSON request on stdin. Explicit paths; no network listener or database.
use aether_local_files::{MAX_DOCUMENT_BYTES, execute};
use aether_protocol_core::local_files::{LocalFileErrorCode, LocalFileRequest, LocalFileResponse};
use std::{
    io::{self, Read},
    process::ExitCode,
};
fn main() -> ExitCode {
    let limit = MAX_DOCUMENT_BYTES.div_ceil(3) * 4 + 16 * 1024;
    let mut input = Vec::new();
    let response = match io::stdin().take(limit as u64 + 1).read_to_end(&mut input) {
        Ok(_) if input.len() <= limit => match serde_json::from_slice::<LocalFileRequest>(&input) {
            Ok(request) => match execute(request) {
                Ok(result) => LocalFileResponse::Success { result },
                Err(e) => LocalFileResponse::Error {
                    code: e.code,
                    message: e.message,
                },
            },
            Err(_) => LocalFileResponse::Error {
                code: LocalFileErrorCode::InvalidRequest,
                message: "Send one valid local-file request.".into(),
            },
        },
        _ => LocalFileResponse::Error {
            code: LocalFileErrorCode::InvalidRequest,
            message: "Could not read a request within the size limit.".into(),
        },
    };
    println!("{}", serde_json::to_string(&response).unwrap());
    if matches!(response, LocalFileResponse::Success { .. }) {
        ExitCode::SUCCESS
    } else {
        ExitCode::FAILURE
    }
}
