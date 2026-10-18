use super::*;
use aether_protocol_core::branches::*;
use serde_json::Value;

fn command(op: &str, change: BranchChange) -> BranchCommand {
    BranchCommand {
        operation_id: op.into(),
        document_id: "doc:1".into(),
        actor: "local-user".into(),
        change,
    }
}
fn fork(op: &str, name: &str, main: u32, from: u32) -> BranchCommand {
    command(
        op,
        BranchChange::Create {
            name: name.into(),
            expected_revision: main,
            from_revision: from,
            message: "Design exploration".into(),
        },
    )
}
fn edit(op: &str, branch: &str, head: u32, bytes: &[u8]) -> BranchDocumentMutation {
    BranchDocumentMutation {
        branch: branch.into(),
        mutation: save(op, head, bytes),
    }
}
fn merge(
    op: &str,
    source: &str,
    source_head: u32,
    target: &str,
    target_head: u32,
    resolution: Option<MergeResolution>,
) -> BranchCommand {
    command(
        op,
        BranchChange::Merge {
            source: source.into(),
            target: target.into(),
            expected_source_revision: source_head,
            expected_revision: target_head,
            resolution,
        },
    )
}
fn branch(receipt: &BranchReceipt) -> &BranchHead {
    match &receipt.result {
        BranchResult::Head { branch } => branch,
        _ => panic!("Expected branch"),
    }
}
fn merged(receipt: &BranchReceipt) -> (&DocumentRevision, bool, bool, u32) {
    match &receipt.result {
        BranchResult::Merge {
            document,
            merged,
            fast_forward,
            merge_base_revision,
        } => (document, *merged, *fast_forward, *merge_base_revision),
        _ => panic!("Expected merge"),
    }
}
async fn read(f: &Fixture, scope: &AuthorizedScope, name: &str) -> StoredDocument {
    let mut client = f.pool.get().await.unwrap();
    let tx = client.transaction().await.unwrap();
    let result = f
        .store
        .read_branch_in(&tx, scope, "doc:1", name)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    result
}

async fn identity(f: &Fixture, scope: &AuthorizedScope, name: &str) -> String {
    let mut client = f.pool.get().await.unwrap();
    let tx = client.transaction().await.unwrap();
    f.store
        .branches_in(&tx, scope, "doc:1")
        .await
        .unwrap()
        .into_iter()
        .find(|b| b.name == name)
        .unwrap()
        .id
        .unwrap()
}

