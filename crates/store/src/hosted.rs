//! Hosted persistence: PostgreSQL metadata plus an object-store content boundary.
//! This is a trusted storage adapter, NOT an authentication or ACL API.
use super::*;
use deadpool_postgres::Pool;
use object_store::{ObjectStore, ObjectStoreExt, PutMode, PutOptions, path::Path as ObjectPath};
use std::path::Path;
use std::sync::Arc;
use tokio_postgres::{GenericClient, IsolationLevel};

#[path = "hosted_branches.rs"]
mod branches;
#[path = "hosted_listing.rs"]
mod listing;
#[path = "hosted_uploads.rs"]
mod uploads;
pub use uploads::UPLOAD_CHUNK_BYTES;

const SCHEMA: &str = include_str!("postgres.sql");
const EVENTS_MIGRATION: &str = include_str!("postgres-002-events.sql");
const BRANCHES_MIGRATION: &str = include_str!("postgres-003-branches.sql");
pub const HOSTED_SCHEMA_VERSION: i32 = 3;
fn schema_checksum(version: i32) -> String {
    let first = hash(SCHEMA.as_bytes());
    let second = hash(format!("{first}\n{EVENTS_MIGRATION}").as_bytes());
    match version {
        1 => first,
        2 => second,
        _ => hash(format!("{second}\n{BRANCHES_MIGRATION}").as_bytes()),
    }
}
const OBJECT_TIMEOUT: Duration = Duration::from_secs(10);

/// Opaque invalidation key only; notifications are never document data or access
/// grants. Framing prevents ambiguous tenant/document concatenation.
pub fn revision_signal_key(tenant: &str, document: &str) -> String {
    hash(format!("{}:{tenant}{document}", tenant.len()).as_bytes())
}

/// The caller must obtain this scope from authenticated identity and check document
/// permissions before calling this adapter, including reads and receipt replay.
#[derive(Clone, Debug)]
pub struct AuthorizedScope {
    tenant: String,
    actor: String,
}
impl AuthorizedScope {
    pub fn new(tenant: impl Into<String>, actor: impl Into<String>) -> Result<Self> {
        let scope = Self {
            tenant: tenant.into(),
            actor: actor.into(),
        };
        validate_id(&scope.tenant)?;
        validate_id(&scope.actor)?;
        Ok(scope)
    }
}

/// The disk backend explicitly flushes files and directories after the object
/// library's atomic publication. Atomic rename alone is not crash durability.
#[derive(Clone)]
pub struct ContentStore {
    objects: Arc<dyn ObjectStore>,
    local_root: Option<std::path::PathBuf>,
}
impl ContentStore {
    pub fn local(root: impl AsRef<Path>) -> Result<Self> {
        let root = root.as_ref().canonicalize()?;
        let objects = object_store::local::LocalFileSystem::new_with_prefix(&root)
            .map_err(|_| object_error())?;
        Ok(Self {
            objects: Arc::new(objects),
            local_root: Some(root),
        })
    }
    pub fn s3(store: object_store::aws::AmazonS3) -> Self {
        Self {
            objects: Arc::new(store),
            local_root: None,
        }
    }
    async fn flush(&self, key: &ObjectPath) -> Result<()> {
        if let Some(root) = self.local_root.clone() {
            let path = root.join(key.as_ref());
            tokio::task::spawn_blocking(move || -> Result<()> {
                std::fs::File::open(&path)?.sync_all()?;
                #[cfg(unix)]
                {
                    let mut directory = path.parent();
                    while let Some(current) = directory {
                        std::fs::File::open(current)?.sync_all()?;
                        if current == root {
                            break;
                        }
                        directory = current.parent();
                    }
                }
                Ok(())
            })
            .await
            .map_err(|_| object_error())??;
        }
        Ok(())
    }
}

#[derive(Clone)]
pub struct HostedStore {
    pool: Pool,
    content: ContentStore,
}
impl HostedStore {
    /// The pool's connector owns TLS configuration. No credentials are logged.
    pub fn new(pool: Pool, content: ContentStore) -> Self {
        Self { pool, content }
    }

