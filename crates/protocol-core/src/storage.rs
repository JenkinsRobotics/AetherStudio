//! Studio persistence boundary. These commands do not interpret product content.
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// An operation ID is durable within one store. Retries MUST repeat the exact
/// semantic request; a transport request ID is separate and is not used here.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct DocumentMutation {
    pub operation_id: String,
    pub document_id: String,
    /// Must match identity supplied by the trusted Studio authorization adapter.
    /// Clients cannot use this field to choose another identity.
    pub actor: String,
    pub change: DocumentChange,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum DocumentChange {
    Create {
        app: String,
        name: String,
        content_base64: String,
    },
    Save {
        expected_revision: u32,
        content_base64: String,
    },
    /// Atomically update authored content and its file name in one revision.
    SaveNamed {
        expected_revision: u32,
        content_base64: String,
        name: String,
    },
    Rename {
        expected_revision: u32,
        name: String,
    },
    Restore {
        expected_revision: u32,
        source_revision: u32,
        /// Restore content while retaining the current name (legacy editor behavior).
        /// Omitted/null retains the original full-revision restore contract.
        #[serde(skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        preserve_name: Option<bool>,
    },
}

#[cfg(test)]
mod restore_tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn old_restore_wire_shape_stays_identical_and_content_restore_is_explicit() {
        let old = json!({"kind":"restore","expected_revision":3,"source_revision":1});
        let parsed: DocumentChange = serde_json::from_value(old.clone()).unwrap();
        assert_eq!(serde_json::to_value(parsed).unwrap(), old);
        let new = json!({"kind":"restore","expected_revision":3,"source_revision":1,"preserve_name":true});
        let parsed: DocumentChange = serde_json::from_value(new.clone()).unwrap();
        assert_eq!(serde_json::to_value(parsed).unwrap(), new);
        assert!(serde_json::from_value::<DocumentChange>(json!({"kind":"restore","expected_revision":3,"source_revision":1,"preserve_name":"true"})).is_err());
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
pub struct DocumentRevision {
    pub document_id: String,
    pub app: String,
    pub name: String,
    pub revision: u32,
    pub parent_revision: Option<u32>,
    /// Stable branch identity. Omitted for Main and historical linear stores.
    /// A branch rename never rewrites a saved revision or its receipt.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub branch_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub merge_parent_revision: Option<u32>,
    pub restored_from_revision: Option<u32>,
    pub content_sha256: String,
    pub size_bytes: u32,
    pub actor: String,
    pub operation_id: String,
    pub event: String,
    #[ts(type = "number")]
    pub saved_unix_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct MutationReceipt {
    pub document: DocumentRevision,
    /// A replay returns the original committed revision, not the current head.
    pub replayed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct StoredDocument {
    pub document: DocumentRevision,
    pub content_base64: String,
}

/// Native Studio metadata discovery. `after` is a lexical document ID boundary,
/// never a permission grant. Omit it on the first page and when changing filters.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct DocumentListRequest {
    pub app: Option<String>,
    #[serde(default)]
    pub query: String,
    pub after: Option<String>,
    pub limit: u32,
}

/// Listing intentionally omits content, content hashes and audit/actor details.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct DocumentSummary {
    pub document_id: String,
    pub app: String,
    pub name: String,
    pub revision: u32,
    pub size_bytes: u32,
    #[ts(type = "number")]
    pub saved_unix_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct DocumentListPage {
    pub documents: Vec<DocumentSummary>,
    /// Only a returned, authorized document ID can become a continuation. Null
    /// means no further visible match was found, not a total tenant file count.
    pub next_after: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum StoreErrorCode {
    InvalidRequest,
    NotFound,
    RevisionConflict,
    OperationConflict,
    IncompatibleStore,
    CorruptStore,
    Busy,
    StorageFailure,
}

/// A decimal-string cursor avoids loss of PostgreSQL BIGINT precision in JS.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum DocumentEventKind {
    RevisionCommitted,
    HistoryBackfill,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct DocumentEvent {
    pub cursor: String,
    pub kind: DocumentEventKind,
    pub document: DocumentRevision,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct DocumentEventPage {
    pub events: Vec<DocumentEvent>,
    /// Acknowledge only after applying all returned events; replay is at least once.
    pub next_cursor: String,
    pub has_more: bool,
}

pub fn typescript_definitions(cfg: &ts_rs::Config) -> Vec<String> {
    vec![
        DocumentEventKind::decl(cfg),
        DocumentEvent::decl(cfg),
        DocumentEventPage::decl(cfg),
        DocumentMutation::decl(cfg),
        DocumentChange::decl(cfg),
        DocumentRevision::decl(cfg),
        MutationReceipt::decl(cfg),
        StoredDocument::decl(cfg),
        DocumentListRequest::decl(cfg),
        DocumentSummary::decl(cfg),
        DocumentListPage::decl(cfg),
        StoreErrorCode::decl(cfg),
    ]
}