#[tokio::test]
#[ignore = "requires the disposable PostgreSQL acceptance runner"]
async fn branch_edits_restore_and_rename_preserve_main_and_immutable_receipts() {
    let f = Fixture::new().await;
    let s = scope("branches");
    f.store.mutate(&s, &create()).await.unwrap();
    let original = f
        .store
        .branch_command(&s, &fork("fork", "Experiment", 1, 1))
        .await
        .unwrap();
    let branch_id = branch(&original).id.clone();
    let work = branch_id.as_deref().unwrap();
    let first = f
        .store
        .mutate_branch(&s, &edit("branch-save", work, 1, b"branch"))
        .await
        .unwrap();
    assert_eq!(first.document.revision, 2);
    assert_eq!(first.document.parent_revision, Some(1));
    assert_eq!(first.document.branch_id, branch_id);
    assert_eq!(read(&f, &s, "Main").await.document.revision, 1);
    let main = f
        .store
        .mutate(&s, &save("main-save", 1, b"main"))
        .await
        .unwrap();
    assert_eq!(main.document.revision, 3);
    assert_eq!(main.document.parent_revision, Some(1));
    assert_eq!(main.document.branch_id, None);
    let restore = BranchDocumentMutation {
        branch: work.into(),
        mutation: DocumentMutation {
            operation_id: "restore-branch".into(),
            change: DocumentChange::Restore {
                expected_revision: 2,
                source_revision: 3,
                preserve_name: Some(true),
            },
            ..create()
        },
    };
    let restored = f.store.mutate_branch(&s, &restore).await.unwrap();
    assert_eq!(restored.document.revision, 4);
    assert_eq!(restored.document.parent_revision, Some(2));
    assert_eq!(restored.document.restored_from_revision, Some(3));
    let rename = command(
        "rename-branch",
        BranchChange::Rename {
            branch: work.into(),
            expected_revision: 4,
            new_name: "Review".into(),
        },
    );
    let renamed = f.store.branch_command(&s, &rename).await.unwrap();
    assert_eq!(branch(&renamed).id, branch_id);
    let erase = command(
        "delete-branch",
        BranchChange::Delete {
            branch: work.into(),
            expected_revision: 4,
            expected_main_revision: 3,
            force: true,
        },
    );
    assert!(branch(&f.store.branch_command(&s, &erase).await.unwrap()).deleted);
    // Renaming/deleting a branch cannot mutate its old receipt, resurrect it,
    // or remove its historical bytes. The caller must still authorize replay.
    let replay = f
        .store
        .branch_command(&s, &fork("fork", "Experiment", 1, 1))
        .await
        .unwrap();
    assert!(replay.replayed);
    assert_eq!(replay.result, original.result);
    assert!(f.store.branch_command(&s, &rename).await.unwrap().replayed);
    assert!(f.store.branch_command(&s, &erase).await.unwrap().replayed);
    assert!(f.store.mutate_branch(&s, &restore).await.unwrap().replayed);
    let replacement = f
        .store
        .branch_command(&s, &fork("new-fork", "Experiment", 3, 3))
        .await
        .unwrap();
    assert_ne!(branch(&replacement).id, branch_id);
    assert_eq!(
        f.store
            .mutate_branch(&s, &edit("stale-tab-save", work, 4, b"wrong branch"))
            .await
            .unwrap_err()
            .code,
        StoreErrorCode::NotFound
    );
    assert_eq!(
        f.store
            .branch_command(
                &s,
                &command(
                    "stale-tab-delete",
                    BranchChange::Delete {
                        branch: work.into(),
                        expected_revision: 4,
                        expected_main_revision: 3,
                        force: true
                    }
                )
            )
            .await
            .unwrap_err()
            .code,
        StoreErrorCode::NotFound
    );

    assert!(
        f.store
            .mutate_branch(&s, &edit("branch-save", work, 1, b"branch"))
            .await
            .unwrap()
            .replayed
    );
    assert_eq!(read(&f, &s, "Experiment").await.document.revision, 3);
    assert_eq!(
        f.store
            .read(&s, "doc:1", Some(2))
            .await
            .unwrap()
            .content_base64,
        STANDARD.encode(b"branch")
    );
    assert_eq!(
        read(&f, &s, "Main").await.content_base64,
        STANDARD.encode(b"main")
    );
    assert_eq!(f.store.verify(&s).await.unwrap().revisions, 4);
    let mut c = f.pool.get().await.unwrap();
    let tx = c.transaction().await.unwrap();
    let heads = f.store.branches_in(&tx, &s, "doc:1").await.unwrap();
    assert_eq!(heads.len(), 2);
    assert_eq!(heads[0].name, "Main");
    assert_eq!(heads[1].name, "Experiment");
}