    /// Read-only readiness; never initialize or change an existing database.
    pub async fn check_schema(&self) -> Result<()> {
        let mut client = self.pool.get().await.map_err(pool_error)?;
        let tx = client.transaction().await.map_err(pg_error)?;
        deadlines(&*tx).await?;
        let exists: bool = tx
            .query_one(
                "SELECT to_regclass('aether_store.schema_state') IS NOT NULL",
                &[],
            )
            .await
            .map_err(pg_error)?
            .get(0);
        if !exists {
            return Err(StoreError::new(
                StoreErrorCode::IncompatibleStore,
                "Store migration is required.",
            ));
        }
        let rows = tx
            .query(
                "SELECT version,checksum FROM aether_store.schema_state",
                &[],
            )
            .await
            .map_err(pg_error)?;
        if rows.len() != 1
            || rows[0].get::<_, i32>(0) != HOSTED_SCHEMA_VERSION
            || rows[0].get::<_, String>(1) != schema_checksum(HOSTED_SCHEMA_VERSION)
        {
            return Err(StoreError::new(
                StoreErrorCode::IncompatibleStore,
                "Store migration is required.",
            ));
        }
        tx.commit().await.map_err(pg_error)?;
        Ok(())
    }

    /// Explicit provisioning only. Never invoked on each command or existing apps.
    pub async fn migrate(&self) -> Result<()> {
        let mut client = self.pool.get().await.map_err(pool_error)?;
        let tx = client.transaction().await.map_err(pg_error)?;
        deadlines(&*tx).await?;
        tx.execute("SELECT pg_advisory_xact_lock(1095062600)", &[])
            .await
            .map_err(pg_error)?;
        let exists: bool = tx
            .query_one("SELECT to_regnamespace('aether_store') IS NOT NULL", &[])
            .await
            .map_err(pg_error)?
            .get(0);
        let mut version = 1;
        if exists {
            let marker: bool = tx
                .query_one(
                    "SELECT to_regclass('aether_store.schema_state') IS NOT NULL",
                    &[],
                )
                .await
                .map_err(pg_error)?
                .get(0);
            if !marker {
                return Err(StoreError::new(
                    StoreErrorCode::IncompatibleStore,
                    "Existing schema is not an Aether store.",
                ));
            }
            let rows = tx
                .query(
                    "SELECT version,checksum FROM aether_store.schema_state",
                    &[],
                )
                .await
                .map_err(pg_error)?;
            if rows.len() != 1
                || !(1..=HOSTED_SCHEMA_VERSION).contains(&rows[0].get::<_, i32>(0))
                || rows[0].get::<_, String>(1) != schema_checksum(rows[0].get(0))
            {
                return Err(StoreError::new(
                    StoreErrorCode::IncompatibleStore,
                    "Unsupported hosted schema version or checksum.",
                ));
            }
            version = rows[0].get(0);
        } else {
            tx.batch_execute(SCHEMA).await.map_err(pg_error)?;
            tx.execute(
                "INSERT INTO aether_store.schema_state VALUES(true,1,$1)",
                &[&hash(SCHEMA.as_bytes())],
            )
            .await
            .map_err(pg_error)?;
        }
        if version == 1 {
            tx.batch_execute(EVENTS_MIGRATION).await.map_err(pg_error)?;
            version = 2;
        }
        if version == 2 {
            tx.batch_execute(BRANCHES_MIGRATION)
                .await
                .map_err(pg_error)?;
        }
        tx.execute(
            "UPDATE aether_store.schema_state SET version=$1,checksum=$2",
            &[
                &HOSTED_SCHEMA_VERSION,
                &schema_checksum(HOSTED_SCHEMA_VERSION),
            ],
        )
        .await
        .map_err(pg_error)?;
        tx.commit().await.map_err(pg_error)?;
        Ok(())
    }

