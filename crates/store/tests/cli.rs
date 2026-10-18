use serde_json::{Value, json};
use std::{
    io::Write,
    path::Path,
    process::{Command, Stdio},
};
fn run(path: &Path, args: &[&str], input: Option<&Value>) -> (bool, Value) {
    let mut child = Command::new(env!("CARGO_BIN_EXE_aether-store-fixture"))
        .arg(path)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    if let Some(input) = input {
        child
            .stdin
            .take()
            .unwrap()
            .write_all(input.to_string().as_bytes())
            .unwrap();
    } else {
        drop(child.stdin.take());
    }
    let output = child.wait_with_output().unwrap();
    (
        output.status.success(),
        serde_json::from_slice(&output.stdout).unwrap(),
    )
}
#[test]
fn real_cli_create_replay_history_backup_and_reopen() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("local.sqlite");
    let create = json!({"operation_id":"cli:1","document_id":"demo","actor":"local","change":{"kind":"create","app":"map","name":"Example","content_base64":"aGVsbG8="}});
    let (ok, receipt) = run(&path, &["mutate"], Some(&create));
    assert!(ok, "{receipt}");
    assert_eq!(receipt["result"]["document"]["revision"], 1);
    let (ok, replay) = run(&path, &["mutate"], Some(&create));
    assert!(ok);
    assert_eq!(replay["result"]["replayed"], true);
    let (ok, read) = run(&path, &["read", "demo"], None);
    assert!(ok);
    assert_eq!(read["result"]["content_base64"], "aGVsbG8=");
    let (ok, history) = run(&path, &["history", "demo"], None);
    assert!(ok);
    assert_eq!(history["result"].as_array().unwrap().len(), 1);
    let backup = directory.path().join("backup.sqlite");
    assert!(run(&path, &["backup", backup.to_str().unwrap()], None).0);
    assert!(run(&backup, &["verify"], None).0);
    assert_eq!(
        run(&backup, &["mutate"], Some(&create)).1["result"]["replayed"],
        true
    );
}
#[test]
fn cli_returns_typed_conflicts_and_does_not_create_on_bad_command() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("local.sqlite");
    assert!(!run(&path, &["unknown"], None).0);
    assert!(!path.exists());
    assert!(!run(&path, &["read", "missing"], None).0);
    assert!(!path.exists());
    let create = json!({"operation_id":"cli:1","document_id":"demo","actor":"local","change":{"kind":"create","app":"cad","name":"Part","content_base64":""}});
    assert!(run(&path, &["mutate"], Some(&create)).0);
    let save = json!({"operation_id":"cli:2","document_id":"demo","actor":"local","change":{"kind":"save","expected_revision":2,"content_base64":""}});
    let (ok, error) = run(&path, &["mutate"], Some(&save));
    assert!(!ok);
    assert_eq!(error["code"], "revision_conflict");
    assert_eq!(run(&path, &["verify"], None).1["result"]["revisions"], 1);
}
