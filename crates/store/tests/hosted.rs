//! Invoked by dev/rebuild/postgres_check.py against a private disposable cluster.
//! Ignored in plain cargo test; the full framework gate invokes these explicitly.
use aether_protocol_core::storage::*;
use aether_store::{
    LocalStore,
    hosted::{AuthorizedScope, ContentStore, HostedStore},
};
use base64::{Engine, engine::general_purpose::STANDARD};
use deadpool_postgres::{Manager, Pool, Runtime};
use std::{
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::{AtomicU32, Ordering},
    time::Duration,
};
use tokio_postgres::{Config, NoTls};

static NEXT: AtomicU32 = AtomicU32::new(1);
struct Fixture {
    store: HostedStore,
    pool: Pool,
    objects: PathBuf,
    config: Config,
    name: String,
}
fn pool(config: Config) -> Pool {
    Pool::builder(Manager::new(config, NoTls))
        .max_size(8)
        .runtime(Runtime::Tokio1)
        .wait_timeout(Some(Duration::from_secs(5)))
        .create_timeout(Some(Duration::from_secs(5)))
        .recycle_timeout(Some(Duration::from_secs(5)))
        .build()
        .unwrap()
}
async fn database(name: &str) -> Config {
    let mut config: Config = std::env::var("AETHER_TEST_PG")
        .expect("Use postgres_check.py; a disposable database is required.")
        .parse()
        .unwrap();
    let admin = pool(config.clone());
    admin
        .get()
        .await
        .unwrap()
        .batch_execute(&format!("CREATE DATABASE {name}"))
        .await
        .unwrap();
    admin.close();
    config.dbname(name);
    config
}
impl Fixture {
    async fn new() -> Self {
        let name = format!("aether_fixture_{}", NEXT.fetch_add(1, Ordering::Relaxed));
        let config = database(&name).await;
        let pool = pool(config.clone());
        let objects = PathBuf::from(std::env::var_os("AETHER_TEST_OBJECTS").unwrap()).join(&name);
        std::fs::create_dir(&objects).unwrap();
        let store = HostedStore::new(pool.clone(), ContentStore::local(&objects).unwrap());
        store.migrate().await.unwrap();
        Self {
            store,
            pool,
            objects,
            config,
            name,
        }
    }
}
fn scope(tenant: &str) -> AuthorizedScope {
    AuthorizedScope::new(tenant, "local-user").unwrap()
}
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
fn save(op: &str, revision: u32, bytes: &[u8]) -> DocumentMutation {
    DocumentMutation {
        operation_id: op.into(),
        change: DocumentChange::Save {
            expected_revision: revision,
            content_base64: STANDARD.encode(bytes),
        },
        ..create()
    }
}
fn comparable(mut doc: DocumentRevision) -> DocumentRevision {
    doc.saved_unix_ms = 0;
    doc
}

#[tokio::test]
#[ignore = "requires the disposable PostgreSQL acceptance runner"]
async fn local_and_hosted_commands_have_identical_semantics() {
    let fixture = Fixture::new().await;
    let scope = scope("one");
    let temp = tempfile::tempdir().unwrap();
    let mut local = LocalStore::open(temp.path().join("store.sqlite")).unwrap();
    let commands = [
        create(),
        save("op:2", 1, b"second"),
        DocumentMutation {
            operation_id: "rename".into(),
            change: DocumentChange::Rename {
                expected_revision: 2,
                name: "Next".into(),
            },
            ..create()
        },
        DocumentMutation {
            operation_id: "restore".into(),
            change: DocumentChange::Restore {
                expected_revision: 3,
                source_revision: 1,
                preserve_name: None,
            },
            ..create()
        },
    ];
    for command in &commands {
        let a = local.mutate(command).unwrap();
        let b = fixture.store.mutate(&scope, command).await.unwrap();
        assert_eq!(comparable(a.document), comparable(b.document));
    }
    assert_eq!(
        fixture
            .store
            .read(&scope, "doc:1", None)
            .await
            .unwrap()
            .content_base64,
        local.read("doc:1", None).unwrap().content_base64
    );
    assert_eq!(fixture.store.verify(&scope).await.unwrap().revisions, 4);
    let first = fixture.store.history(&scope, "doc:1", 0, 2).await.unwrap();
    let next = fixture
        .store
        .history(&scope, "doc:1", first.last().unwrap().revision, 2)
        .await
        .unwrap();
    assert_eq!(
        first
            .iter()
            .chain(next.iter())
            .map(|r| r.revision)
            .collect::<Vec<_>>(),
        vec![1, 2, 3, 4]
    );
    fixture.store.migrate().await.unwrap();
}

