use serde_json::{Value, json};
use std::{
    io::Write,
    process::{Command, Stdio},
};
fn run(request: Value) -> (bool, Value) {
    let mut child = Command::new(env!("CARGO_BIN_EXE_aether-local-files"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    child
        .stdin
        .take()
        .unwrap()
        .write_all(request.to_string().as_bytes())
        .unwrap();
    let output = child.wait_with_output().unwrap();
    (
        output.status.success(),
        serde_json::from_slice(&output.stdout).unwrap(),
    )
}
#[test]
fn headless_file_flow_needs_no_server_or_database() {
    let root = tempfile::tempdir().unwrap();
    let file = root.path().join("test.aethermap");
    let recovery = root.path().join("recovery");
    let request = |operation: Value| json!({"document_path":file,"recovery_root":recovery,"operation":operation});
    let (ok, response) = run(request(
        json!({"action":"save","expected":{"kind":"missing"},"content_base64":"aGVsbG8="}),
    ));
    assert!(ok, "{response}");
    assert_eq!(std::fs::read(&file).unwrap(), b"hello");
    let hash = &response["result"]["receipt"]["file"]["sha256"];
    let (ok, response) = run(request(
        json!({"action":"stage_recovery","session_id":"cli","base":{"kind":"content","sha256":hash},"content_base64":"ZHJhZnQ="}),
    ));
    assert!(ok, "{response}");
    let fingerprint = response["result"]["receipt"]["file"].clone();
    let (ok, listed) = run(request(json!({"action":"list_recovery"})));
    assert!(ok && listed["result"]["listing"]["drafts"][0]["base_matches_current_file"] == true);
    let (ok, draft) = run(request(
        json!({"action":"read_recovery","session_id":"cli"}),
    ));
    assert!(ok && draft["result"]["candidate"]["draft"]["content_base64"] == "ZHJhZnQ=");
    assert_eq!(std::fs::read(&file).unwrap(), b"hello");
    assert!(
        run(request(
            json!({"action":"discard_recovery","session_id":"cli","expected_content":fingerprint})
        ))
        .0
    );
    let (ok, conflict) = run(request(
        json!({"action":"save","expected":{"kind":"missing"},"content_base64":""}),
    ));
    assert!(!ok && conflict["code"] == "conflict");
}
#[test]
fn invalid_local_protocol_does_not_touch_the_document() {
    let root = tempfile::tempdir().unwrap();
    let file = root.path().join("absent");
    let (ok, result) = run(
        json!({"document_path":file,"recovery_root":root.path(),"operation":{"action":"save","content_base64":""}}),
    );
    assert!(!ok && result["code"] == "invalid_request");
    assert!(!file.exists());
}
