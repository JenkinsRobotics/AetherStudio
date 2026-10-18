//! Studio resource organization is separate from product document revisions.
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(deny_unknown_fields)]
pub struct ResourceLocation {
    pub organization: String,
    pub workspace: Option<String>,
    pub parent: Option<String>,
}
impl Default for ResourceLocation {
    fn default() -> Self {
        Self {
            organization: "default".into(),
            workspace: None,
            parent: None,
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct ResourceStateRequest {
    pub id: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum ResourceKind {
    Document,
    Folder,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct ResourceState {
    pub id: String,
    pub kind: ResourceKind,
    pub app: String,
    pub name: String,
    pub owner: String,
    pub location: ResourceLocation,
    /// True when the containing folder exists but is not visible to this caller.
    pub parent_hidden: bool,
    /// Guards location, folder name and recycled state, not document content.
    pub structure_revision: u32,
    pub document_revision: Option<u32>,
    /// Own flag; a recycled ancestor may also hide this resource from normal reads.
    pub trashed: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum ResourceChange {
    RenameFolder { name: String },
    Move { destination: ResourceLocation },
    Trash {},
    Restore {},
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct ResourceMutation {
    pub operation_id: String,
    pub id: String,
    pub expected_structure_revision: u32,
    pub change: ResourceChange,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct ResourceMutationReceipt {
    pub operation_id: String,
    pub resource: ResourceState,
    pub replayed: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct RecycleListRequest {
    pub organization: String,
    pub workspace: Option<String>,
    pub app: Option<String>,
    pub after: Option<String>,
    pub limit: u32,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct RecyclePage {
    pub resources: Vec<ResourceState>,
    pub next_after: Option<String>,
}
pub fn typescript_definitions(cfg: &ts_rs::Config) -> Vec<String> {
    vec![
        ResourceLocation::decl(cfg),
        ResourceStateRequest::decl(cfg),
        ResourceKind::decl(cfg),
        ResourceState::decl(cfg),
        ResourceChange::decl(cfg),
        ResourceMutation::decl(cfg),
        ResourceMutationReceipt::decl(cfg),
        RecycleListRequest::decl(cfg),
        RecyclePage::decl(cfg),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn unit_actions_reject_unknown_fields() {
        for kind in ["trash", "restore"] {
            assert!(serde_json::from_value::<ResourceChange>(json!({"kind":kind})).is_ok());
            assert!(
                serde_json::from_value::<ResourceChange>(json!({"kind":kind,"actor":"admin"}))
                    .is_err()
            );
        }
    }
}