#[tokio::test]
#[ignore = "requires the disposable PostgreSQL acceptance runner"]
async fn tenant_scope_and_actor_validation_prevent_cross_scope_replay() {
    let fixture = Fixture::new().await;
    let a = scope("tenant-a");
    let b = scope("tenant-b");
    fixture.store.mutate(&a, &create()).await.unwrap();
    assert_eq!(
        fixture
            .store
            .read(&b, "doc:1", None)
            .await
            .unwrap_err()
            .code,
        StoreErrorCode::NotFound
    );
    assert_eq!(
        fixture
            .store
            .history(&b, "doc:1", 0, 10)
            .await
            .unwrap_err()
            .code,
        StoreErrorCode::NotFound
    );
    assert!(!fixture.store.mutate(&b, &create()).await.unwrap().replayed);
    assert_eq!(fixture.store.verify(&a).await.unwrap().revisions, 1);
    assert_eq!(fixture.store.verify(&b).await.unwrap().revisions, 1);
    let mut forged = save("forged", 1, b"bad");
    forged.actor = "someone-else".into();
    assert_eq!(
        fixture.store.mutate(&a, &forged).await.unwrap_err().code,
        StoreErrorCode::InvalidRequest
    );
    let mut reused = create();
    reused.change = DocumentChange::Create {
        app: "cad".into(),
        name: "different".into(),
        content_base64: STANDARD.encode(b"x"),
    };
    assert_eq!(
        fixture.store.mutate(&a, &reused).await.unwrap_err().code,
        StoreErrorCode::OperationConflict
    );
}

#[tokio::test]
#[ignore = "requires the disposable PostgreSQL acceptance runner"]
async fn independent_connections_guard_revisions_and_deduplicate_delivery() {
    let fixture = Fixture::new().await;
    let scope = scope("concurrent");
    fixture.store.mutate(&scope, &create()).await.unwrap();
    let one = save("writer1", 1, b"one");
    let two = save("writer2", 1, b"two");
    let (a, b) = tokio::join!(
        fixture.store.mutate(&scope, &one),
        fixture.store.mutate(&scope, &two)
    );
    assert_eq!(usize::from(a.is_ok()) + usize::from(b.is_ok()), 1);
    assert_eq!(
        a.err().or(b.err()).unwrap().code,
        StoreErrorCode::RevisionConflict
    );
    let duplicate = save("same", 2, b"same");
    let (a, b) = tokio::join!(
        fixture.store.mutate(&scope, &duplicate),
        fixture.store.mutate(&scope, &duplicate)
    );
    assert_ne!(a.unwrap().replayed, b.unwrap().replayed);
    let replay = fixture.store.mutate(&scope, &create()).await.unwrap();
    assert!(replay.replayed);
    assert_eq!(replay.document.revision, 1);
    assert_eq!(fixture.store.verify(&scope).await.unwrap().revisions, 3);
    let fresh = HostedStore::new(
        pool(fixture.config.clone()),
        ContentStore::local(&fixture.objects).unwrap(),
    );
    assert!(fresh.mutate(&scope, &duplicate).await.unwrap().replayed);
}

#[tokio::test]
#[ignore = "requires the disposable PostgreSQL acceptance runner"]
async fn transaction_failure_leaves_no_partial_history_or_receipt() {
    let fixture = Fixture::new().await;
    let scope = scope("rollback");
    fixture.store.mutate(&scope, &create()).await.unwrap();
    let client = fixture.pool.get().await.unwrap();
    client.batch_execute("CREATE FUNCTION aether_store.fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$; CREATE TRIGGER injected BEFORE INSERT ON aether_store.audit FOR EACH ROW EXECUTE FUNCTION aether_store.fail_audit();").await.unwrap();
    let change = save("fault", 1, b"new-content");
    assert!(fixture.store.mutate(&scope, &change).await.is_err());
    assert_eq!(fixture.store.verify(&scope).await.unwrap().revisions, 1);
    client
        .batch_execute("DROP TRIGGER injected ON aether_store.audit")
        .await
        .unwrap();
    assert!(
        !fixture
            .store
            .mutate(&scope, &change)
            .await
            .unwrap()
            .replayed
    );
    assert_eq!(fixture.store.verify(&scope).await.unwrap().revisions, 2);
}