    pub async fn mutate(
        &self,
        scope: &AuthorizedScope,
        request: &DocumentMutation,
    ) -> Result<MutationReceipt> {
        let mut client = self.pool.get().await.map_err(pool_error)?;
        let tx = client.transaction().await.map_err(pg_error)?;
        let receipt = self.mutate_in(&tx, scope, request).await?;
        tx.commit().await.map_err(pg_error)?;
        Ok(receipt)
    }

    /// Trusted host integration: session, permissions and document changes share
    /// the caller's transaction. This does NOT commit; return no receipt to a
    /// client until the caller confirms commit. Preserve operation/document lock
    /// order, READ COMMITTED, and the same configured database/content authority.
    pub async fn mutate_in(
        &self,
        tx: &tokio_postgres::Transaction<'_>,
        scope: &AuthorizedScope,
        request: &DocumentMutation,
    ) -> Result<MutationReceipt> {
        self.mutate_target_in(tx, scope, request, None).await
    }

    async fn mutate_target_in(
        &self,
        tx: &tokio_postgres::Transaction<'_>,
        scope: &AuthorizedScope,
        request: &DocumentMutation,
        branch: Option<&str>,
    ) -> Result<MutationReceipt> {
        if request.actor != scope.actor {
            return Err(StoreError::new(
                StoreErrorCode::InvalidRequest,
                "Mutation actor must match the authorized identity.",
            ));
        }
        let mut prepared = PreparedMutation::new(request)?;
        if let Some(branch) = branch {
            validate_id(branch)?;
            if matches!(request.change, DocumentChange::Create { .. }) {
                return Err(StoreError::new(
                    StoreErrorCode::InvalidRequest,
                    "Create a document on Main before creating branches.",
                ));
            }
            prepared.fingerprint =
                hash(&serde_json::to_vec(&("branch_document", branch, request))?);
        }
        deadlines(tx).await?;
        branches::lock_operation(tx, scope, &request.document_id, &request.operation_id).await?;
        if tx
            .query_opt(
                "SELECT 1 FROM aether_store.branch_operations WHERE tenant=$1 AND operation_id=$2",
                &[&scope.tenant, &request.operation_id],
            )
            .await
            .map_err(pg_error)?
            .is_some()
        {
            return Err(branches::operation_conflict());
        }
        if let Some(row)=tx.query_opt("SELECT fingerprint,receipt FROM aether_store.operations WHERE tenant=$1 AND operation_id=$2",&[&scope.tenant,&request.operation_id]).await.map_err(pg_error)? {
            if row.get::<_,String>(0)!=prepared.fingerprint {return Err(StoreError::new(StoreErrorCode::OperationConflict,"Operation ID already committed with different arguments."));}
            let document:DocumentRevision=serde_json::from_value(row.get(1))?;
            let original=revision(tx,&scope.tenant,&request.document_id,Some(document.revision)).await?;
            if original.as_ref()!=Some(&document) {return Err(corrupt("Receipt does not match the saved revision."));}
            verify_commit(tx,&scope.tenant,&document).await?;
            self.content(scope,&document).await?;
            return Ok(MutationReceipt {document,replayed:true});
        }
        let target = if let Some(branch) = branch {
            Some(branches::target_head(tx, scope, &request.document_id, branch).await?)
        } else {
            None
        };
        let current = revision(
            tx,
            &scope.tenant,
            &request.document_id,
            target.as_ref().map(|b| b.head_revision),
        )
        .await?;
        prepared.check_head(current.as_ref().map(|d| d.revision))?;
        let source = if let DocumentChange::Restore {
            source_revision, ..
        } = &request.change
        {
            revision(
                tx,
                &scope.tenant,
                &request.document_id,
                Some(*source_revision),
            )
            .await?
        } else {
            None
        };
        if let Some(d) = source.as_ref().or(current.as_ref()) {
            self.content(scope, d).await?;
        }
        let number = branches::next_revision(tx, scope, &request.document_id).await?;
        let mut document =
            prepared.revision_at(request, current.as_ref(), source.as_ref(), number)?;
        document.branch_id = target.and_then(|b| b.id);
        self.persist_revision_in(tx, scope, &prepared, document)
            .await
    }

