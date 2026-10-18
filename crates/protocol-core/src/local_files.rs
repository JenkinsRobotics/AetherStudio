//! Ordinary local document files and crash-recovery drafts; no SQL or history service.
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum FileExpectation {
    Missing,
    Content { sha256: String },
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
pub struct FileFingerprint {
    pub sha256: String,
    #[ts(type = "number")]
    pub size_bytes: u64,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum LocalFileErrorCode {
    InvalidPath,
    InvalidRequest,
    NotFound,
    Conflict,
    Busy,
    TooLarge,
    CorruptRecovery,
    IoFailure,
    OutcomeUnknown,
    PermissionDenied,
    Unsupported,
    QuotaExceeded,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum FileDurability {
    /// File and containing directory synchronization completed (Unix).
    FileAndDirectory,
    /// File synchronization completed; directory persistence not certified here.
    FileOnly,
    /// Browser write stream closed; OS directory fsync is not available.
    BrowserManaged,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct LocalSaveReceipt {
    pub file: FileFingerprint,
    pub durability: FileDurability,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct RecoveryDraft {
    pub format_version: u32,
    pub document_path: String,
    pub session_id: String,
    pub base: FileExpectation,
    pub content: FileFingerprint,
    pub content_base64: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct RecoveryCandidate {
    pub draft: RecoveryDraft,
    /// The caller must resolve a mismatch explicitly. Reading never restores it.
    pub base_matches_current_file: bool,
    /// True when a save finished before the process lost its response.
    pub content_matches_current_file: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct RecoverySummary {
    pub session_id: String,
    pub content: FileFingerprint,
    pub base_matches_current_file: bool,
    pub content_matches_current_file: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct RecoveryListing {
    pub drafts: Vec<RecoverySummary>,
    /// Corrupt drafts are retained, never silently skipped or removed.
    pub corrupt_sessions: Vec<String>,
}

pub fn typescript_definitions(cfg: &ts_rs::Config) -> Vec<String> {
    vec![
        FileExpectation::decl(cfg),
        FileFingerprint::decl(cfg),
        LocalFileErrorCode::decl(cfg),
        FileDurability::decl(cfg),
        LocalSaveReceipt::decl(cfg),
        RecoveryDraft::decl(cfg),
        RecoveryCandidate::decl(cfg),
        RecoverySummary::decl(cfg),
        RecoveryListing::decl(cfg),
        LocalFileRequest::decl(cfg),
        LocalFileOperation::decl(cfg),
        LocalFileResult::decl(cfg),
        LocalFileResponse::decl(cfg),
        BrowserRecoveryDraft::decl(cfg),
        BrowserRecoveryCandidate::decl(cfg),
    ]
}

/// Local process/file-picker boundary only. Never expose these path-bearing
/// operations as remote Studio commands or grant them through a bearer token.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct LocalFileRequest {
    pub document_path: String,
    pub recovery_root: String,
    pub operation: LocalFileOperation,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
pub enum LocalFileOperation {
    Read,
    ListRecovery,
    Save {
        expected: FileExpectation,
        content_base64: String,
    },
    StageRecovery {
        session_id: String,
        base: FileExpectation,
        content_base64: String,
    },
    ReadRecovery {
        session_id: String,
    },
    DiscardRecovery {
        session_id: String,
        expected_content: FileFingerprint,
    },
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum LocalFileResult {
    ListRecovery {
        listing: RecoveryListing,
    },
    Read {
        file: FileFingerprint,
        content_base64: String,
    },
    Save {
        receipt: LocalSaveReceipt,
    },
    StageRecovery {
        receipt: LocalSaveReceipt,
    },
    ReadRecovery {
        candidate: Option<RecoveryCandidate>,
    },
    DiscardRecovery,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum LocalFileResponse {
    Success {
        result: LocalFileResult,
    },
    Error {
        code: LocalFileErrorCode,
        message: String,
    },
}

/// Browser recovery uses an opaque app document key, never an OS filesystem path.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct BrowserRecoveryDraft {
    pub format_version: u32,
    pub document_key: String,
    pub session_id: String,
    pub base: FileExpectation,
    pub content: FileFingerprint,
    pub content_base64: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct BrowserRecoveryCandidate {
    pub draft: BrowserRecoveryDraft,
    pub base_matches_current_file: bool,
    pub content_matches_current_file: bool,
}
