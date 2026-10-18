//! Native Studio organization/workspace directory. Server administration is
//! separate from membership and never confers private document access.
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
pub enum WorkspaceRole {
    Owner,
    Editor,
    Viewer,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
pub enum OrganizationRole {
    Owner,
    Member,
}

#[derive(Debug, Clone, Deserialize, Serialize, TS)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
pub enum DirectoryChange {
    CreateOrganization {
        id: String,
        name: String,
        default_workspace_id: String,
    },
    CreateWorkspace {
        id: String,
        organization: String,
        name: String,
    },
    WorkspaceMember {
        organization: String,
        workspace: String,
        user: String,
        /// Explicit null removes the assignment; omission is an invalid request.
        #[serde(deserialize_with = "required_nullable")]
        role: Option<WorkspaceRole>,
    },
}
#[derive(Debug, Clone, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
pub struct OrganizationListRequest {
    pub after: Option<String>,
    pub limit: u32,
}
#[derive(Debug, Clone, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
pub struct WorkspaceListRequest {
    pub organization: String,
    pub after: Option<String>,
    pub limit: u32,
}
#[derive(Debug, Clone, Serialize, TS)]
pub struct OrganizationSummary {
    pub id: String,
    pub name: String,
    pub role: OrganizationRole,
}
#[derive(Debug, Clone, Serialize, TS)]
pub struct WorkspaceSummary {
    pub id: String,
    pub organization: String,
    pub name: String,
    pub role: WorkspaceRole,
    pub is_default: bool,
}
#[derive(Debug, Clone, Serialize, TS)]
pub struct OrganizationPage {
    pub organizations: Vec<OrganizationSummary>,
    pub next_after: Option<String>,
}
#[derive(Debug, Clone, Serialize, TS)]
pub struct WorkspacePage {
    pub workspaces: Vec<WorkspaceSummary>,
    pub next_after: Option<String>,
}

fn required_nullable<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer)
}
pub fn typescript_definitions(cfg: &ts_rs::Config) -> Vec<String> {
    vec![
        WorkspaceRole::decl(cfg),
        OrganizationRole::decl(cfg),
        DirectoryChange::decl(cfg),
        OrganizationListRequest::decl(cfg),
        WorkspaceListRequest::decl(cfg),
        OrganizationSummary::decl(cfg),
        WorkspaceSummary::decl(cfg),
        OrganizationPage::decl(cfg),
        WorkspacePage::decl(cfg),
    ]
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn member_removal_requires_explicit_null_and_no_identity_override() {
        let mut request = json!({"action":"workspace_member","organization":"org","workspace":"ws","user":"member"});
        assert!(serde_json::from_value::<DirectoryChange>(request.clone()).is_err());
        request["role"] = json!(null);
        assert!(serde_json::from_value::<DirectoryChange>(request.clone()).is_ok());
        request["tenant"] = json!("other");
        assert!(serde_json::from_value::<DirectoryChange>(request).is_err());
    }
}
