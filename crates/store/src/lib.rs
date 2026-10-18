//! Aether Studio persistence. Production builds use hosted PostgreSQL.
//! SQLite is retained behind an explicit developer reference-fixture feature.
#[cfg(feature = "hosted")]
pub mod hosted;
mod mutation;

use aether_protocol_core::storage::*;
use base64::{Engine, engine::general_purpose::STANDARD};
use mutation::PreparedMutation;
#[cfg(feature = "sqlite-reference")]
use rusqlite::{Connection, OptionalExtension, TransactionBehavior, params};
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(feature = "sqlite-reference")]
use std::path::Path;
#[cfg(any(feature = "hosted", feature = "sqlite-reference"))]
use std::time::Duration;

pub const MAX_CONTENT_BYTES: usize = 16 * 1024 * 1024;
#[cfg(feature = "sqlite-reference")]
const APPLICATION_ID: i64 = 0x41455448;
#[cfg(feature = "sqlite-reference")]
const SCHEMA_VERSION: i64 = 1;

#[derive(Debug, thiserror::Error)]
#[error("{code:?}: {message}")]
pub struct StoreError {
    pub code: StoreErrorCode,
    pub message: String,
}
impl StoreError {
    fn new(code: StoreErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}
#[cfg(feature = "sqlite-reference")]
impl From<rusqlite::Error> for StoreError {
    fn from(error: rusqlite::Error) -> Self {
        let code = match error.sqlite_error_code() {
            Some(rusqlite::ErrorCode::DatabaseBusy | rusqlite::ErrorCode::DatabaseLocked) => {
                StoreErrorCode::Busy
            }
            Some(rusqlite::ErrorCode::DatabaseCorrupt | rusqlite::ErrorCode::NotADatabase) => {
                StoreErrorCode::CorruptStore
            }
            _ => StoreErrorCode::StorageFailure,
        };
        Self::new(code, error.to_string())
    }
}
impl From<serde_json::Error> for StoreError {
    fn from(error: serde_json::Error) -> Self {
        Self::new(StoreErrorCode::CorruptStore, error.to_string())
    }
}
impl From<std::io::Error> for StoreError {
    fn from(error: std::io::Error) -> Self {
        Self::new(StoreErrorCode::StorageFailure, error.to_string())
    }
}

#[derive(Debug, serde::Serialize)]
pub struct IntegrityReport {
    pub documents: i64,
    pub revisions: i64,
    pub blobs: i64,
    pub operations: i64,
}

pub type Result<T> = std::result::Result<T, StoreError>;

#[cfg(feature = "sqlite-reference")]
pub struct LocalStore {
    connection: Connection,
}

#[cfg(feature = "sqlite-reference")]
impl LocalStore {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let mut connection = Connection::open(path)?;
        connection.busy_timeout(Duration::from_secs(5))?;
        connection.pragma_update(None, "foreign_keys", "ON")?;
        // Identify before changing any persistent database setting.
        let tx = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let app: i64 = tx.pragma_query_value(None, "application_id", |r| r.get(0))?;
        let version: i64 = tx.pragma_query_value(None, "user_version", |r| r.get(0))?;
        if app == 0 && version == 0 {
            let tables: i64 = tx.query_row(
                "SELECT count(*) FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'",
                [],
                |r| r.get(0),
            )?;
            if tables != 0 {
                return Err(StoreError::new(
                    StoreErrorCode::IncompatibleStore,
                    "Refusing a database owned by another application.",
                ));
            }
            tx.execute_batch(include_str!("schema.sql"))?;
            tx.pragma_update(None, "application_id", APPLICATION_ID)?;
            tx.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        } else if app != APPLICATION_ID || version != SCHEMA_VERSION {
            return Err(StoreError::new(
                StoreErrorCode::IncompatibleStore,
                "Unsupported local store format; no migration attempted.",
            ));
        }
        tx.commit()?;
        connection.pragma_update(None, "journal_mode", "WAL")?;
        connection.pragma_update(None, "synchronous", "FULL")?;
        Ok(Self { connection })
    }

    pub fn mutate(&mut self, request: &DocumentMutation) -> Result<MutationReceipt> {
        self.mutate_inner(request, || Ok(()))
    }

