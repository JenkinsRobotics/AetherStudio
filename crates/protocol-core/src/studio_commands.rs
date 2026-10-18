//! Versioned saved-document command profile for the Studio authority.
//! Product engines and editor undo stacks are intentionally outside this profile.
use crate::{CommandDescriptor, ErrorCode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

pub const STUDIO_COMMAND_PROFILE_VERSION: u32 = 1;

// Unlike ordinary Option deserialization, nullable response fields must be
// present. Otherwise a malformed response could pass validation but violate the
// generated TypeScript contract (required field whose value may be null).
fn required_nullable<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer)
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum LibraryView {
    Personal,
    Workspace,
    Recent,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct DocumentListArguments {
    pub app: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub query: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub view: Option<LibraryView>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub parent: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct DocumentInspectArguments {
    pub app: String,
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub branch: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct DocumentHistoryArguments {
    pub app: String,
    pub id: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct DocumentRenameArguments {
    pub app: String,
    pub id: String,
    pub name: String,
    pub expected_revision: u32,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct DocumentVersionArguments {
    pub app: String,
    pub id: String,
    pub name: String,
    pub expected_revision: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub branch: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "command", content = "arguments")]
pub enum StudioInvocation {
    #[serde(rename = "document.list")]
    List(DocumentListArguments),
    #[serde(rename = "document.inspect")]
    Inspect(DocumentInspectArguments),
    #[serde(rename = "document.history")]
    History(DocumentHistoryArguments),
    #[serde(rename = "document.rename")]
    Rename(DocumentRenameArguments),
    #[serde(rename = "document.version.create")]
    Version(DocumentVersionArguments),
}
impl StudioInvocation {
    /// The upstream authority still validates all published lengths/enums and ACLs.
    /// This adds typed shape checking and positive revision guards at the boundary.
    pub fn validate(&self) -> bool {
        match self {
            Self::Rename(a) => a.expected_revision > 0,
            Self::Version(a) => a.expected_revision > 0,
            _ => true,
        }
    }
}

/// Additive authority metadata is preserved on the wire. These are the guaranteed
/// fields consumed by this profile. Legacy timestamp names use Unix seconds.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct StudioDocumentMetadata {
    pub id: String,
    pub app: String,
    pub scope: String,
    #[serde(deserialize_with = "required_nullable")]
    pub parent: Option<String>,
    pub name: String,
    pub kind: String,
    pub revision: u32,
    /// Unix seconds, including fractional seconds (not milliseconds).
    pub created: f64,
    /// Unix seconds, including fractional seconds (not milliseconds).
    pub modified: f64,
    #[ts(type = "number")]
    pub size: u64,
    pub owner: String,
    pub writable: bool,
    pub organization: String,
    #[serde(deserialize_with = "required_nullable")]
    pub workspace: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct StudioListedDocument {
    #[serde(flatten)]
    pub document: StudioDocumentMetadata,
    pub versions: u32,
    #[serde(deserialize_with = "required_nullable")]
    pub latest_version: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct DocumentListResult {
    pub files: Vec<StudioListedDocument>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum ContentKind {
    Text,
    Binary,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct DocumentInspectResult {
    #[serde(flatten)]
    pub document: StudioDocumentMetadata,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub branch: Option<String>,
    pub content_kind: ContentKind,
    #[serde(deserialize_with = "required_nullable")]
    pub text: Option<String>,
    pub truncated: bool,
    pub saved_state_only: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct StudioRevisionEntry {
    pub revision: u32,
    pub name: String,
    /// Unix seconds.
    pub saved: f64,
    pub event: String,
    pub note: String,
    pub blob_hash: String,
    pub branch: String,
    #[serde(deserialize_with = "required_nullable")]
    pub parent_revision: Option<u32>,
    #[serde(deserialize_with = "required_nullable")]
    pub merge_parent_revision: Option<u32>,
    pub author: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct StudioNamedVersion {
    pub name: String,
    pub revision: u32,
    /// Unix seconds.
    pub created: f64,
    pub message: String,
    pub status: String,
    pub origin: String,
    /// Unix seconds; zero means no status update yet.
    pub status_updated: f64,
    pub status_note: String,
    pub branch: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct StudioBranchHead {
    pub name: String,
    pub head_revision: u32,
    #[serde(deserialize_with = "required_nullable")]
    pub created_from: Option<u32>,
    /// Unix seconds; Main has no branch creation timestamp.
    #[serde(deserialize_with = "required_nullable")]
    pub created: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub message: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct DocumentHistoryResult {
    pub writable: bool,
    pub scope: String,
    pub revisions: Vec<StudioRevisionEntry>,
    pub versions: Vec<StudioNamedVersion>,
    pub branches: Vec<StudioBranchHead>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct DocumentVersionResult {
    pub ok: bool,
    pub revision: u32,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(tag = "command", content = "result")]
pub enum StudioCommandResult {
    #[serde(rename = "document.list")]
    List(DocumentListResult),
    #[serde(rename = "document.inspect")]
    Inspect(DocumentInspectResult),
    #[serde(rename = "document.history")]
    History(DocumentHistoryResult),
    #[serde(rename = "document.rename")]
    Rename(StudioDocumentMetadata),
    #[serde(rename = "document.version.create")]
    Version(DocumentVersionResult),
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum SavedDocumentEffect {
    Read,
    Rename,
    NameVersion,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum SavedHistoryEffect {
    None,
    AppendRevision,
    NameExistingRevision,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum RevisionGuard {
    None,
    DocumentHead,
    BranchHead,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum RetryRecovery {
    ReadAgain,
    InspectBeforeRetry,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct StudioCommandSemantics {
    pub profile_version: u32,
    pub effect: SavedDocumentEffect,
    pub history: SavedHistoryEffect,
    pub revision_guard: RevisionGuard,
    pub retry_recovery: RetryRecovery,
    /// No operation receipts are available through the legacy execution adapter.
    pub durable_replay: bool,
    /// None of these server operations modifies an open editor's undo stack.
    pub editor_undo: bool,
    pub studio_required: bool,
    pub saved_state_only: bool,
    /// Main-branch inspect updates the user's recent-file activity.
    pub may_update_recents: bool,
    pub audit_recorded: bool,
    /// Shared error envelope; execution state still determines whether a write may have committed.
    pub error_codes: Vec<ErrorCode>,
    pub input_type: String,
    pub result_type: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct ProfiledCommand {
    pub descriptor: CommandDescriptor,
    /// Null means the product contract has not migrated. Never infer safe retries
    /// or offline capability merely from its older readOnlyHint annotation.
    pub semantics: Option<StudioCommandSemantics>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct CommandProfileCatalog {
    pub protocol_version: u32,
    pub profile_version: u32,
    pub apps: Vec<String>,
    pub commands: Vec<ProfiledCommand>,
}

pub fn semantics(command: &str) -> Option<StudioCommandSemantics> {
    use RetryRecovery::*;
    use RevisionGuard::*;
    use SavedDocumentEffect::*;
    let (effect, history, revision_guard, retry_recovery, input, output) = match command {
        "document.list" => (
            Read,
            SavedHistoryEffect::None,
            None,
            ReadAgain,
            "DocumentListArguments",
            "DocumentListResult",
        ),
        "document.inspect" => (
            Read,
            SavedHistoryEffect::None,
            None,
            ReadAgain,
            "DocumentInspectArguments",
            "DocumentInspectResult",
        ),
        "document.history" => (
            Read,
            SavedHistoryEffect::None,
            None,
            ReadAgain,
            "DocumentHistoryArguments",
            "DocumentHistoryResult",
        ),
        "document.rename" => (
            Rename,
            SavedHistoryEffect::AppendRevision,
            DocumentHead,
            InspectBeforeRetry,
            "DocumentRenameArguments",
            "StudioDocumentMetadata",
        ),
        "document.version.create" => (
            NameVersion,
            SavedHistoryEffect::NameExistingRevision,
            BranchHead,
            InspectBeforeRetry,
            "DocumentVersionArguments",
            "DocumentVersionResult",
        ),
        _ => return Option::None,
    };
    Some(StudioCommandSemantics {
        profile_version: STUDIO_COMMAND_PROFILE_VERSION,
        effect,
        history,
        revision_guard,
        retry_recovery,
        durable_replay: false,
        editor_undo: false,
        studio_required: true,
        saved_state_only: true,
        may_update_recents: command == "document.inspect",
        audit_recorded: true,
        error_codes: vec![
            ErrorCode::InvalidRequest,
            ErrorCode::UnsupportedVersion,
            ErrorCode::Unauthenticated,
            ErrorCode::Forbidden,
            ErrorCode::NotFound,
            ErrorCode::Conflict,
            ErrorCode::Busy,
            ErrorCode::Unavailable,
            ErrorCode::OutcomeUnknown,
            ErrorCode::UpstreamFailure,
        ],
        input_type: input.into(),
        result_type: output.into(),
    })
}

pub fn decode_invocation(
    command: &str,
    arguments: &Value,
) -> Result<StudioInvocation, serde_json::Error> {
    serde_json::from_value(serde_json::json!({"command":command,"arguments":arguments}))
}

/// Validate the profile without dropping additive legacy result fields. A broken
/// result after dispatch MUST remain an unknown outcome, not a safe retry signal.
pub fn validate_result(invocation: &StudioInvocation, result: &Value) -> bool {
    let command = match invocation {
        StudioInvocation::List(_) => "document.list",
        StudioInvocation::Inspect(_) => "document.inspect",
        StudioInvocation::History(_) => "document.history",
        StudioInvocation::Rename(_) => "document.rename",
        StudioInvocation::Version(_) => "document.version.create",
    };
    let Ok(result) = serde_json::from_value::<StudioCommandResult>(
        serde_json::json!({"command":command,"result":result}),
    ) else {
        return false;
    };
    match (invocation, result) {
        (StudioInvocation::List(a), StudioCommandResult::List(r)) => r
            .files
            .iter()
            .all(|f| f.document.app == a.app && f.document.revision > 0),
        (StudioInvocation::Inspect(a), StudioCommandResult::Inspect(r)) => {
            r.saved_state_only
                && r.document.id == a.id
                && r.document.app == a.app
                && r.document.revision > 0
                && match r.content_kind {
                    ContentKind::Text => r.text.is_some(),
                    ContentKind::Binary => r.text.is_none() && !r.truncated,
                }
        }
        (StudioInvocation::History(_), StudioCommandResult::History(r)) => {
            r.revisions.iter().all(|r| r.revision > 0)
                && r.versions.iter().all(|r| r.revision > 0)
                && r.branches.iter().all(|b| b.head_revision > 0)
        }
        (StudioInvocation::Rename(a), StudioCommandResult::Rename(r)) => {
            r.id == a.id && r.app == a.app && r.revision > a.expected_revision
        }
        (StudioInvocation::Version(a), StudioCommandResult::Version(r)) => {
            r.ok && r.revision == a.expected_revision
        }
        _ => false,
    }
}

pub fn typescript_definitions(cfg: &ts_rs::Config) -> Vec<String> {
    vec![
        LibraryView::decl(cfg),
        DocumentListArguments::decl(cfg),
        DocumentInspectArguments::decl(cfg),
        DocumentHistoryArguments::decl(cfg),
        DocumentRenameArguments::decl(cfg),
        DocumentVersionArguments::decl(cfg),
        StudioInvocation::decl(cfg),
        StudioDocumentMetadata::decl(cfg),
        StudioListedDocument::decl(cfg),
        DocumentListResult::decl(cfg),
        ContentKind::decl(cfg),
        DocumentInspectResult::decl(cfg),
        StudioRevisionEntry::decl(cfg),
        StudioNamedVersion::decl(cfg),
        StudioBranchHead::decl(cfg),
        DocumentHistoryResult::decl(cfg),
        DocumentVersionResult::decl(cfg),
        StudioCommandResult::decl(cfg),
        SavedDocumentEffect::decl(cfg),
        SavedHistoryEffect::decl(cfg),
        RevisionGuard::decl(cfg),
        RetryRecovery::decl(cfg),
        StudioCommandSemantics::decl(cfg),
        ProfiledCommand::decl(cfg),
        CommandProfileCatalog::decl(cfg),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn metadata() -> Value {
        json!({"id":"doc","app":"map","scope":"personal","parent":null,
            "name":"Scene","kind":"file","revision":2,"created":1.25,"modified":2.5,
            "size":0,"owner":"Owner","writable":true,"organization":"default","workspace":null})
    }
    #[test]
    fn legacy_decimal_timestamps_survive_json_roundtrip_exactly() {
        // Python emits the shortest decimal for its binary64 timestamp. The
        // gateway must preserve that value, including hard rounding boundaries.
        for raw in [
            "1791664024.365034",
            "1791664024.3650339",
            "1791664024.3650341",
        ] {
            let expected: f64 = raw.parse().unwrap();
            let value: Value = serde_json::from_str(raw).unwrap();
            assert_eq!(
                value.as_f64().unwrap().to_bits(),
                expected.to_bits(),
                "{raw}"
            );
            let encoded = serde_json::to_string(&value).unwrap();
            let decoded: f64 = encoded.parse().unwrap();
            assert_eq!(decoded.to_bits(), expected.to_bits(), "{raw}");
        }
    }

    #[test]
    fn typed_write_requires_integer_positive_revision_and_known_fields() {
        for arguments in [
            json!({"app":"map","id":"doc","name":"Next"}),
            json!({"app":"map","id":"doc","name":"Next","expected_revision":true}),
            json!({"app":"map","id":"doc","name":"Next","expected_revision":1.5}),
            json!({"app":"map","id":"doc","name":"Next","expected_revision":0}),
            json!({"app":"map","id":"doc","name":"Next","expected_revision":1,"tenant":"forged"}),
        ] {
            assert!(
                decode_invocation("document.rename", &arguments).map_or(true, |r| !r.validate())
            );
        }
        assert!(
            decode_invocation(
                "document.rename",
                &json!({"app":"map","id":"doc","name":"Next","expected_revision":1})
            )
            .unwrap()
            .validate()
        );
    }
    #[test]
    fn named_versions_and_saved_revisions_have_different_effects() {
        let rename = semantics("document.rename").unwrap();
        let version = semantics("document.version.create").unwrap();
        assert!(matches!(rename.history, SavedHistoryEffect::AppendRevision));
        assert!(matches!(
            version.history,
            SavedHistoryEffect::NameExistingRevision
        ));
        assert!(matches!(version.revision_guard, RevisionGuard::BranchHead));
        for s in [rename, version] {
            assert!(s.studio_required && !s.editor_undo && !s.durable_replay);
            assert!(matches!(
                s.retry_recovery,
                RetryRecovery::InspectBeforeRetry
            ));
        }
        assert!(semantics("cad.extrude.preview").is_none());
        let inspect = semantics("document.inspect").unwrap();
        assert!(inspect.may_update_recents && inspect.audit_recorded);
        assert!(matches!(inspect.history, SavedHistoryEffect::None));
    }
    #[test]
    fn replies_must_match_target_and_revision_without_losing_additive_metadata() {
        let invocation = decode_invocation(
            "document.rename",
            &json!({"app":"map","id":"doc","name":"Scene","expected_revision":1}),
        )
        .unwrap();
        let mut result = metadata();
        result["new_optional_field"] = json!("preserved by gateway");
        assert!(validate_result(&invocation, &result));
        for changes in [
            json!({"id":"other"}),
            json!({"app":"cad"}),
            json!({"revision":1}),
            json!({"revision":0}),
            json!({"writable":"yes"}),
        ] {
            let mut wrong = result.clone();
            wrong
                .as_object_mut()
                .unwrap()
                .extend(changes.as_object().unwrap().clone());
            assert!(!validate_result(&invocation, &wrong));
        }
    }
    #[test]
    fn inspect_cannot_claim_live_state_or_contradict_binary_content() {
        let invocation =
            decode_invocation("document.inspect", &json!({"app":"map","id":"doc"})).unwrap();
        let mut result = metadata();
        result.as_object_mut().unwrap().extend(
            json!({"content_kind":"binary","text":null,"truncated":false,"saved_state_only":true})
                .as_object()
                .unwrap()
                .clone(),
        );
        assert!(validate_result(&invocation, &result));
        let mut missing = result.clone();
        missing.as_object_mut().unwrap().remove("text");
        assert!(!validate_result(&invocation, &missing));
        missing = result.clone();
        missing.as_object_mut().unwrap().remove("parent");
        assert!(!validate_result(&invocation, &missing));
        result["text"] = json!("wrong");
        assert!(!validate_result(&invocation, &result));
        result["content_kind"] = json!("text");
        assert!(validate_result(&invocation, &result));
        result["saved_state_only"] = json!(false);
        assert!(!validate_result(&invocation, &result));
    }
}