    async fn persist_revision_in(
        &self,
        tx: &tokio_postgres::Transaction<'_>,
        scope: &AuthorizedScope,
        prepared: &PreparedMutation,
        document: DocumentRevision,
    ) -> Result<MutationReceipt> {
        if let Some(bytes) = &prepared.content {
            self.put_content(scope, &document, bytes.clone()).await?;
        }
        // Object durability precedes the SQL commit. Failure can leave an
        // unreachable blob, never a committed revision pointing at a failed put.
        self.content(scope, &document).await?;
        let metadata = serde_json::to_value(&document)?;
        let number = i64::from(document.revision);
        if document.parent_revision.is_none() {
            tx.execute("INSERT INTO aether_store.documents(tenant,id,app,head_revision) VALUES($1,$2,$3,$4)",&[&scope.tenant,&document.document_id,&document.app,&number]).await.map_err(pg_error)?;
        } else if let Some(branch_id) = &document.branch_id {
            let changed = tx.execute("UPDATE aether_store.branches SET head_revision=$4 WHERE tenant=$1 AND document_id=$2 AND id=$3 AND NOT deleted", &[&scope.tenant, &document.document_id, &branch_id, &number]).await.map_err(pg_error)?;
            if changed != 1 {
                return Err(not_found());
            }
        } else {
            tx.execute(
                "UPDATE aether_store.documents SET head_revision=$3 WHERE tenant=$1 AND id=$2",
                &[&scope.tenant, &document.document_id, &number],
            )
            .await
            .map_err(pg_error)?;
        }
        tx.execute(
            "INSERT INTO aether_store.revisions VALUES($1,$2,$3,$4)",
            &[&scope.tenant, &document.document_id, &number, &metadata],
        )
        .await
        .map_err(pg_error)?;
        tx.execute(
            "INSERT INTO aether_store.operations VALUES($1,$2,$3,$4,$5,$6)",
            &[
                &scope.tenant,
                &document.operation_id,
                &prepared.fingerprint,
                &document.document_id,
                &number,
                &metadata,
            ],
        )
        .await
        .map_err(pg_error)?;
        tx.execute(
            "INSERT INTO aether_store.audit VALUES($1,$2,$3,$4,$5,$6,$7)",
            &[
                &scope.tenant,
                &document.operation_id,
                &document.document_id,
                &number,
                &document.event,
                &document.actor,
                &document.saved_unix_ms,
            ],
        )
        .await
        .map_err(pg_error)?;
        // Allocate the tenant cursor last, after content IO. The transactional
        // row lock serializes publication/commit order; a sequence alone could
        // let a reader skip a lower cursor belonging to a later commit.
        let cursor: i64 = tx.query_one(
            "INSERT INTO aether_store.event_cursors(tenant,last_cursor) VALUES($1,1) ON CONFLICT(tenant) DO UPDATE SET last_cursor=aether_store.event_cursors.last_cursor+1 RETURNING last_cursor",
            &[&scope.tenant],
        ).await.map_err(pg_error)?.get(0);
        // PostgreSQL delivers NOTIFY only after this transaction commits. Keep
        // the durable event as authority; disconnected listeners use snapshots.
        tx.query_one(
            "INSERT INTO aether_store.document_events VALUES($1,$2,$3,$4,'revision_committed') RETURNING pg_notify('aether_revision_v1',$5)",
            &[&scope.tenant, &cursor, &document.document_id, &number,
              &revision_signal_key(&scope.tenant, &document.document_id)],
        )
        .await
        .map_err(pg_error)?;
        Ok(MutationReceipt {
            document,
            replayed: false,
        })
    }

    pub async fn read(
        &self,
        scope: &AuthorizedScope,
        id: &str,
        number: Option<u32>,
    ) -> Result<StoredDocument> {
        let mut client = self.pool.get().await.map_err(pool_error)?;
        let tx = client.transaction().await.map_err(pg_error)?;
        let result = self.read_in(&tx, scope, id, number).await?;
        tx.commit().await.map_err(pg_error)?;
        Ok(result)
    }