    fn mutate_inner(
        &mut self,
        request: &DocumentMutation,
        before_commit: impl FnOnce() -> Result<()>,
    ) -> Result<MutationReceipt> {
        let prepared = PreparedMutation::new(request)?;
        let fingerprint = &prepared.fingerprint;
        let tx = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let prior: Option<(String, String)> = tx
            .query_row(
                "SELECT fingerprint, receipt FROM operations WHERE operation_id=?1",
                [&request.operation_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        if let Some((previous, receipt)) = prior {
            if previous != *fingerprint {
                return Err(StoreError::new(
                    StoreErrorCode::OperationConflict,
                    "Operation ID already committed with different arguments.",
                ));
            }
            let document: DocumentRevision = serde_json::from_str(&receipt)?;
            // Replays must not silently acknowledge a corrupted commit.
            if read_revision(&tx, &request.document_id, Some(document.revision))? != document {
                return Err(StoreError::new(
                    StoreErrorCode::CorruptStore,
                    "Operation receipt does not match its revision.",
                ));
            }
            content(&tx, &document)?;
            verify_commit(&tx, &document)?;
            return Ok(MutationReceipt {
                document,
                replayed: true,
            });
        }
        let head: Option<u32> = tx
            .query_row(
                "SELECT head_revision FROM documents WHERE id=?1",
                [&request.document_id],
                |r| r.get(0),
            )
            .optional()?;
        prepared.check_head(head)?;
        let current = if head.is_some() {
            Some(read_revision(&tx, &request.document_id, head)?)
        } else {
            None
        };
        let source = if let DocumentChange::Restore {
            source_revision, ..
        } = &request.change
        {
            Some(read_revision(
                &tx,
                &request.document_id,
                Some(*source_revision),
            )?)
        } else {
            None
        };
        if let Some(d) = source.as_ref().or(current.as_ref()) {
            content(&tx, d)?;
        }
        let document = prepared.revision(request, current.as_ref(), source.as_ref())?;
        if let Some(bytes) = &prepared.content {
            tx.execute(
                "INSERT INTO blobs(hash, content) VALUES (?1, ?2) ON CONFLICT(hash) DO NOTHING",
                params![document.content_sha256, bytes],
            )?;
        }
        let revision = document.revision;
        let app = &document.app;
        let event = &document.event;
        content(&tx, &document)?;
        let metadata = serde_json::to_string(&document)?;
        if head.is_none() {
            tx.execute(
                "INSERT INTO documents(id, app, head_revision) VALUES (?1, ?2, ?3)",
                params![request.document_id, app, revision],
            )?;
        } else {
            tx.execute(
                "UPDATE documents SET head_revision=?2 WHERE id=?1",
                params![request.document_id, revision],
            )?;
        }
        tx.execute("INSERT INTO revisions(document_id, revision, blob_hash, metadata) VALUES (?1,?2,?3,?4)", params![request.document_id, revision, document.content_sha256, metadata])?;
        tx.execute("INSERT INTO operations(operation_id, fingerprint, document_id, revision, receipt) VALUES (?1,?2,?3,?4,?5)", params![request.operation_id, fingerprint, request.document_id, revision, metadata])?;
        tx.execute("INSERT INTO audit(operation_id, document_id, revision, event, actor, saved_unix_ms) VALUES (?1,?2,?3,?4,?5,?6)", params![request.operation_id, request.document_id, revision, event, request.actor, document.saved_unix_ms])?;
        before_commit()?;
        tx.commit()?;
        Ok(MutationReceipt {
            document,
            replayed: false,
        })
    }

    pub fn read(&self, id: &str, revision: Option<u32>) -> Result<StoredDocument> {
        validate_id(id)?;
        let document = read_revision(&self.connection, id, revision)?;
        let content_base64 = STANDARD.encode(content(&self.connection, &document)?);
        Ok(StoredDocument {
            document,
            content_base64,
        })
    }

    /// Consistent read snapshot. Validate every blob, head, revision and receipt.
    pub fn verify(&self) -> Result<IntegrityReport> {
        let tx = self.connection.unchecked_transaction()?;
        let sql_check: String = tx.query_row("PRAGMA integrity_check", [], |r| r.get(0))?;
        if sql_check != "ok" || tx.prepare("PRAGMA foreign_key_check")?.exists([])? {
            return Err(StoreError::new(
                StoreErrorCode::CorruptStore,
                "SQLite integrity or foreign-key check failed.",
            ));
        }
        let mut statement = tx.prepare("SELECT id,head_revision FROM documents")?;
        for row in statement.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, u32>(1)?)))? {
            let (id, head) = row?;
            let count: u32 = tx.query_row(
                "SELECT count(*) FROM revisions WHERE document_id=?1",
                [&id],
                |r| r.get(0),
            )?;
            if count != head {
                return Err(StoreError::new(
                    StoreErrorCode::CorruptStore,
                    "Missing or orphaned revision.",
                ));
            }
            for revision in 1..=head {
                let metadata = read_revision(&tx, &id, Some(revision))?;
                content(&tx, &metadata)?;
                if metadata.parent_revision != revision.checked_sub(1).filter(|n| *n > 0)
                    || metadata
                        .restored_from_revision
                        .is_some_and(|r| r == 0 || r >= revision)
                {
                    return Err(StoreError::new(
                        StoreErrorCode::CorruptStore,
                        "Invalid revision ancestry.",
                    ));
                }
                verify_commit(&tx, &metadata)?;
            }
        }
        let mut blobs = tx.prepare("SELECT hash,content FROM blobs")?;
        for row in blobs.query_map([], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, Vec<u8>>(1)?))
        })? {
            let (digest, bytes) = row?;
            if hash(&bytes) != digest {
                return Err(StoreError::new(
                    StoreErrorCode::CorruptStore,
                    "Blob checksum mismatch.",
                ));
            }
        }
        let report = IntegrityReport {
            documents: tx.query_row("SELECT count(*) FROM documents", [], |r| r.get(0))?,
            revisions: tx.query_row("SELECT count(*) FROM revisions", [], |r| r.get(0))?,
            blobs: tx.query_row("SELECT count(*) FROM blobs", [], |r| r.get(0))?,
            operations: tx.query_row("SELECT count(*) FROM operations", [], |r| r.get(0))?,
        };
        let audits: i64 = tx.query_row("SELECT count(*) FROM audit", [], |r| r.get(0))?;
        if audits != report.revisions || report.operations != report.revisions {
            return Err(StoreError::new(
                StoreErrorCode::CorruptStore,
                "Revision/audit/receipt counts differ.",
            ));
        }
        Ok(report)
    }

    /// Publish a verified, self-contained snapshot without replacing any file.
    /// To recover, open the backup as a new store; never overwrite a live store.
    pub fn backup(&self, destination: impl AsRef<Path>) -> Result<IntegrityReport> {
        let destination = destination.as_ref();
        let parent = destination
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .unwrap_or(Path::new("."));
        let temporary = tempfile::NamedTempFile::new_in(parent)?;
        self.connection
            .backup(rusqlite::MAIN_DB, temporary.path(), None)?;
        let copy = Connection::open(temporary.path())?;
        // Force the snapshot to one file. No WAL sidecar is part of the artifact.
        copy.pragma_update(None, "journal_mode", "DELETE")?;
        copy.pragma_update(None, "foreign_keys", "ON")?;
        let backup = Self { connection: copy };
        let report = backup.verify()?;
        drop(backup);
        temporary.as_file().sync_all()?;
        temporary
            .persist_noclobber(destination)
            .map_err(|e| StoreError::from(e.error))?;
        #[cfg(unix)]
        std::fs::File::open(parent)?.sync_all()?;
        Ok(report)
    }

    pub fn history(&self, id: &str) -> Result<Vec<DocumentRevision>> {
        validate_id(id)?;
        read_revision(&self.connection, id, None)?;
        let mut statement = self
            .connection
            .prepare("SELECT metadata FROM revisions WHERE document_id=?1 ORDER BY revision")?;
        let rows = statement.query_map([id], |r| r.get::<_, String>(0))?;
        rows.map(|row| Ok(serde_json::from_str(&row?)?)).collect()
    }
}

fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn validate_id(value: &str) -> Result<()> {
    if value.is_empty()
        || value.len() > 128
        || !value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"-_.:".contains(&b))
    {
        return Err(StoreError::new(
            StoreErrorCode::InvalidRequest,
            "IDs require 1–128 ASCII letters, digits, dash, dot, colon or underscore.",
        ));
    }
    Ok(())
}
fn validate_text(value: &str, max: usize) -> Result<()> {
    if value.trim().is_empty() || value.chars().count() > max || value.chars().any(char::is_control)
    {
        return Err(StoreError::new(
            StoreErrorCode::InvalidRequest,
            "Invalid name or actor.",
        ));
    }
    Ok(())
}
fn decode(value: &str) -> Result<Vec<u8>> {
    if value.len() > MAX_CONTENT_BYTES.div_ceil(3) * 4 {
        return Err(StoreError::new(
            StoreErrorCode::InvalidRequest,
            "Content exceeds the local adapter's 16 MiB limit.",
        ));
    }
    let bytes = STANDARD.decode(value).map_err(|_| {
        StoreError::new(
            StoreErrorCode::InvalidRequest,
            "Content must be canonical base64.",
        )
    })?;
    if bytes.len() > MAX_CONTENT_BYTES {
        return Err(StoreError::new(
            StoreErrorCode::InvalidRequest,
            "Content exceeds 16 MiB.",
        ));
    }
    Ok(bytes)
}
fn now_ms() -> Result<i64> {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| StoreError::new(StoreErrorCode::StorageFailure, e.to_string()))?
        .as_millis();
    if millis > 9_007_199_254_740_991 {
        return Err(StoreError::new(
            StoreErrorCode::StorageFailure,
            "Clock outside protocol range.",
        ));
    }
    Ok(millis as i64)
}
#[cfg(feature = "sqlite-reference")]
fn read_revision(
    connection: &Connection,
    id: &str,
    revision: Option<u32>,
) -> Result<DocumentRevision> {
    let row: Option<(String, String, String, u32)> = connection.query_row(
        "SELECT r.metadata,r.blob_hash,d.app,r.revision FROM revisions r JOIN documents d ON d.id=r.document_id WHERE r.document_id=?1 AND r.revision=COALESCE(?2,d.head_revision)",
        params![id, revision], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))).optional()?;
    let (metadata, digest, app, revision) = row.ok_or_else(|| {
        StoreError::new(StoreErrorCode::NotFound, "Document or revision not found.")
    })?;
    let document: DocumentRevision = serde_json::from_str(&metadata)?;
    if document.document_id != id
        || document.revision != revision
        || document.content_sha256 != digest
        || document.app != app
    {
        return Err(StoreError::new(
            StoreErrorCode::CorruptStore,
            "Revision metadata mismatch.",
        ));
    }
    Ok(document)
}
#[cfg(feature = "sqlite-reference")]
fn verify_commit(connection: &Connection, metadata: &DocumentRevision) -> Result<()> {
    let consistent: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM operations o JOIN audit a USING(operation_id)
         WHERE o.operation_id=?1 AND o.document_id=?2 AND o.revision=?3
         AND a.document_id=?2 AND a.revision=?3 AND a.event=?4 AND a.actor=?5 AND a.saved_unix_ms=?6)",
        params![metadata.operation_id, metadata.document_id, metadata.revision, metadata.event, metadata.actor, metadata.saved_unix_ms], |r| r.get(0))?;
    if !consistent {
        return Err(StoreError::new(
            StoreErrorCode::CorruptStore,
            "Missing or inconsistent audit/operation record.",
        ));
    }
    let receipt: String = connection.query_row(
        "SELECT receipt FROM operations WHERE operation_id=?1",
        [&metadata.operation_id],
        |r| r.get(0),
    )?;
    if serde_json::from_str::<DocumentRevision>(&receipt)? != *metadata {
        return Err(StoreError::new(
            StoreErrorCode::CorruptStore,
            "Receipt metadata mismatch.",
        ));
    }
    Ok(())
}

#[cfg(feature = "sqlite-reference")]
fn content(connection: &Connection, document: &DocumentRevision) -> Result<Vec<u8>> {
    let bytes: Option<Vec<u8>> = connection
        .query_row(
            "SELECT content FROM blobs WHERE hash=?1",
            [&document.content_sha256],
            |r| r.get(0),
        )
        .optional()?;
    let bytes = bytes
        .ok_or_else(|| StoreError::new(StoreErrorCode::CorruptStore, "Missing content blob."))?;
    if bytes.len() != document.size_bytes as usize || hash(&bytes) != document.content_sha256 {
        return Err(StoreError::new(
            StoreErrorCode::CorruptStore,
            "Content checksum mismatch.",
        ));
    }
    Ok(bytes)
}

#[cfg(all(test, feature = "sqlite-reference"))]
mod tests;
