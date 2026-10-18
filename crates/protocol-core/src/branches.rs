//! Studio-only branch commands. Product-specific merging is never guessed here.
use crate::storage::{DocumentMutation, DocumentRevision};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct BranchDocumentMutation {
    /// Stable branch ID from BranchHead, or "Main". Never a mutable display name.
    pub branch: String,
    pub mutation: DocumentMutation,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct BranchCommand {
    pub operation_id: String,
    pub document_id: String,
    pub actor: String,
    pub change: BranchChange,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum BranchChange {
    Create {
        name: String,
        /// Guard Main while forking an explicitly selected immutable revision.
        expected_revision: u32,
        from_revision: u32,
        message: String,
    },
    Rename {
        /// Stable branch ID, not its display name. Main cannot be renamed/deleted.
        branch: String,
        expected_revision: u32,
        new_name: String,
    },
    Delete {
        /// Stable branch ID, not its display name. Main cannot be renamed/deleted.
        branch: String,
        expected_revision: u32,
        /// Main is also guarded because it decides whether work is merged.
        expected_main_revision: u32,
        force: bool,
    },
    Merge {
        /// Stable branch IDs, or "Main" for the main branch.
        source: String,
        target: String,
        expected_source_revision: u32,
        expected_revision: u32,
        /// Required for divergent histories. No automatic CAD/JSON merging.
        resolution: Option<MergeResolution>,
    },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum MergeResolution {
    Source,
    Target,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
pub struct BranchHead {
    /// Main has no separate row or duplicated head pointer.
    pub id: Option<String>,
    pub name: String,
    pub head_revision: u32,
    pub created_from: Option<u32>,
    pub author: Option<String>,
    #[ts(type = "number | null")]
    pub created_unix_ms: Option<i64>,
    pub message: String,
    pub deleted: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum BranchResult {
    Head {
        branch: BranchHead,
    },
    Merge {
        document: DocumentRevision,
        merged: bool,
        fast_forward: bool,
        merge_base_revision: u32,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct BranchReceipt {
    pub result: BranchResult,
    /// Original committed result; retry never recreates a deleted branch.
    pub replayed: bool,
}

pub fn typescript_definitions(cfg: &ts_rs::Config) -> Vec<String> {
    vec![
        BranchDocumentMutation::decl(cfg),
        BranchCommand::decl(cfg),
        BranchChange::decl(cfg),
        MergeResolution::decl(cfg),
        BranchHead::decl(cfg),
        BranchResult::decl(cfg),
        BranchReceipt::decl(cfg),
    ]
}
