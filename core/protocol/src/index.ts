// Generated from aether-protocol-core. Do not edit.
export const PROTOCOL_VERSION = 1 as const;
export const STUDIO_COMMAND_PROFILE_VERSION = 1 as const;
export type JsonValue = number | string | boolean | Array<JsonValue> | { [key in string]: JsonValue } | null;
export type ErrorCode = "invalid_request" | "unsupported_version" | "unauthenticated" | "forbidden" | "not_found" | "conflict" | "busy" | "unavailable" | "outcome_unknown" | "upstream_failure";
export type ExecutionState = "not_started" | "rejected" | "unknown";
export type CommandError = { code: ErrorCode, message: string, execution: ExecutionState, };
export type CommandRequest = { protocol_version: number, 
/**
 * Correlation only; NOT an idempotency key. Never automatically retry a write.
 */
request_id: string, command: string, arguments: { [key in string]: JsonValue }, };
export type CommandResponse = { "status": "success", protocol_version: number, request_id: string, command: string, result: JsonValue, } | { "status": "error", protocol_version: number, request_id: string | null, error: CommandError, };
export type CommandDescriptor = { id: string, title: string, description: string, inputSchema: JsonValue, writes: boolean, annotations: JsonValue, };
export type CommandCatalog = { schema_version: number, apps: Array<string>, commands: Array<CommandDescriptor>, };
export type Capabilities = { protocol_version: number, mode: string, studio_command_profile_version: number, persistent_storage: boolean, live_collaboration: boolean, durable_retries: boolean, max_request_bytes: number, max_response_bytes: number, };
export type BrowseRequest = { organization: string, workspace: string | null, parent: string | null, app: string | null, query: string, after: string | null, limit: number, };
export type FolderSummary = { id: string, name: string, };
export type BrowseEntry = { "kind": "folder", folder: FolderSummary, } | { "kind": "document", document: DocumentSummary, };
export type BrowsePage = { entries: Array<BrowseEntry>, 
/**
 * Accessible breadcrumb suffix only; a separately shared child does not
 * disclose names or IDs of inaccessible ancestors.
 */
path: Array<FolderSummary>, next_after: string | null, };
export type ResourceLocation = { organization: string, workspace: string | null, parent: string | null, };
export type ResourceStateRequest = { id: string, };
export type ResourceKind = "document" | "folder";
export type ResourceState = { id: string, kind: ResourceKind, app: string, name: string, owner: string, location: ResourceLocation, 
/**
 * True when the containing folder exists but is not visible to this caller.
 */
parent_hidden: boolean, 
/**
 * Guards location, folder name and recycled state, not document content.
 */
structure_revision: number, document_revision: number | null, 
/**
 * Own flag; a recycled ancestor may also hide this resource from normal reads.
 */
trashed: boolean, };
export type ResourceChange = { "kind": "rename_folder", name: string, } | { "kind": "move", destination: ResourceLocation, } | { "kind": "trash", } | { "kind": "restore", };
export type ResourceMutation = { operation_id: string, id: string, expected_structure_revision: number, change: ResourceChange, };
export type ResourceMutationReceipt = { operation_id: string, resource: ResourceState, replayed: boolean, };
export type RecycleListRequest = { organization: string, workspace: string | null, app: string | null, after: string | null, limit: number, };
export type RecyclePage = { resources: Array<ResourceState>, next_after: string | null, };
export type WorkspaceRole = "owner" | "editor" | "viewer";
export type OrganizationRole = "owner" | "member";
export type DirectoryChange = { "action": "create_organization", id: string, name: string, default_workspace_id: string, } | { "action": "create_workspace", id: string, organization: string, name: string, } | { "action": "workspace_member", organization: string, workspace: string, user: string, 
/**
 * Explicit null removes the assignment; omission is an invalid request.
 */
role: WorkspaceRole | null, };
export type OrganizationListRequest = { after: string | null, limit: number, };
export type WorkspaceListRequest = { organization: string, after: string | null, limit: number, };
export type OrganizationSummary = { id: string, name: string, role: OrganizationRole, };
export type WorkspaceSummary = { id: string, organization: string, name: string, role: WorkspaceRole, is_default: boolean, };
export type OrganizationPage = { organizations: Array<OrganizationSummary>, next_after: string | null, };
export type WorkspacePage = { workspaces: Array<WorkspaceSummary>, next_after: string | null, };
export type DocumentEventKind = "revision_committed" | "history_backfill";
export type DocumentEvent = { cursor: string, kind: DocumentEventKind, document: DocumentRevision, };
export type DocumentEventPage = { events: Array<DocumentEvent>, 
/**
 * Acknowledge only after applying all returned events; replay is at least once.
 */
next_cursor: string, has_more: boolean, };
export type DocumentMutation = { operation_id: string, document_id: string, 
/**
 * Must match identity supplied by the trusted Studio authorization adapter.
 * Clients cannot use this field to choose another identity.
 */
actor: string, change: DocumentChange, };
export type DocumentChange = { "kind": "create", app: string, name: string, content_base64: string, } | { "kind": "save", expected_revision: number, content_base64: string, } | { "kind": "save_named", expected_revision: number, content_base64: string, name: string, } | { "kind": "rename", expected_revision: number, name: string, } | { "kind": "restore", expected_revision: number, source_revision: number, 
/**
 * Restore content while retaining the current name (legacy editor behavior).
 * Omitted/null retains the original full-revision restore contract.
 */
preserve_name?: boolean, };
export type DocumentRevision = { document_id: string, app: string, name: string, revision: number, parent_revision: number | null, 
/**
 * Stable branch identity. Omitted for Main and historical linear stores.
 * A branch rename never rewrites a saved revision or its receipt.
 */
branch_id?: string, merge_parent_revision?: number, restored_from_revision: number | null, content_sha256: string, size_bytes: number, actor: string, operation_id: string, event: string, saved_unix_ms: number, };
export type MutationReceipt = { document: DocumentRevision, 
/**
 * A replay returns the original committed revision, not the current head.
 */
replayed: boolean, };
export type StoredDocument = { document: DocumentRevision, content_base64: string, };
export type DocumentListRequest = { app: string | null, query: string, after: string | null, limit: number, };
export type DocumentSummary = { document_id: string, app: string, name: string, revision: number, size_bytes: number, saved_unix_ms: number, };
export type DocumentListPage = { documents: Array<DocumentSummary>, 
/**
 * Only a returned, authorized document ID can become a continuation. Null
 * means no further visible match was found, not a total tenant file count.
 */
next_after: string | null, };
export type StoreErrorCode = "invalid_request" | "not_found" | "revision_conflict" | "operation_conflict" | "incompatible_store" | "corrupt_store" | "busy" | "storage_failure";
export type BranchDocumentMutation = { 
/**
 * Stable branch ID from BranchHead, or "Main". Never a mutable display name.
 */
branch: string, mutation: DocumentMutation, };
export type BranchCommand = { operation_id: string, document_id: string, actor: string, change: BranchChange, };
export type BranchChange = { "kind": "create", name: string, 
/**
 * Guard Main while forking an explicitly selected immutable revision.
 */
expected_revision: number, from_revision: number, message: string, } | { "kind": "rename", 
/**
 * Stable branch ID, not its display name. Main cannot be renamed/deleted.
 */
branch: string, expected_revision: number, new_name: string, } | { "kind": "delete", 
/**
 * Stable branch ID, not its display name. Main cannot be renamed/deleted.
 */
branch: string, expected_revision: number, 
/**
 * Main is also guarded because it decides whether work is merged.
 */
expected_main_revision: number, force: boolean, } | { "kind": "merge", 
/**
 * Stable branch IDs, or "Main" for the main branch.
 */
source: string, target: string, expected_source_revision: number, expected_revision: number, 
/**
 * Required for divergent histories. No automatic CAD/JSON merging.
 */
resolution: MergeResolution | null, };
export type MergeResolution = "source" | "target";
export type BranchHead = { 
/**
 * Main has no separate row or duplicated head pointer.
 */
id: string | null, name: string, head_revision: number, created_from: number | null, author: string | null, created_unix_ms: number | null, message: string, deleted: boolean, };
export type BranchResult = { "kind": "head", branch: BranchHead, } | { "kind": "merge", document: DocumentRevision, merged: boolean, fast_forward: boolean, merge_base_revision: number, };
export type BranchReceipt = { result: BranchResult, 
/**
 * Original committed result; retry never recreates a deleted branch.
 */
replayed: boolean, };
export type FileExpectation = { "kind": "missing" } | { "kind": "content", sha256: string, };
export type FileFingerprint = { sha256: string, size_bytes: number, };
export type LocalFileErrorCode = "invalid_path" | "invalid_request" | "not_found" | "conflict" | "busy" | "too_large" | "corrupt_recovery" | "io_failure" | "outcome_unknown" | "permission_denied" | "unsupported" | "quota_exceeded";
export type FileDurability = "file_and_directory" | "file_only" | "browser_managed";
export type LocalSaveReceipt = { file: FileFingerprint, durability: FileDurability, };
export type RecoveryDraft = { format_version: number, document_path: string, session_id: string, base: FileExpectation, content: FileFingerprint, content_base64: string, };
export type RecoveryCandidate = { draft: RecoveryDraft, 
/**
 * The caller must resolve a mismatch explicitly. Reading never restores it.
 */
base_matches_current_file: boolean, 
/**
 * True when a save finished before the process lost its response.
 */
content_matches_current_file: boolean, };
export type RecoverySummary = { session_id: string, content: FileFingerprint, base_matches_current_file: boolean, content_matches_current_file: boolean, };
export type RecoveryListing = { drafts: Array<RecoverySummary>, 
/**
 * Corrupt drafts are retained, never silently skipped or removed.
 */
corrupt_sessions: Array<string>, };
export type LocalFileRequest = { document_path: string, recovery_root: string, operation: LocalFileOperation, };
export type LocalFileOperation = { "action": "read" } | { "action": "list_recovery" } | { "action": "save", expected: FileExpectation, content_base64: string, } | { "action": "stage_recovery", session_id: string, base: FileExpectation, content_base64: string, } | { "action": "read_recovery", session_id: string, } | { "action": "discard_recovery", session_id: string, expected_content: FileFingerprint, };
export type LocalFileResult = { "action": "list_recovery", listing: RecoveryListing, } | { "action": "read", file: FileFingerprint, content_base64: string, } | { "action": "save", receipt: LocalSaveReceipt, } | { "action": "stage_recovery", receipt: LocalSaveReceipt, } | { "action": "read_recovery", candidate: RecoveryCandidate | null, } | { "action": "discard_recovery" };
export type LocalFileResponse = { "status": "success", result: LocalFileResult, } | { "status": "error", code: LocalFileErrorCode, message: string, };
export type BrowserRecoveryDraft = { format_version: number, document_key: string, session_id: string, base: FileExpectation, content: FileFingerprint, content_base64: string, };
export type BrowserRecoveryCandidate = { draft: BrowserRecoveryDraft, base_matches_current_file: boolean, content_matches_current_file: boolean, };
export type LibraryView = "personal" | "workspace" | "recent";
export type DocumentListArguments = { app: string, query?: string, view?: LibraryView, parent?: string, };
export type DocumentInspectArguments = { app: string, id: string, branch?: string, };
export type DocumentHistoryArguments = { app: string, id: string, };
export type DocumentRenameArguments = { app: string, id: string, name: string, expected_revision: number, };
export type DocumentVersionArguments = { app: string, id: string, name: string, expected_revision: number, branch?: string, message?: string, };
export type StudioInvocation = { "command": "document.list", "arguments": DocumentListArguments } | { "command": "document.inspect", "arguments": DocumentInspectArguments } | { "command": "document.history", "arguments": DocumentHistoryArguments } | { "command": "document.rename", "arguments": DocumentRenameArguments } | { "command": "document.version.create", "arguments": DocumentVersionArguments };
export type StudioDocumentMetadata = { id: string, app: string, scope: string, parent: string | null, name: string, kind: string, revision: number, 
/**
 * Unix seconds, including fractional seconds (not milliseconds).
 */
created: number, 
/**
 * Unix seconds, including fractional seconds (not milliseconds).
 */
modified: number, size: number, owner: string, writable: boolean, organization: string, workspace: string | null, };
export type StudioListedDocument = { versions: number, latest_version: string | null, id: string, app: string, scope: string, parent: string | null, name: string, kind: string, revision: number, 
/**
 * Unix seconds, including fractional seconds (not milliseconds).
 */
created: number, 
/**
 * Unix seconds, including fractional seconds (not milliseconds).
 */
modified: number, size: number, owner: string, writable: boolean, organization: string, workspace: string | null, };
export type DocumentListResult = { files: Array<StudioListedDocument>, };
export type ContentKind = "text" | "binary";
export type DocumentInspectResult = { branch?: string, content_kind: ContentKind, text: string | null, truncated: boolean, saved_state_only: boolean, id: string, app: string, scope: string, parent: string | null, name: string, kind: string, revision: number, 
/**
 * Unix seconds, including fractional seconds (not milliseconds).
 */
created: number, 
/**
 * Unix seconds, including fractional seconds (not milliseconds).
 */
modified: number, size: number, owner: string, writable: boolean, organization: string, workspace: string | null, };
export type StudioRevisionEntry = { revision: number, name: string, 
/**
 * Unix seconds.
 */
saved: number, event: string, note: string, blob_hash: string, branch: string, parent_revision: number | null, merge_parent_revision: number | null, author: string, };
export type StudioNamedVersion = { name: string, revision: number, 
/**
 * Unix seconds.
 */
created: number, message: string, status: string, origin: string, 
/**
 * Unix seconds; zero means no status update yet.
 */
status_updated: number, status_note: string, branch: string, };
export type StudioBranchHead = { name: string, head_revision: number, created_from: number | null, 
/**
 * Unix seconds; Main has no branch creation timestamp.
 */
created: number | null, message?: string, };
export type DocumentHistoryResult = { writable: boolean, scope: string, revisions: Array<StudioRevisionEntry>, versions: Array<StudioNamedVersion>, branches: Array<StudioBranchHead>, };
export type DocumentVersionResult = { ok: boolean, revision: number, };
export type StudioCommandResult = { "command": "document.list", "result": DocumentListResult } | { "command": "document.inspect", "result": DocumentInspectResult } | { "command": "document.history", "result": DocumentHistoryResult } | { "command": "document.rename", "result": StudioDocumentMetadata } | { "command": "document.version.create", "result": DocumentVersionResult };
export type SavedDocumentEffect = "read" | "rename" | "name_version";
export type SavedHistoryEffect = "none" | "append_revision" | "name_existing_revision";
export type RevisionGuard = "none" | "document_head" | "branch_head";
export type RetryRecovery = "read_again" | "inspect_before_retry";
export type StudioCommandSemantics = { profile_version: number, effect: SavedDocumentEffect, history: SavedHistoryEffect, revision_guard: RevisionGuard, retry_recovery: RetryRecovery, 
/**
 * No operation receipts are available through the legacy execution adapter.
 */
durable_replay: boolean, 
/**
 * None of these server operations modifies an open editor's undo stack.
 */
editor_undo: boolean, studio_required: boolean, saved_state_only: boolean, 
/**
 * Main-branch inspect updates the user's recent-file activity.
 */
may_update_recents: boolean, audit_recorded: boolean, 
/**
 * Shared error envelope; execution state still determines whether a write may have committed.
 */
error_codes: Array<ErrorCode>, input_type: string, result_type: string, };
export type ProfiledCommand = { descriptor: CommandDescriptor, 
/**
 * Null means the product contract has not migrated. Never infer safe retries
 * or offline capability merely from its older readOnlyHint annotation.
 */
semantics: StudioCommandSemantics | null, };
export type CommandProfileCatalog = { protocol_version: number, profile_version: number, apps: Array<string>, commands: Array<ProfiledCommand>, };