    /// Caller retains its session/permission locks until the result is ready.
    pub async fn read_in(
        &self,
        tx: &tokio_postgres::Transaction<'_>,
        scope: &AuthorizedScope,
        id: &str,
        number: Option<u32>,
    ) -> Result<StoredDocument> {
        validate_id(id)?;
        deadlines(tx).await?;
        let document = revision(tx, &scope.tenant, id, number)
            .await?
            .ok_or_else(not_found)?;
        let content_base64 = STANDARD.encode(self.content(scope, &document).await?);
        Ok(StoredDocument {
            document,
            content_base64,
        })
    }

    /// Bounded, stable per-document replay. The caller rechecks read permission
    /// on every page; this is not a cross-tenant event feed or conflict merger.
    pub async fn history(
        &self,
        scope: &AuthorizedScope,
        id: &str,
        after_revision: u32,
        limit: u32,
    ) -> Result<Vec<DocumentRevision>> {
        let mut client = self.pool.get().await.map_err(pool_error)?;
        let tx = client.transaction().await.map_err(pg_error)?;
        let result = self
            .history_in(&tx, scope, id, after_revision, limit)
            .await?;
        tx.commit().await.map_err(pg_error)?;
        Ok(result)
    }

    /// Caller retains its session/permission locks until the result is ready.
    pub async fn history_in(
        &self,
        tx: &tokio_postgres::Transaction<'_>,
        scope: &AuthorizedScope,
        id: &str,
        after_revision: u32,
        limit: u32,
    ) -> Result<Vec<DocumentRevision>> {
        validate_id(id)?;
        if limit == 0 || limit > 1000 {
            return Err(StoreError::new(
                StoreErrorCode::InvalidRequest,
                "History page size must be 1–1000.",
            ));
        }
        deadlines(tx).await?;
        revision(tx, &scope.tenant, id, None)
            .await?
            .ok_or_else(not_found)?;
        let rows=tx.query("SELECT metadata FROM aether_store.revisions WHERE tenant=$1 AND document_id=$2 AND revision>$3 ORDER BY revision LIMIT $4",&[&scope.tenant,&id,&i64::from(after_revision),&i64::from(limit)]).await.map_err(pg_error)?;
        let result = rows
            .iter()
            .map(|row| Ok(serde_json::from_value(row.get(0))?))
            .collect::<Result<Vec<_>>>()?;
        Ok(result)
    }

    /// Trusted Studio service replay, not a client-visible tenant feed. The
    /// delivery layer MUST filter/re-authorize document access before disclosure.
    pub async fn events(
        &self,
        scope: &AuthorizedScope,
        after: &str,
        limit: u32,
    ) -> Result<DocumentEventPage> {
        let after = parse_cursor(after)?;
        if !(1..=1000).contains(&limit) {
            return Err(StoreError::new(
                StoreErrorCode::InvalidRequest,
                "Use an event page size from 1 to 1000.",
            ));
        }
        let mut client = self.pool.get().await.map_err(pool_error)?;
        let tx = client
            .build_transaction()
            .isolation_level(IsolationLevel::RepeatableRead)
            .read_only(true)
            .start()
            .await
            .map_err(pg_error)?;
        deadlines(&*tx).await?;
        let high: i64 = tx
            .query_opt(
                "SELECT last_cursor FROM aether_store.event_cursors WHERE tenant=$1",
                &[&scope.tenant],
            )
            .await
            .map_err(pg_error)?
            .map_or(0, |r| r.get(0));
        if after > high {
            return Err(StoreError::new(
                StoreErrorCode::InvalidRequest,
                "Cursor is ahead of this tenant's committed stream.",
            ));
        }
        let rows = tx.query("SELECT e.cursor,e.kind,r.metadata,e.document_id,e.revision,d.app FROM aether_store.document_events e JOIN aether_store.revisions r ON (r.tenant,r.document_id,r.revision)=(e.tenant,e.document_id,e.revision) JOIN aether_store.documents d ON (d.tenant,d.id)=(e.tenant,e.document_id) WHERE e.tenant=$1 AND e.cursor>$2 ORDER BY e.cursor LIMIT $3", &[&scope.tenant,&after,&i64::from(limit)]).await.map_err(pg_error)?;
        let mut events = Vec::new();
        let mut next = after;
        for row in rows {
            let cursor: i64 = row.get(0);
            if cursor != next + 1 {
                return Err(corrupt("Change stream has a missing event."));
            }
            let kind = match row.get::<_, String>(1).as_str() {
                "revision_committed" => DocumentEventKind::RevisionCommitted,
                "history_backfill" => DocumentEventKind::HistoryBackfill,
                _ => return Err(corrupt("Unknown change event kind.")),
            };
            let document: DocumentRevision = serde_json::from_value(row.get(2))?;
            if document.document_id != row.get::<_, String>(3)
                || i64::from(document.revision) != row.get::<_, i64>(4)
                || document.app != row.get::<_, String>(5)
            {
                return Err(corrupt("Change event revision metadata mismatch."));
            }
            verify_commit(&*tx, &scope.tenant, &document).await?;
            events.push(DocumentEvent {
                cursor: cursor.to_string(),
                kind,
                document,
            });
            next = cursor;
        }
        if next < high && events.len() < limit as usize {
            return Err(corrupt("Change stream is incomplete."));
        }
        tx.commit().await.map_err(pg_error)?;
        Ok(DocumentEventPage {
            events,
            next_cursor: next.to_string(),
            has_more: next < high,
        })
    }