#[tokio::test]
#[ignore = "requires the disposable PostgreSQL acceptance runner"]
async fn failed_or_corrupted_objects_cannot_be_acknowledged() {
    let fixture = Fixture::new().await;
    let scope = scope("objects");
    // Replace the private object root with a file to force the object write to fail.
    std::fs::remove_dir(&fixture.objects).unwrap();
    std::fs::write(&fixture.objects, b"blocked").unwrap();
    assert!(fixture.store.mutate(&scope, &create()).await.is_err());
    assert_eq!(fixture.store.verify(&scope).await.unwrap().revisions, 0);
    std::fs::remove_file(&fixture.objects).unwrap();
    std::fs::create_dir(&fixture.objects).unwrap();
    let receipt = fixture.store.mutate(&scope, &create()).await.unwrap();
    let object = std::fs::read_dir(fixture.objects.join("v1"))
        .unwrap()
        .next()
        .unwrap()
        .unwrap()
        .path()
        .join(&receipt.document.content_sha256);
    std::fs::write(object, b"damaged!").unwrap();
    assert_eq!(
        fixture
            .store
            .read(&scope, "doc:1", None)
            .await
            .unwrap_err()
            .code,
        StoreErrorCode::CorruptStore
    );
    assert_eq!(
        fixture.store.verify(&scope).await.unwrap_err().code,
        StoreErrorCode::CorruptStore
    );
    assert_eq!(
        fixture
            .store
            .mutate(&scope, &create())
            .await
            .unwrap_err()
            .code,
        StoreErrorCode::CorruptStore
    );
}

#[tokio::test]
#[ignore = "requires the disposable PostgreSQL acceptance runner"]
async fn unknown_migrations_and_damaged_audit_are_refused() {
    let fixture = Fixture::new().await;
    let scope = scope("format");
    fixture.store.mutate(&scope, &create()).await.unwrap();
    let client = fixture.pool.get().await.unwrap();
    client
        .execute("UPDATE aether_store.schema_state SET version=999", &[])
        .await
        .unwrap();
    assert_eq!(
        fixture.store.migrate().await.unwrap_err().code,
        StoreErrorCode::IncompatibleStore
    );
    client
        .execute("UPDATE aether_store.schema_state SET version=3", &[])
        .await
        .unwrap();
    fixture.store.migrate().await.unwrap();
    client
        .execute("DELETE FROM aether_store.audit", &[])
        .await
        .unwrap();
    assert_eq!(
        fixture.store.verify(&scope).await.unwrap_err().code,
        StoreErrorCode::CorruptStore
    );
    assert_eq!(
        fixture
            .store
            .mutate(&scope, &create())
            .await
            .unwrap_err()
            .code,
        StoreErrorCode::CorruptStore
    );
}

