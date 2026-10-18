use super::*;
use std::sync::{Arc, Barrier};

fn create() -> DocumentMutation {
    DocumentMutation {
        operation_id: "op:1".into(),
        document_id: "doc:1".into(),
        actor: "local-user".into(),
        change: DocumentChange::Create {
            app: "map".into(),
            name: "Show".into(),
            content_base64: STANDARD.encode(b"original"),
        },
    }
}
fn save(operation: &str, expected_revision: u32, bytes: &[u8]) -> DocumentMutation {
    DocumentMutation {
        operation_id: operation.into(),
        change: DocumentChange::Save {
            expected_revision,
            content_base64: STANDARD.encode(bytes),
        },
        ..create()
    }
}
fn fixture() -> (tempfile::TempDir, LocalStore) {
    let directory = tempfile::tempdir().unwrap();
    let store = LocalStore::open(directory.path().join("documents.sqlite")).unwrap();
    (directory, store)
}

#[test]
fn content_restore_preserves_name_history_and_exact_replay() {
    let (_directory, mut store) = fixture();
    store.mutate(&create()).unwrap();
    store
        .mutate(&DocumentMutation {
            operation_id: "rename".into(),
            change: DocumentChange::Rename {
                expected_revision: 1,
                name: "Current name".into(),
            },
            ..create()
        })
        .unwrap();
    let restore = DocumentMutation {
        operation_id: "content-restore".into(),
        change: DocumentChange::Restore {
            expected_revision: 2,
            source_revision: 1,
            preserve_name: Some(true),
        },
        ..create()
    };
    let receipt = store.mutate(&restore).unwrap();
    assert_eq!(receipt.document.name, "Current name");
    assert_eq!(receipt.document.parent_revision, Some(2));
    assert_eq!(receipt.document.restored_from_revision, Some(1));
    assert_eq!(store.read("doc:1", Some(1)).unwrap().document.name, "Show");
    store.mutate(&save("later", 3, b"later")).unwrap();
    assert!(store.mutate(&restore).unwrap().replayed);
    assert_eq!(store.read("doc:1", None).unwrap().document.revision, 4);
    let changed = DocumentMutation {
        change: DocumentChange::Restore {
            expected_revision: 2,
            source_revision: 1,
            preserve_name: None,
        },
        ..restore
    };
    assert!(store.mutate(&changed).is_err());
    store.verify().unwrap();
}

#[test]
fn history_restore_and_blob_deduplication_survive_reopen() {
    let (directory, mut store) = fixture();
    store.mutate(&create()).unwrap();
    store.mutate(&save("op:2", 1, b"changed")).unwrap();
    store
        .mutate(&DocumentMutation {
            operation_id: "rename".into(),
            change: DocumentChange::Rename {
                expected_revision: 2,
                name: "New name".into(),
            },
            ..create()
        })
        .unwrap();
    let receipt = store
        .mutate(&DocumentMutation {
            operation_id: "restore".into(),
            change: DocumentChange::Restore {
                expected_revision: 3,
                source_revision: 1,
                preserve_name: None,
            },
            ..create()
        })
        .unwrap();
    assert_eq!(receipt.document.restored_from_revision, Some(1));
    assert_eq!(receipt.document.name, "Show");
    assert_eq!(store.verify().unwrap().blobs, 2);
    drop(store);
    let store = LocalStore::open(directory.path().join("documents.sqlite")).unwrap();
    assert_eq!(
        store.read("doc:1", None).unwrap().content_base64,
        STANDARD.encode(b"original")
    );
    assert_eq!(
        store.read("doc:1", Some(2)).unwrap().content_base64,
        STANDARD.encode(b"changed")
    );
    assert_eq!(store.history("doc:1").unwrap().len(), 4);
    assert_eq!(store.verify().unwrap().operations, 4);
}

#[test]
fn receipt_replays_original_revision_and_rejects_id_reuse() {
    let (directory, mut store) = fixture();
    let original = store.mutate(&create()).unwrap();
    store.mutate(&save("op:2", 1, b"next")).unwrap();
    drop(store);
    let mut store = LocalStore::open(directory.path().join("documents.sqlite")).unwrap();
    let replay = store.mutate(&create()).unwrap();
    assert!(replay.replayed);
    assert_eq!(replay.document, original.document);
    assert_eq!(
        store
            .mutate(&save("op:1", 2, b"different"))
            .unwrap_err()
            .code,
        StoreErrorCode::OperationConflict
    );
    assert_eq!(store.read("doc:1", None).unwrap().document.revision, 2);
}