    /// Audit one tenant on a consistent SQL snapshot, checking every live/history
    /// object. Orphaned pre-commit uploads are deliberately retained for now.
    pub async fn verify(&self, scope: &AuthorizedScope) -> Result<IntegrityReport> {
        let mut client = self.pool.get().await.map_err(pool_error)?;
        let tx = client
            .build_transaction()
            .isolation_level(IsolationLevel::RepeatableRead)
            .read_only(true)
            .start()
            .await
            .map_err(pg_error)?;
        deadlines(&*tx).await?;
        let docs = tx
            .query(
                "SELECT id,head_revision FROM aether_store.documents WHERE tenant=$1",
                &[&scope.tenant],
            )
            .await
            .map_err(pg_error)?;
        let mut revisions = 0i64;
        let mut blobs = std::collections::HashSet::new();
        for row in &docs {
            let id: String = row.get(0);
            let head: i64 = row.get(1);
            let range = tx.query_one("SELECT count(*),coalesce(max(revision),0) FROM aether_store.revisions WHERE tenant=$1 AND document_id=$2", &[&scope.tenant, &id]).await.map_err(pg_error)?;
            let count: i64 = range.get(0);
            if count != range.get::<_, i64>(1)
                || head < 1
                || head > count
                || count > i64::from(u32::MAX)
            {
                return Err(corrupt("Revision continuity check failed."));
            }
            branches::verify_branches(&*tx, scope, &id, count as u32).await?;
            let mut lineage = std::collections::BTreeMap::<Option<String>, u32>::new();
            for r in tx.query("SELECT id,created_from FROM aether_store.branches WHERE tenant=$1 AND document_id=$2", &[&scope.tenant, &id]).await.map_err(pg_error)? {
                lineage.insert(Some(r.get(0)), r.get::<_,i64>(1) as u32);
            }
            for number in 1..=count {
                let d = revision(&*tx, &scope.tenant, &id, Some(number as u32))
                    .await?
                    .ok_or_else(|| corrupt("Missing revision."))?;
                if (number == 1
                    && (d.parent_revision.is_some()
                        || d.branch_id.is_some()
                        || d.merge_parent_revision.is_some()))
                    || (number > 1 && !d.parent_revision.is_some_and(|r| r > 0 && r < d.revision))
                    || d.restored_from_revision
                        .is_some_and(|r| r == 0 || r >= d.revision)
                    || d.merge_parent_revision
                        .is_some_and(|r| r == 0 || r >= d.revision || Some(r) == d.parent_revision)
                    || (d.merge_parent_revision.is_some() != (d.event == "merge"))
                {
                    return Err(corrupt("Invalid ancestry."));
                }
                if d.parent_revision != lineage.get(&d.branch_id).copied() {
                    return Err(corrupt(
                        "Revision does not follow its branch's previous head.",
                    ));
                }
                lineage.insert(d.branch_id.clone(), d.revision);
                verify_commit(&*tx, &scope.tenant, &d).await?;
                self.content(scope, &d).await?;
                blobs.insert(d.content_sha256);
                revisions += 1;
            }
        }
        let counts=tx.query_one("SELECT (SELECT count(*) FROM aether_store.operations WHERE tenant=$1), (SELECT count(*) FROM aether_store.audit WHERE tenant=$1)",&[&scope.tenant]).await.map_err(pg_error)?;
        let operations: i64 = counts.get(0);
        let audits: i64 = counts.get(1);
        if operations != revisions || audits != revisions {
            return Err(corrupt("Revision/audit/receipt counts differ."));
        }
        let events = tx.query_one("SELECT count(*),COALESCE(max(cursor),0) FROM aether_store.document_events WHERE tenant=$1", &[&scope.tenant]).await.map_err(pg_error)?;
        let cursor: i64 = tx
            .query_opt(
                "SELECT last_cursor FROM aether_store.event_cursors WHERE tenant=$1",
                &[&scope.tenant],
            )
            .await
            .map_err(pg_error)?
            .map_or(0, |r| r.get(0));
        if events.get::<_, i64>(0) != revisions
            || events.get::<_, i64>(1) != cursor
            || cursor != revisions
        {
            return Err(corrupt(
                "Change event continuity or revision count differs.",
            ));
        }
        tx.commit().await.map_err(pg_error)?;
        Ok(IntegrityReport {
            documents: docs.len() as i64,
            revisions,
            blobs: blobs.len() as i64,
            operations,
        })
    }

