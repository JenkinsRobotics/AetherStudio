//! Projection of the existing Studio Drive rules. No server-admin shortcut into
//! private documents. Database traversal and caller identity are separate.
use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Viewer,
    Editor,
    Owner,
}
impl Role {
    pub(super) fn parse(value: &str) -> Option<Self> {
        match value {
            "viewer" => Some(Self::Viewer),
            "editor" => Some(Self::Editor),
            "owner" => Some(Self::Owner),
            _ => None,
        }
    }
    pub(super) fn sql(self) -> &'static str {
        match self {
            Self::Viewer => "viewer",
            Self::Editor => "editor",
            Self::Owner => "owner",
        }
    }
}
#[derive(Debug, Serialize, Deserialize)]
pub struct Node {
    pub owner: String,
    pub trashed: bool,
    pub grant: Option<Role>,
    pub link: Option<Role>,
}
/// Chain is leaf first and must be validated as complete, acyclic and in the
/// same organization/workspace by the repository. Invalid chains fail closed.
pub fn document_role(
    user: &str,
    member: bool,
    workspace: Option<&str>,
    workspace_role: Option<Role>,
    chain: &[Node],
) -> Option<Role> {
    if !member || chain.is_empty() || chain.len() > 128 || chain.iter().any(|n| n.trashed) {
        return None;
    }
    let mut role = workspace.and(workspace_role);
    if workspace == Some("shared") && role == Some(Role::Owner) && chain[0].owner != user {
        role = Some(Role::Viewer);
    }
    if chain[0].owner == user && (workspace.is_none() || role.is_some()) {
        role = if workspace.is_none() || workspace == Some("shared") {
            Some(Role::Owner)
        } else {
            role
        };
    }
    for node in chain {
        if node.owner == user && workspace.is_none() {
            role = Some(Role::Owner);
        }
        role = role.max(node.grant).max(node.link);
    }
    role
}

#[cfg(test)]
mod tests {
    use super::*;
    #[derive(Deserialize)]
    struct Case {
        user: String,
        member: bool,
        workspace: Option<String>,
        workspace_role: Option<Role>,
        chain: Vec<Node>,
        expected: Option<Role>,
    }
    #[test]
    fn inherited_permissions_match_existing_drive() {
        let cases: Vec<Case> =
            serde_json::from_str(include_str!("../../tests/fixtures/document-policy.json"))
                .unwrap();
        assert_eq!(cases.len(), 512);
        for (i, c) in cases.iter().enumerate() {
            assert_eq!(
                document_role(
                    &c.user,
                    c.member,
                    c.workspace.as_deref(),
                    c.workspace_role,
                    &c.chain
                ),
                c.expected,
                "Legacy Drive policy case {i}"
            );
        }
    }
}