#[test]
fn stale_missing_and_invalid_requests_leave_no_records() {
    let (_directory, mut store) = fixture();
    assert_eq!(
        store.mutate(&save("missing", 1, b"x")).unwrap_err().code,
        StoreErrorCode::NotFound
    );
    store.mutate(&create()).unwrap();
    assert_eq!(
        store.mutate(&save("stale", 2, b"x")).unwrap_err().code,
        StoreErrorCode::RevisionConflict
    );
    assert_eq!(
        store.mutate(&save("zero", 0, b"x")).unwrap_err().code,
        StoreErrorCode::InvalidRequest
    );
    let mut bad = create();
    bad.document_id = "../escape".into();
    assert_eq!(
        store.mutate(&bad).unwrap_err().code,
        StoreErrorCode::InvalidRequest
    );
    bad = create();
    bad.change = DocumentChange::Save {
        expected_revision: 1,
        content_base64: "!bad!".into(),
    };
    assert_eq!(
        store.mutate(&bad).unwrap_err().code,
        StoreErrorCode::InvalidRequest
    );
    assert_eq!(store.verify().unwrap().operations, 1);
    assert_eq!(store.verify().unwrap().blobs, 1);
}

#[test]
fn fault_before_commit_rolls_back_every_table() {
    let (_directory, mut store) = fixture();
    store.mutate(&create()).unwrap();
    let error = store
        .mutate_inner(&save("fault", 1, b"uncommitted"), || {
            Err(StoreError::new(
                StoreErrorCode::StorageFailure,
                "Injected storage failure",
            ))
        })
        .unwrap_err();
    assert_eq!(error.code, StoreErrorCode::StorageFailure);
    let report = store.verify().unwrap();
    assert_eq!(
        (report.revisions, report.blobs, report.operations),
        (1, 1, 1)
    );
    assert!(
        !store
            .mutate(&save("fault", 1, b"uncommitted"))
            .unwrap()
            .replayed
    );
}

#[test]
fn independent_connections_serialize_conflicting_edits() {
    let (directory, mut store) = fixture();
    store.mutate(&create()).unwrap();
    let path = directory.path().join("documents.sqlite");
    let barrier = Arc::new(Barrier::new(2));
    let workers: Vec<_> = (0..2)
        .map(|n| {
            let path = path.clone();
            let barrier = barrier.clone();
            std::thread::spawn(move || {
                let mut store = LocalStore::open(path).unwrap();
                barrier.wait();
                store.mutate(&save(&format!("writer:{n}"), 1, b"edit"))
            })
        })
        .collect();
    let results: Vec<_> = workers.into_iter().map(|w| w.join().unwrap()).collect();
    assert_eq!(results.iter().filter(|r| r.is_ok()).count(), 1);
    assert!(
        results
            .iter()
            .filter_map(|r| r.as_ref().err())
            .all(|e| e.code == StoreErrorCode::RevisionConflict)
    );
    assert_eq!(store.verify().unwrap().revisions, 2);
}

#[test]
fn concurrent_duplicate_delivery_commits_only_once() {
    let (directory, mut store) = fixture();
    store.mutate(&create()).unwrap();
    let path = directory.path().join("documents.sqlite");
    let barrier = Arc::new(Barrier::new(2));
    let workers: Vec<_> = (0..2)
        .map(|_| {
            let path = path.clone();
            let barrier = barrier.clone();
            std::thread::spawn(move || {
                let mut store = LocalStore::open(path).unwrap();
                barrier.wait();
                store.mutate(&save("retry", 1, b"same")).unwrap()
            })
        })
        .collect();
    let results: Vec<_> = workers.into_iter().map(|w| w.join().unwrap()).collect();
    assert_eq!(results.iter().filter(|r| r.replayed).count(), 1);
    assert_eq!(store.verify().unwrap().operations, 2);
}

#[test]
fn verified_snapshot_restores_content_history_and_receipts() {
    let (directory, mut store) = fixture();
    store.mutate(&create()).unwrap();
    let backup = directory.path().join("backup.sqlite");
    assert_eq!(store.backup(&backup).unwrap().revisions, 1);
    store.mutate(&save("later", 1, b"later")).unwrap();
    let mut recovered = LocalStore::open(&backup).unwrap();
    assert_eq!(recovered.verify().unwrap().revisions, 1);
    assert!(recovered.mutate(&create()).unwrap().replayed);
    assert_eq!(
        recovered.read("doc:1", None).unwrap().content_base64,
        STANDARD.encode(b"original")
    );
    assert!(store.backup(&backup).is_err());
    assert_eq!(recovered.verify().unwrap().revisions, 1);
    assert_eq!(store.verify().unwrap().revisions, 2);
}

#[test]
fn corruption_is_not_acknowledged_or_published() {
    let (directory, mut store) = fixture();
    store.mutate(&create()).unwrap();
    store
        .connection
        .execute("UPDATE blobs SET content=?1", [b"damaged".as_slice()])
        .unwrap();
    assert_eq!(
        store.read("doc:1", None).unwrap_err().code,
        StoreErrorCode::CorruptStore
    );
    assert_eq!(
        store.verify().unwrap_err().code,
        StoreErrorCode::CorruptStore
    );
    assert_eq!(
        store.mutate(&create()).unwrap_err().code,
        StoreErrorCode::CorruptStore
    );
    let backup = directory.path().join("backup.sqlite");
    assert_eq!(
        store.backup(&backup).unwrap_err().code,
        StoreErrorCode::CorruptStore
    );
    assert!(!backup.exists());
}

