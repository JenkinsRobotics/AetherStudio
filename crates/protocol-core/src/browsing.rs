//! Native Studio folder navigation; listing is metadata-only and permission-scoped.
use crate::storage::DocumentSummary;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
pub struct BrowseRequest {
    pub organization: String,
    pub workspace: Option<String>,
    pub parent: Option<String>,
    pub app: Option<String>,
    #[serde(default)]
    pub query: String,
    pub after: Option<String>,
    pub limit: u32,
}
#[derive(Debug, Clone, Deserialize, Serialize, TS)]
pub struct FolderSummary {
    pub id: String,
    pub name: String,
}
#[derive(Debug, Clone, Deserialize, Serialize, TS)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum BrowseEntry {
    Folder { folder: FolderSummary },
    Document { document: DocumentSummary },
}
impl BrowseEntry {
    pub fn id(&self) -> &str {
        match self {
            Self::Folder { folder } => &folder.id,
            Self::Document { document } => &document.document_id,
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct BrowsePage {
    pub entries: Vec<BrowseEntry>,
    /// Accessible breadcrumb suffix only; a separately shared child does not
    /// disclose names or IDs of inaccessible ancestors.
    pub path: Vec<FolderSummary>,
    pub next_after: Option<String>,
}
pub fn typescript_definitions(cfg: &ts_rs::Config) -> Vec<String> {
    vec![
        BrowseRequest::decl(cfg),
        FolderSummary::decl(cfg),
        BrowseEntry::decl(cfg),
        BrowsePage::decl(cfg),
    ]
}