#[tokio::test]
#[ignore = "requires the disposable PostgreSQL acceptance runner"]
async fn fast_forward_divergent_and_reverse_merges_preserve_both_parents() {
    let f = Fixture::new().await;
    let s = scope("merges");
    f.store.mutate(&s, &create()).await.unwrap();
    f.store
        .branch_command(&s, &fork("fork", "Design", 1, 1))
        .await
        .unwrap();
    let work = identity(&f, &s, "Design").await;
    f.store
        .mutate_branch(&s, &edit("edit", &work, 1, b"design"))
        .await
        .unwrap();
    let ff_request = merge("merge-ff", &work, 2, "Main", 1, None);
    let ff = f.store.branch_command(&s, &ff_request).await.unwrap();
    let (doc, did_merge, fast, base) = merged(&ff);
    assert!(did_merge && fast);
    assert_eq!(base, 1);
    assert_eq!(doc.revision, 3);
    assert_eq!(doc.parent_revision, Some(1));
    assert_eq!(doc.merge_parent_revision, Some(2));
    assert_eq!(doc.restored_from_revision, None);
    let no_op = merge("merge-noop", &work, 2, "Main", 3, None);
    let n = f.store.branch_command(&s, &no_op).await.unwrap();
    assert!(!merged(&n).1);
    assert_eq!(merged(&n).0.revision, 3);
    f.store
        .mutate_branch(&s, &edit("edit-again", &work, 2, b"new design"))
        .await
        .unwrap();
    f.store
        .mutate(&s, &save("main-edit", 3, b"new main"))
        .await
        .unwrap();
    let request = merge("merge-divergent", &work, 4, "Main", 5, None);
    assert_eq!(
        f.store.branch_command(&s, &request).await.unwrap_err().code,
        StoreErrorCode::RevisionConflict
    );
    assert_eq!(f.store.verify(&s).await.unwrap().revisions, 5);
    let resolved = merge(
        "merge-divergent",
        &work,
        4,
        "Main",
        5,
        Some(MergeResolution::Source),
    );
    let r = f.store.branch_command(&s, &resolved).await.unwrap();
    assert!(!merged(&r).2);
    assert_eq!(merged(&r).3, 2);
    assert_eq!(merged(&r).0.parent_revision, Some(5));
    assert_eq!(merged(&r).0.merge_parent_revision, Some(4));
    assert_eq!(
        read(&f, &s, "Main").await.content_base64,
        STANDARD.encode(b"new design")
    );
    let back = f
        .store
        .branch_command(&s, &merge("reverse", "Main", 6, &work, 4, None))
        .await
        .unwrap();
    assert_eq!(merged(&back).0.revision, 7);
    assert!(merged(&back).0.branch_id.is_some());
    assert_eq!(read(&f, &s, "Main").await.document.revision, 6);
    let delete = command(
        "delete",
        BranchChange::Delete {
            branch: work.clone(),
            expected_revision: 7,
            expected_main_revision: 6,
            force: false,
        },
    );
    assert_eq!(
        f.store.branch_command(&s, &delete).await.unwrap_err().code,
        StoreErrorCode::RevisionConflict
    );
    f.store
        .branch_command(&s, &merge("finish", &work, 7, "Main", 6, None))
        .await
        .unwrap();
    let delete = command(
        "delete",
        BranchChange::Delete {
            branch: work.clone(),
            expected_revision: 7,
            expected_main_revision: 8,
            force: false,
        },
    );
    f.store.branch_command(&s, &delete).await.unwrap();
    for old in [&ff_request, &no_op, &resolved] {
        assert!(f.store.branch_command(&s, old).await.unwrap().replayed);
    }
    assert_eq!(f.store.verify(&s).await.unwrap().revisions, 8);
    assert_eq!(f.store.events(&s, "0", 20).await.unwrap().events.len(), 8);
}

#[tokio::test]
#[ignore = "requires the disposable PostgreSQL acceptance runner"]
async fn divergent_target_resolution_keeps_target_bytes_and_records_source_ancestry() {
    let f = Fixture::new().await;
    let s = scope("target");
    f.store.mutate(&s, &create()).await.unwrap();
    f.store
        .branch_command(&s, &fork("fork", "Design", 1, 1))
        .await
        .unwrap();
    let work = identity(&f, &s, "Design").await;
    f.store
        .mutate_branch(&s, &edit("design", &work, 1, b"design"))
        .await
        .unwrap();
    f.store
        .mutate(&s, &save("main", 1, b"target"))
        .await
        .unwrap();
    let r = f
        .store
        .branch_command(
            &s,
            &merge(
                "resolve",
                &work,
                2,
                "Main",
                3,
                Some(MergeResolution::Target),
            ),
        )
        .await
        .unwrap();
    assert_eq!(merged(&r).0.revision, 4);
    assert_eq!(merged(&r).0.merge_parent_revision, Some(2));
    assert_eq!(
        read(&f, &s, "Main").await.content_base64,
        STANDARD.encode(b"target")
    );
    assert_eq!(f.store.verify(&s).await.unwrap().revisions, 4);
}