    async fn put_content(
        &self,
        scope: &AuthorizedScope,
        d: &DocumentRevision,
        bytes: Vec<u8>,
    ) -> Result<()> {
        let key = object_key(&scope.tenant, &d.content_sha256);
        let options = PutOptions {
            mode: PutMode::Create,
            ..Default::default()
        };
        let result = tokio::time::timeout(
            OBJECT_TIMEOUT,
            self.content.objects.put_opts(&key, bytes.into(), options),
        )
        .await
        .map_err(|_| object_error())?;
        match result {
            Ok(_) | Err(object_store::Error::AlreadyExists { .. }) => {
                self.content.flush(&key).await
            }
            Err(_) => Err(object_error()),
        }
    }
    async fn content(&self, scope: &AuthorizedScope, d: &DocumentRevision) -> Result<Vec<u8>> {
        tokio::time::timeout(OBJECT_TIMEOUT, async {
            let result = self
                .content
                .objects
                .get(&object_key(&scope.tenant, &d.content_sha256))
                .await
                .map_err(|e| match e {
                    object_store::Error::NotFound { .. } => corrupt("Missing content object."),
                    _ => object_error(),
                })?;
            if result.meta.size != u64::from(d.size_bytes)
                || result.meta.size > MAX_CONTENT_BYTES as u64
            {
                return Err(corrupt("Content length mismatch."));
            }
            let bytes = result.bytes().await.map_err(|_| object_error())?;
            if hash(&bytes) != d.content_sha256 {
                return Err(corrupt("Content checksum mismatch."));
            }
            Ok(bytes.to_vec())
        })
        .await
        .map_err(|_| object_error())?
    }
}