#[test]
fn missing_audit_is_detected() {
    let (_directory, mut store) = fixture();
    store.mutate(&create()).unwrap();
    store.connection.execute("DELETE FROM audit", []).unwrap();
    assert_eq!(
        store.mutate(&create()).unwrap_err().code,
        StoreErrorCode::CorruptStore
    );
    assert_eq!(
        store.verify().unwrap_err().code,
        StoreErrorCode::CorruptStore
    );
}

#[test]
fn unknown_database_and_future_schema_are_preserved() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("legacy.sqlite");
    let connection = Connection::open(&path).unwrap();
    connection
        .execute("CREATE TABLE library(content TEXT)", [])
        .unwrap();
    drop(connection);
    let before = std::fs::read(&path).unwrap();
    assert!(matches!(
        LocalStore::open(&path),
        Err(StoreError {
            code: StoreErrorCode::IncompatibleStore,
            ..
        })
    ));
    assert_eq!(std::fs::read(&path).unwrap(), before);
    let path = directory.path().join("future.sqlite");
    let store = LocalStore::open(&path).unwrap();
    store
        .connection
        .pragma_update(None, "user_version", 999)
        .unwrap();
    drop(store);
    assert!(matches!(
        LocalStore::open(&path),
        Err(StoreError {
            code: StoreErrorCode::IncompatibleStore,
            ..
        })
    ));
}

#[test]
fn bounded_content_and_strict_command_shape() {
    assert!(decode(&"A".repeat(MAX_CONTENT_BYTES.div_ceil(3) * 4 + 1)).is_err());
    let mut value = serde_json::to_value(create()).unwrap();
    value["change"]["unexpected"] = serde_json::json!(true);
    assert!(serde_json::from_value::<DocumentMutation>(value).is_err());
}

// Invoked in a child process so the transaction gets no Rust Drop/rollback.
#[test]
fn crash_worker() {
    let Some(path) = std::env::var_os("AETHER_TEST_CRASH_DB") else {
        return;
    };
    let mut store = LocalStore::open(path).unwrap();
    let request = save("crash-op", 1, b"after-crash");
    if std::env::var_os("AETHER_TEST_CRASH_AFTER_COMMIT").is_some() {
        store.mutate(&request).unwrap();
        std::process::exit(86);
    }
    let _ = store.mutate_inner(&request, || std::process::exit(86));
    unreachable!();
}

#[test]
fn process_death_recovers_uncommitted_and_acknowledged_writes() {
    for after_commit in [false, true] {
        let (directory, mut store) = fixture();
        store.mutate(&create()).unwrap();
        drop(store);
        let path = directory.path().join("documents.sqlite");
        let mut command = std::process::Command::new(std::env::current_exe().unwrap());
        command
            .args(["--exact", "tests::crash_worker", "--nocapture"])
            .env("AETHER_TEST_CRASH_DB", &path)
            .env_remove("AETHER_TEST_CRASH_AFTER_COMMIT");
        if after_commit {
            command.env("AETHER_TEST_CRASH_AFTER_COMMIT", "1");
        }
        assert_eq!(command.output().unwrap().status.code(), Some(86));
        let mut store = LocalStore::open(&path).unwrap();
        assert_eq!(
            store.verify().unwrap().revisions,
            if after_commit { 2 } else { 1 }
        );
        assert_eq!(
            store
                .mutate(&save("crash-op", 1, b"after-crash"))
                .unwrap()
                .replayed,
            after_commit
        );
        assert_eq!(store.verify().unwrap().revisions, 2);
    }
}

#[test]
fn busy_writer_fails_without_a_partial_save() {
    let (directory, mut store) = fixture();
    store.mutate(&create()).unwrap();
    store
        .connection
        .busy_timeout(Duration::from_millis(10))
        .unwrap();
    let mut other = Connection::open(directory.path().join("documents.sqlite")).unwrap();
    let tx = other
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .unwrap();
    assert_eq!(
        store.mutate(&save("busy", 1, b"edit")).unwrap_err().code,
        StoreErrorCode::Busy
    );
    drop(tx);
    assert_eq!(store.verify().unwrap().revisions, 1);
    assert!(!store.mutate(&save("busy", 1, b"edit")).unwrap().replayed);
}

#[test]
fn named_save_commits_title_and_bytes_together_and_replays_exactly() {
    let (_directory, mut store) = fixture();
    store.mutate(&create()).unwrap();
    let request = DocumentMutation {
        operation_id: "named-save".into(),
        change: DocumentChange::SaveNamed {
            expected_revision: 1,
            name: "Wheel".into(),
            content_base64: STANDARD.encode(b"embedded Wheel"),
        },
        ..create()
    };
    let saved = store.mutate(&request).unwrap();
    assert_eq!(saved.document.name, "Wheel");
    assert_eq!(saved.document.revision, 2);
    assert_eq!(saved.document.content_sha256, hash(b"embedded Wheel"));
    assert!(store.mutate(&request).unwrap().replayed);
    let mut changed = request.clone();
    if let DocumentChange::SaveNamed { name, .. } = &mut changed.change {
        *name = "Different".into();
    }
    assert!(store.mutate(&changed).is_err());
    changed.operation_id = "stale".into();
    assert!(store.mutate(&changed).is_err());
}