#[tokio::test]
#[ignore = "requires the disposable PostgreSQL acceptance runner"]
async fn competing_writers_and_duplicate_delivery_use_one_global_revision_sequence() {
    let f = Fixture::new().await;
    let s = scope("concurrent");
    f.store.mutate(&s, &create()).await.unwrap();
    let request = fork("fork", "Work", 1, 1);
    let (a, b) = tokio::join!(
        f.store.branch_command(&s, &request),
        f.store.branch_command(&s, &request)
    );
    assert_ne!(a.unwrap().replayed, b.unwrap().replayed);
    let work = identity(&f, &s, "Work").await;
    let a = edit("branch-save", &work, 1, b"branch");
    let b = save("main-save", 1, b"main");
    let (a, b) = tokio::join!(f.store.mutate_branch(&s, &a), f.store.mutate(&s, &b));
    let a = a.unwrap();
    let b = b.unwrap();
    assert_ne!(a.document.revision, b.document.revision);
    assert_eq!(a.document.parent_revision, Some(1));
    assert_eq!(b.document.parent_revision, Some(1));
    let x = edit("x", &work, a.document.revision, b"x");
    let y = edit("y", &work, a.document.revision, b"y");
    let (x, y) = tokio::join!(f.store.mutate_branch(&s, &x), f.store.mutate_branch(&s, &y));
    assert_eq!(usize::from(x.is_ok()) + usize::from(y.is_ok()), 1);
    let failure = x.err().or(y.err()).unwrap();
    assert_eq!(failure.code, StoreErrorCode::RevisionConflict);
    // Branch metadata and document edits share an operation namespace.
    assert_eq!(
        f.store
            .mutate(&s, &save("fork", b.document.revision, b"no"))
            .await
            .unwrap_err()
            .code,
        StoreErrorCode::OperationConflict
    );
    assert_eq!(
        f.store
            .branch_command(&s, &fork("main-save", "Other", b.document.revision, 1))
            .await
            .unwrap_err()
            .code,
        StoreErrorCode::OperationConflict
    );
    assert_eq!(
        f.store
            .branch_command(&scope("other"), &request)
            .await
            .unwrap_err()
            .code,
        StoreErrorCode::NotFound
    );
    let other = AuthorizedScope::new("concurrent", "different-user").unwrap();
    assert_eq!(
        f.store
            .branch_command(&other, &request)
            .await
            .unwrap_err()
            .code,
        StoreErrorCode::InvalidRequest
    );
    assert_eq!(f.store.verify(&s).await.unwrap().revisions, 4);
}