fn object_key(tenant: &str, digest: &str) -> ObjectPath {
    ObjectPath::from(format!("v1/{}/{digest}", hash(tenant.as_bytes())))
}
fn lock_key(kind: &str, tenant: &str, id: &str) -> i64 {
    let bytes = serde_json::to_vec(&(kind, tenant, id)).expect("strings serialize");
    let digest = Sha256::digest(bytes);
    i64::from_be_bytes(digest[..8].try_into().unwrap())
}
async fn deadlines(client: &impl GenericClient) -> Result<()> {
    client.batch_execute("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='10s'; SET LOCAL idle_in_transaction_session_timeout='30s'").await.map_err(pg_error)
}
async fn revision(
    client: &impl GenericClient,
    tenant: &str,
    id: &str,
    number: Option<u32>,
) -> Result<Option<DocumentRevision>> {
    let number = number.map(i64::from);
    let row=client.query_opt("SELECT r.metadata,d.app,r.revision FROM aether_store.revisions r JOIN aether_store.documents d ON d.tenant=r.tenant AND d.id=r.document_id WHERE r.tenant=$1 AND r.document_id=$2 AND r.revision=COALESCE($3,d.head_revision)",&[&tenant,&id,&number]).await.map_err(pg_error)?;
    row.map(|row| {
        let d: DocumentRevision = serde_json::from_value(row.get(0))?;
        if d.document_id != id
            || d.app != row.get::<_, String>(1)
            || i64::from(d.revision) != row.get::<_, i64>(2)
        {
            return Err(corrupt("Revision metadata mismatch."));
        }
        Ok(d)
    })
    .transpose()
}
async fn verify_commit(
    client: &impl GenericClient,
    tenant: &str,
    d: &DocumentRevision,
) -> Result<()> {
    let row=client.query_opt("SELECT o.receipt FROM aether_store.operations o JOIN aether_store.audit a ON a.tenant=o.tenant AND a.operation_id=o.operation_id JOIN aether_store.document_events e ON (e.tenant,e.document_id,e.revision)=(o.tenant,o.document_id,o.revision) WHERE o.tenant=$1 AND o.operation_id=$2 AND o.document_id=$3 AND o.revision=$4 AND a.document_id=$3 AND a.revision=$4 AND a.event=$5 AND a.actor=$6 AND a.saved_unix_ms=$7",&[&tenant,&d.operation_id,&d.document_id,&i64::from(d.revision),&d.event,&d.actor,&d.saved_unix_ms]).await.map_err(pg_error)?;
    let row = row.ok_or_else(|| corrupt("Missing or inconsistent audit/receipt."))?;
    if serde_json::from_value::<DocumentRevision>(row.get(0))? != *d {
        return Err(corrupt("Receipt mismatch."));
    }
    Ok(())
}
fn pg_error(e: tokio_postgres::Error) -> StoreError {
    let code = match e.code() {
        Some(c)
            if *c == tokio_postgres::error::SqlState::LOCK_NOT_AVAILABLE
                || *c == tokio_postgres::error::SqlState::QUERY_CANCELED =>
        {
            StoreErrorCode::Busy
        }
        _ => StoreErrorCode::StorageFailure,
    };
    // Do not leak SQL, parameters, tenant names or connection credentials.
    StoreError::new(
        code,
        "Hosted database operation failed; retry with the same operation ID after checking availability.",
    )
}
fn pool_error(_: deadpool_postgres::PoolError) -> StoreError {
    StoreError::new(
        StoreErrorCode::Busy,
        "Hosted database connection unavailable.",
    )
}
fn object_error() -> StoreError {
    StoreError::new(
        StoreErrorCode::StorageFailure,
        "Content object operation failed; saved revisions were not acknowledged.",
    )
}
fn not_found() -> StoreError {
    StoreError::new(StoreErrorCode::NotFound, "Document or revision not found.")
}
fn corrupt(message: &str) -> StoreError {
    StoreError::new(StoreErrorCode::CorruptStore, message)
}

fn parse_cursor(value: &str) -> Result<i64> {
    if value.is_empty()
        || value.len() > 19
        || value.bytes().any(|c| !c.is_ascii_digit())
        || (value.len() > 1 && value.starts_with('0'))
    {
        return Err(StoreError::new(
            StoreErrorCode::InvalidRequest,
            "Use the returned decimal event cursor, starting with 0.",
        ));
    }
    value.parse().map_err(|_| {
        StoreError::new(
            StoreErrorCode::InvalidRequest,
            "Event cursor is out of range.",
        )
    })
}