fn copy_tree(from: &Path, to: &Path) {
    std::fs::create_dir_all(to).unwrap();
    for item in std::fs::read_dir(from).unwrap() {
        let item = item.unwrap();
        let dest = to.join(item.file_name());
        if item.file_type().unwrap().is_dir() {
            copy_tree(&item.path(), &dest)
        } else {
            std::fs::copy(item.path(), dest).unwrap();
        }
    }
}
#[tokio::test]
#[ignore = "requires the disposable PostgreSQL acceptance runner"]
async fn pg_dump_and_object_snapshot_restore_to_an_independent_database() {
    let fixture = Fixture::new().await;
    let scope = scope("backup");
    fixture.store.mutate(&scope, &create()).await.unwrap();
    let change = save("op:2", 1, b"saved");
    fixture.store.mutate(&scope, &change).await.unwrap();
    let root = PathBuf::from(std::env::var_os("AETHER_TEST_PG_ROOT").unwrap());
    let binaries = PathBuf::from(std::env::var_os("AETHER_PG_BIN").unwrap());
    let dump = root.join(format!("{}.dump", fixture.name));
    let source = format!(
        "{} dbname={}",
        std::env::var("AETHER_TEST_PG").unwrap(),
        fixture.name
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
    let recovery_objects = root.join("recovery-objects");
    copy_tree(&fixture.objects, &recovery_objects);
    // Work after the snapshot must not appear in the recovered store.
    fixture
        .store
        .mutate(&scope, &save("op:3", 2, b"later"))
        .await
        .unwrap();
    let config = database("aether_recovered").await;
    let destination = format!(
        "{} dbname=aether_recovered",
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
    let recovered = HostedStore::new(pool(config), ContentStore::local(recovery_objects).unwrap());
    recovered.migrate().await.unwrap();
    assert_eq!(recovered.verify(&scope).await.unwrap().revisions, 2);
    assert_eq!(
        recovered
            .read(&scope, "doc:1", None)
            .await
            .unwrap()
            .content_base64,
        STANDARD.encode(b"saved")
    );
    assert!(recovered.mutate(&scope, &change).await.unwrap().replayed);
    assert_eq!(
        recovered
            .events(&scope, "0", 100)
            .await
            .unwrap()
            .next_cursor,
        "2"
    );
    assert_eq!(fixture.store.verify(&scope).await.unwrap().revisions, 3);
}

#[tokio::test]
#[ignore = "requires the disposable PostgreSQL acceptance runner"]
async fn abrupt_postgres_restart_preserves_committed_content_and_retry_receipt() {
    let fixture = Fixture::new().await;
    let scope = scope("restart");
    fixture.store.mutate(&scope, &create()).await.unwrap();
    let change = save("durable", 1, b"committed-before-restart");
    fixture.store.mutate(&scope, &change).await.unwrap();
    fixture.pool.close();
    let root = PathBuf::from(std::env::var_os("AETHER_TEST_PG_ROOT").unwrap());
    assert!(root.to_str().unwrap().starts_with("/tmp/aether-pg-"));
    let binaries = PathBuf::from(std::env::var_os("AETHER_PG_BIN").unwrap());
    assert!(
        Command::new(binaries.join("pg_ctl"))
            .arg("-D")
            .arg(root.join("database"))
            .arg("-l")
            .arg(root.join("postgres.log"))
            .args(["-m", "immediate", "-w", "restart"])
            .status()
            .unwrap()
            .success()
    );
    let fresh = HostedStore::new(
        pool(fixture.config.clone()),
        ContentStore::local(&fixture.objects).unwrap(),
    );
    assert_eq!(fresh.verify(&scope).await.unwrap().revisions, 2);
    assert_eq!(
        fresh
            .read(&scope, "doc:1", None)
            .await
            .unwrap()
            .content_base64,
        STANDARD.encode(b"committed-before-restart")
    );
    assert!(fresh.mutate(&scope, &change).await.unwrap().replayed);
    let page = fresh.events(&scope, "1", 100).await.unwrap();
    assert_eq!(page.next_cursor, "2");
    assert_eq!(page.events[0].document.operation_id, "durable");
    assert_eq!(fresh.verify(&scope).await.unwrap().revisions, 2);
}

async fn downgrade_fixture_to_v1(fixture: &Fixture) {
    // Reconstruct the exact historical schema in a private database. Never used
    // by production migration; old data/receipts/objects remain unchanged.
    use sha2::{Digest, Sha256};
    let client = fixture.pool.get().await.unwrap();
    client.batch_execute("DROP TABLE aether_store.branch_audit,aether_store.branch_operations,aether_store.branches; DROP TRIGGER revision_has_event ON aether_store.revisions; DROP FUNCTION aether_store.require_revision_event(); DROP TABLE aether_store.document_events; DROP TABLE aether_store.event_cursors;").await.unwrap();
    let checksum = format!(
        "{:x}",
        Sha256::digest(include_bytes!("../src/postgres.sql"))
    );
    client
        .execute(
            "UPDATE aether_store.schema_state SET version=1,checksum=$1",
            &[&checksum],
        )
        .await
        .unwrap();
}

#[tokio::test]
#[ignore = "requires the disposable PostgreSQL acceptance runner"]
async fn event_upgrade_is_atomic_repeatable_and_keeps_old_history() {
    let fixture = Fixture::new().await;
    let scope = scope("upgrade");
    fixture.store.mutate(&scope, &create()).await.unwrap();
    fixture
        .store
        .mutate(&scope, &save("save:2", 1, b"saved"))
        .await
        .unwrap();
    downgrade_fixture_to_v1(&fixture).await;
    let client = fixture.pool.get().await.unwrap();
    // Fail after migration has started, proving table creation and the version
    // marker roll back together, with the old history still readable.
    client
        .batch_execute("CREATE TABLE aether_store.document_events(collision boolean)")
        .await
        .unwrap();
    assert!(fixture.store.migrate().await.is_err());
    let row = client.query_one("SELECT version,to_regclass('aether_store.event_cursors') IS NULL FROM aether_store.schema_state", &[]).await.unwrap();
    assert_eq!(row.get::<_, i32>(0), 1);
    assert!(row.get::<_, bool>(1));
    assert_eq!(
        fixture
            .store
            .read(&scope, "doc:1", None)
            .await
            .unwrap()
            .content_base64,
        STANDARD.encode(b"saved")
    );
    client
        .batch_execute("DROP TABLE aether_store.document_events")
        .await
        .unwrap();
    fixture.store.migrate().await.unwrap();
    fixture.store.migrate().await.unwrap();
    let page = fixture.store.events(&scope, "0", 1).await.unwrap();
    assert_eq!(page.next_cursor, "1");
    assert!(page.has_more);
    assert!(matches!(
        page.events[0].kind,
        DocumentEventKind::HistoryBackfill
    ));
    let second = fixture
        .store
        .events(&scope, &page.next_cursor, 20)
        .await
        .unwrap();
    assert_eq!(second.events[0].document.revision, 2);
    assert!(!second.has_more);
    assert!(
        fixture
            .store
            .mutate(&scope, &create())
            .await
            .unwrap()
            .replayed
    );
    fixture
        .store
        .mutate(&scope, &save("save:3", 2, b"new"))
        .await
        .unwrap();
    let page = fixture.store.events(&scope, "2", 20).await.unwrap();
    assert_eq!(page.next_cursor, "3");
    assert!(matches!(
        page.events[0].kind,
        DocumentEventKind::RevisionCommitted
    ));
    assert_eq!(fixture.store.verify(&scope).await.unwrap().revisions, 3);
}

#[tokio::test]
#[ignore = "requires the disposable PostgreSQL acceptance runner"]
async fn event_failure_rolls_back_mutation_cursor_and_operation_id() {
    let fixture = Fixture::new().await;
    let scope = scope("failure");
    fixture.store.mutate(&scope, &create()).await.unwrap();
    let client = fixture.pool.get().await.unwrap();
    client.batch_execute("CREATE FUNCTION aether_store.fail_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected event failure'; END $$; CREATE TRIGGER injected_event BEFORE INSERT ON aether_store.document_events FOR EACH ROW EXECUTE FUNCTION aether_store.fail_event();").await.unwrap();
    let update = save("second", 1, b"next");
    assert!(fixture.store.mutate(&scope, &update).await.is_err());
    assert_eq!(fixture.store.verify(&scope).await.unwrap().revisions, 1);
    let page = fixture.store.events(&scope, "0", 100).await.unwrap();
    assert_eq!(page.next_cursor, "1");
    client
        .batch_execute("DROP TRIGGER injected_event ON aether_store.document_events")
        .await
        .unwrap();
    assert!(
        !fixture
            .store
            .mutate(&scope, &update)
            .await
            .unwrap()
            .replayed
    );
    assert!(
        fixture
            .store
            .mutate(&scope, &update)
            .await
            .unwrap()
            .replayed
    );
    let page = fixture.store.events(&scope, "1", 100).await.unwrap();
    assert_eq!(page.events.len(), 1);
    assert_eq!(page.next_cursor, "2");
    // Older software cannot bypass the event transaction after upgrading.
    let mut writer = fixture.pool.get().await.unwrap();
    let tx = writer.transaction().await.unwrap();
    tx.execute("INSERT INTO aether_store.revisions SELECT tenant,document_id,3,metadata FROM aether_store.revisions WHERE tenant=$1 AND revision=2", &[&"failure"]).await.unwrap();
    assert!(tx.commit().await.is_err());
    assert_eq!(fixture.store.verify(&scope).await.unwrap().revisions, 2);
}

#[tokio::test]
#[ignore = "requires the disposable PostgreSQL acceptance runner"]
async fn commit_ordered_cursors_do_not_skip_concurrent_documents_or_cross_tenants() {
    let fixture = Fixture::new().await;
    let first_scope = scope("one");
    fixture.store.mutate(&first_scope, &create()).await.unwrap();
    let mut blocker = fixture.pool.get().await.unwrap();
    let tx = blocker.transaction().await.unwrap();
    tx.execute(
        "UPDATE aether_store.event_cursors SET last_cursor=last_cursor WHERE tenant='one'",
        &[],
    )
    .await
    .unwrap();
    let second = DocumentMutation {
        document_id: "doc:2".into(),
        operation_id: "op:2".into(),
        ..create()
    };
    let third = DocumentMutation {
        document_id: "doc:3".into(),
        operation_id: "op:3".into(),
        ..create()
    };
    let store_a = fixture.store.clone();
    let scope_a = first_scope.clone();
    let a = tokio::spawn(async move { store_a.mutate(&scope_a, &second).await });
    let store_b = fixture.store.clone();
    let scope_b = first_scope.clone();
    let b = tokio::spawn(async move { store_b.mutate(&scope_b, &third).await });
    // Wait until the actual database reports both writers waiting on locks.
    let monitor = fixture.pool.get().await.unwrap();
    tokio::time::timeout(Duration::from_secs(3), async {
        loop {
            let waiting:i64=monitor.query_one("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'",&[]).await.unwrap().get(0);
            if waiting >= 2 { break; }
            tokio::task::yield_now().await;
        }
    }).await.unwrap();
    assert!(!a.is_finished() && !b.is_finished());
    assert!(
        fixture
            .store
            .events(&first_scope, "1", 100)
            .await
            .unwrap()
            .events
            .is_empty()
    );
    let other = scope("two");
    fixture.store.mutate(&other, &create()).await.unwrap();
    assert_eq!(
        fixture
            .store
            .events(&other, "0", 100)
            .await
            .unwrap()
            .next_cursor,
        "1"
    );
    tx.commit().await.unwrap();
    a.await.unwrap().unwrap();
    b.await.unwrap().unwrap();
    let page = fixture.store.events(&first_scope, "1", 100).await.unwrap();
    assert_eq!(
        page.events
            .iter()
            .map(|e| e.cursor.as_str())
            .collect::<Vec<_>>(),
        vec!["2", "3"]
    );
    assert!(!page.has_more);
    assert_eq!(
        fixture.store.verify(&first_scope).await.unwrap().revisions,
        3
    );
    let replay = fixture.store.events(&first_scope, "1", 1).await.unwrap();
    assert_eq!(replay.events[0].document, page.events[0].document);
    assert!(replay.has_more);
    for invalid in ["", "01", "-1", "1.0", "9223372036854775808", "4"] {
        assert_eq!(
            fixture
                .store
                .events(&first_scope, invalid, 100)
                .await
                .unwrap_err()
                .code,
            StoreErrorCode::InvalidRequest
        );
    }
}

#[tokio::test]
#[ignore = "requires the disposable PostgreSQL acceptance runner"]
async fn missing_events_are_reported_instead_of_silently_advancing_cursor() {
    let fixture = Fixture::new().await;
    let scope = scope("damaged");
    fixture.store.mutate(&scope, &create()).await.unwrap();
    fixture
        .store
        .mutate(&scope, &save("second", 1, b"next"))
        .await
        .unwrap();
    fixture
        .pool
        .get()
        .await
        .unwrap()
        .execute(
            "DELETE FROM aether_store.document_events WHERE tenant='damaged' AND cursor=1",
            &[],
        )
        .await
        .unwrap();
    assert_eq!(
        fixture
            .store
            .events(&scope, "0", 100)
            .await
            .unwrap_err()
            .code,
        StoreErrorCode::CorruptStore
    );
    assert_eq!(
        fixture.store.verify(&scope).await.unwrap_err().code,
        StoreErrorCode::CorruptStore
    );
}

#[path = "hosted/branches.rs"]
mod branches;