#[tokio::test]
#[ignore = "requires the disposable PostgreSQL acceptance runner"]
async fn audit_failure_rolls_back_branch_and_merge_heads_receipts_and_events() {
    let f = Fixture::new().await;
    let s = scope("failure");
    f.store.mutate(&s, &create()).await.unwrap();
    let c = f.pool.get().await.unwrap();
    c.batch_execute(
        "ALTER TABLE aether_store.branch_audit ADD CONSTRAINT fail_write CHECK(false) NOT VALID",
    )
    .await
    .unwrap();
    let fork = fork("fork", "Work", 1, 1);
    assert!(f.store.branch_command(&s, &fork).await.is_err());
    assert_eq!(
        c.query_one("SELECT count(*) FROM aether_store.branches", &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        0
    );
    c.batch_execute("ALTER TABLE aether_store.branch_audit DROP CONSTRAINT fail_write")
        .await
        .unwrap();
    assert!(!f.store.branch_command(&s, &fork).await.unwrap().replayed);
    let work = identity(&f, &s, "Work").await;
    f.store
        .mutate_branch(&s, &edit("edit", &work, 1, b"branch"))
        .await
        .unwrap();
    c.batch_execute(
        "ALTER TABLE aether_store.branch_audit ADD CONSTRAINT fail_write CHECK(false) NOT VALID",
    )
    .await
    .unwrap();
    let merge = merge("merge", &work, 2, "Main", 1, None);
    assert!(f.store.branch_command(&s, &merge).await.is_err());
    assert_eq!(read(&f, &s, "Main").await.document.revision, 1);
    assert_eq!(f.store.verify(&s).await.unwrap().revisions, 2);
    assert_eq!(f.store.events(&s, "0", 100).await.unwrap().next_cursor, "2");
    c.batch_execute("ALTER TABLE aether_store.branch_audit DROP CONSTRAINT fail_write")
        .await
        .unwrap();
    assert_eq!(
        merged(&f.store.branch_command(&s, &merge).await.unwrap())
            .0
            .revision,
        3
    );
    // An incomplete audit must not be hidden by successful retry.
    c.batch_execute("DELETE FROM aether_store.branch_audit WHERE operation_id='fork'")
        .await
        .unwrap();
    assert_eq!(
        f.store.branch_command(&s, &fork).await.unwrap_err().code,
        StoreErrorCode::CorruptStore
    );
    assert_eq!(
        f.store.verify(&s).await.unwrap_err().code,
        StoreErrorCode::CorruptStore
    );
}

#[tokio::test]
#[ignore = "requires the disposable PostgreSQL acceptance runner"]
async fn schema_two_upgrade_is_atomic_and_old_revision_json_is_unchanged() {
    use sha2::{Digest, Sha256};
    let f = Fixture::new().await;
    let s = scope("upgrade");
    let original = f.store.mutate(&s, &create()).await.unwrap();
    let c = f.pool.get().await.unwrap();
    let old: Value = c
        .query_one("SELECT metadata FROM aether_store.revisions", &[])
        .await
        .unwrap()
        .get(0);
    assert!(old.get("branch_id").is_none());
    assert!(old.get("merge_parent_revision").is_none());
    let first = format!(
        "{:x}",
        Sha256::digest(include_bytes!("../../src/postgres.sql"))
    );
    let checksum = format!(
        "{:x}",
        Sha256::digest(
            format!(
                "{first}\n{}",
                include_str!("../../src/postgres-002-events.sql")
            )
            .as_bytes()
        )
    );
    c.batch_execute(
        "DROP TABLE aether_store.branch_audit,aether_store.branch_operations,aether_store.branches",
    )
    .await
    .unwrap();
    c.execute(
        "UPDATE aether_store.schema_state SET version=2,checksum=$1",
        &[&checksum],
    )
    .await
    .unwrap();
    c.batch_execute("CREATE VIEW aether_store.branch_operations AS SELECT 1 AS collision")
        .await
        .unwrap();
    assert!(f.store.migrate().await.is_err());
    let row = c.query_one("SELECT version,to_regclass('aether_store.branches') IS NULL FROM aether_store.schema_state", &[]).await.unwrap();
    assert_eq!(row.get::<_, i32>(0), 2);
    assert!(row.get::<_, bool>(1));
    assert_eq!(
        f.store.check_schema().await.unwrap_err().code,
        StoreErrorCode::IncompatibleStore
    );
    c.batch_execute("DROP VIEW aether_store.branch_operations")
        .await
        .unwrap();
    f.store.migrate().await.unwrap();
    f.store.migrate().await.unwrap();
    f.store.check_schema().await.unwrap();
    let new: Value = c
        .query_one("SELECT metadata FROM aether_store.revisions", &[])
        .await
        .unwrap()
        .get(0);
    assert_eq!(old, new);
    let retry = f.store.mutate(&s, &create()).await.unwrap();
    assert!(retry.replayed);
    assert_eq!(retry.document, original.document);
    assert_eq!(f.store.verify(&s).await.unwrap().revisions, 1);
}

#[tokio::test]
#[ignore = "requires the disposable PostgreSQL acceptance runner"]
async fn branch_snapshot_restores_heads_merges_tombstones_and_retries() {
    let f = Fixture::new().await;
    let s = scope("recovery");
    f.store.mutate(&s, &create()).await.unwrap();
    let fork = fork("fork", "Work", 1, 1);
    f.store.branch_command(&s, &fork).await.unwrap();
    let work = identity(&f, &s, "Work").await;
    let edit = edit("edit", &work, 1, b"saved branch");
    f.store.mutate_branch(&s, &edit).await.unwrap();
    let merge = merge("merge", &work, 2, "Main", 1, None);
    f.store.branch_command(&s, &merge).await.unwrap();
    let delete = command(
        "delete",
        BranchChange::Delete {
            branch: work.clone(),
            expected_revision: 2,
            expected_main_revision: 3,
            force: false,
        },
    );
    f.store.branch_command(&s, &delete).await.unwrap();
    let root = PathBuf::from(std::env::var_os("AETHER_TEST_PG_ROOT").unwrap());
    let binaries = PathBuf::from(std::env::var_os("AETHER_PG_BIN").unwrap());
    let dump = root.join(format!("{}.dump", f.name));
    let source = format!(
        "{} dbname={}",
        std::env::var("AETHER_TEST_PG").unwrap(),
        f.name
    );
    assert!(
        Command::new(binaries.join("pg_dump"))
            .args([
                "--format=custom",
                "--no-owner",
                "--dbname",
                &source,
                "--file"
            ])
            .arg(&dump)
            .status()
            .unwrap()
            .success()
    );
    let objects = root.join(format!("{}-objects", f.name));
    copy_tree(&f.objects, &objects);
    f.store
        .mutate(&s, &save("after-snapshot", 3, b"later"))
        .await
        .unwrap();
    let dbname = format!("{}_restored", f.name);
    let config = database(&dbname).await;
    let destination = format!(
        "{} dbname={dbname}",
        std::env::var("AETHER_TEST_PG").unwrap()
    );
    assert!(
        Command::new(binaries.join("pg_restore"))
            .args(["--exit-on-error", "--no-owner", "--dbname", &destination])
            .arg(&dump)
            .status()
            .unwrap()
            .success()
    );
    let recovered = HostedStore::new(pool(config), ContentStore::local(objects).unwrap());
    recovered.check_schema().await.unwrap();
    assert_eq!(recovered.verify(&s).await.unwrap().revisions, 3);
    assert_eq!(
        recovered
            .read(&s, "doc:1", None)
            .await
            .unwrap()
            .content_base64,
        STANDARD.encode(b"saved branch")
    );
    for request in [&fork, &merge, &delete] {
        assert!(
            recovered
                .branch_command(&s, request)
                .await
                .unwrap()
                .replayed
        );
    }
    assert!(recovered.mutate_branch(&s, &edit).await.unwrap().replayed);
    assert_eq!(
        recovered.events(&s, "0", 100).await.unwrap().next_cursor,
        "3"
    );
}

#[tokio::test]
#[ignore = "requires the disposable PostgreSQL acceptance runner"]
async fn branch_validation_and_merge_guards_cannot_overwrite_newer_work() {
    let f = Fixture::new().await;
    let s = scope("guards");
    f.store.mutate(&s, &create()).await.unwrap();
    for name in ["", "Main", " leading", "trailing ", "line\nbreak"] {
        assert_eq!(
            f.store
                .branch_command(&s, &fork("invalid", name, 1, 1))
                .await
                .unwrap_err()
                .code,
            StoreErrorCode::InvalidRequest
        );
    }
    assert_eq!(
        f.store
            .branch_command(&s, &fork("invalid", "Work", 1, 0))
            .await
            .unwrap_err()
            .code,
        StoreErrorCode::InvalidRequest
    );
    assert_eq!(
        f.store
            .branch_command(&s, &fork("invalid", "Work", 1, 99))
            .await
            .unwrap_err()
            .code,
        StoreErrorCode::NotFound
    );
    f.store
        .branch_command(&s, &fork("fork", "Work", 1, 1))
        .await
        .unwrap();
    assert_eq!(
        f.store
            .branch_command(&s, &fork("second", "Work", 1, 1))
            .await
            .unwrap_err()
            .code,
        StoreErrorCode::RevisionConflict
    );
    let work = identity(&f, &s, "Work").await;
    f.store
        .mutate_branch(&s, &edit("save", &work, 1, b"work"))
        .await
        .unwrap();
    let mut client = f.pool.get().await.unwrap();
    let tx = client.transaction().await.unwrap();
    f.store
        .mutate_branch_in(&tx, &s, &edit("newer", &work, 2, b"newer work"))
        .await
        .unwrap();
    let store = f.store.clone();
    let other_scope = s.clone();
    let waiting_id = work.clone();
    let waiting = tokio::spawn(async move {
        store
            .branch_command(
                &other_scope,
                &merge("stale", &waiting_id, 2, "Main", 1, None),
            )
            .await
    });
    tx.commit().await.unwrap();
    assert_eq!(
        waiting.await.unwrap().unwrap_err().code,
        StoreErrorCode::RevisionConflict
    );
    assert_eq!(read(&f, &s, "Main").await.document.revision, 1);
    assert_eq!(
        read(&f, &s, "Work").await.content_base64,
        STANDARD.encode(b"newer work")
    );
    let accepted = merge("stale", &work, 3, "Main", 1, None);
    assert_eq!(
        merged(&f.store.branch_command(&s, &accepted).await.unwrap())
            .0
            .revision,
        4
    );
    let altered = merge("stale", &work, 3, "Main", 1, Some(MergeResolution::Target));
    assert_eq!(
        f.store.branch_command(&s, &altered).await.unwrap_err().code,
        StoreErrorCode::OperationConflict
    );
    assert_eq!(f.store.verify(&s).await.unwrap().revisions, 4);
}

#[tokio::test]
#[ignore = "requires the disposable PostgreSQL acceptance runner"]
async fn integrity_verification_detects_rewound_heads_and_rewritten_lineage() {
    let f = Fixture::new().await;
    let s = scope("corruption");
    f.store.mutate(&s, &create()).await.unwrap();
    f.store
        .branch_command(&s, &fork("fork", "Work", 1, 1))
        .await
        .unwrap();
    let work = identity(&f, &s, "Work").await;
    f.store
        .mutate_branch(&s, &edit("save", &work, 1, b"work"))
        .await
        .unwrap();
    f.store.mutate(&s, &save("main", 1, b"main")).await.unwrap();
    f.store
        .mutate_branch(&s, &edit("save2", &work, 2, b"more work"))
        .await
        .unwrap();
    let c = f.pool.get().await.unwrap();
    c.batch_execute("UPDATE aether_store.documents SET head_revision=1")
        .await
        .unwrap();
    assert_eq!(
        f.store.verify(&s).await.unwrap_err().code,
        StoreErrorCode::CorruptStore
    );
    c.batch_execute("UPDATE aether_store.documents SET head_revision=3; UPDATE aether_store.branches SET head_revision=2").await.unwrap();
    assert_eq!(
        f.store.verify(&s).await.unwrap_err().code,
        StoreErrorCode::CorruptStore
    );
    c.batch_execute("UPDATE aether_store.branches SET head_revision=4")
        .await
        .unwrap();
    assert_eq!(f.store.verify(&s).await.unwrap().revisions, 4);
    // Even matching corrupted receipt/revision JSON cannot disguise switching
    // a branch's first-parent chain to another branch's newer revision.
    c.batch_execute("UPDATE aether_store.revisions SET metadata=jsonb_set(metadata,'{parent_revision}','3') WHERE revision=4; UPDATE aether_store.operations SET receipt=jsonb_set(receipt,'{parent_revision}','3') WHERE revision=4").await.unwrap();
    assert_eq!(
        f.store.verify(&s).await.unwrap_err().code,
        StoreErrorCode::CorruptStore
    );
}
