import { PROTOCOL_VERSION, type CommandRequest, type CommandResponse } from '@aether/protocol';
const request: CommandRequest = {
  protocol_version: PROTOCOL_VERSION, request_id: 'consumer:1',
  command: 'document.inspect', arguments: { app: 'map', id: 'fixture' },
};
function message(response: CommandResponse): string {
  if (response.status === 'error') return response.error.execution;
  return response.command;
}
// Errors and successes must be narrowed before reading their specific fields.
declare const response: CommandResponse;
// @ts-expect-error A result does not exist on the error variant.
response.result;
void request; void message;

import type { DocumentMutation, MutationReceipt } from '@aether/protocol';
const save: DocumentMutation = {
  operation_id: 'edit:1', document_id: 'show:1', actor: 'local',
  change: { kind: 'save', expected_revision: 1, content_base64: '' },
};
// @ts-expect-error Mutation variants must carry their specific revision guard.
const unguarded: DocumentMutation['change'] = { kind: 'save', content_base64: '' };
function savedAt(receipt: MutationReceipt): number {
  return receipt.document.saved_unix_ms;
}
void save; void unguarded; void savedAt;
const contentRestore: DocumentMutation['change'] = {kind:'restore', expected_revision:3, source_revision:1, preserve_name:true};
const fullRestore: DocumentMutation['change'] = {kind:'restore', expected_revision:3, source_revision:1};
void contentRestore; void fullRestore;

import type { StudioInvocation, StudioCommandResult, CommandProfileCatalog } from '@aether/protocol';
const rename: StudioInvocation = {
  command: 'document.rename',
  arguments: { app: 'map', id: 'show:1', name: 'Opening', expected_revision: 1 },
};
// @ts-expect-error Studio writes require their expected revision.
const incomplete: StudioInvocation = { command: 'document.rename', arguments: { app: 'map', id: 'show:1', name: 'Opening' } };
function versionCount(result: StudioCommandResult): number {
  if (result.command === 'document.history') return result.result.versions.length;
  if (result.command === 'document.version.create') return result.result.revision;
  // @ts-expect-error A result must be narrowed by its command before using history.
  result.result.versions;
  return 0;
}
function serverOnly(catalog: CommandProfileCatalog): string[] {
  return catalog.commands.filter(c => c.semantics?.studio_required).map(c => c.descriptor.id);
}
void rename; void incomplete; void versionCount; void serverOnly;

import type { LocalFileRequest, LocalFileResponse } from '@aether/protocol';
const standaloneSave: LocalFileRequest = {
  document_path: '/documents/show.aethermap', recovery_root: '/application-data/recovery',
  operation: { action: 'save', expected: { kind: 'missing' }, content_base64: '' },
};
// @ts-expect-error Replacement needs an explicit current-file expectation.
const unsafeSave: LocalFileRequest['operation'] = { action: 'save', content_base64: '' };
function recoveryCount(response: LocalFileResponse): number {
  if (response.status === 'success' && response.result.action === 'list_recovery') {
    return response.result.listing.drafts.length;
  }
  return 0;
}
void standaloneSave; void unsafeSave; void recoveryCount;

import type { DocumentEventPage } from '@aether/protocol';
function checkpoint(page: DocumentEventPage): string { return page.next_cursor; }
// @ts-expect-error Database BIGINT cursors are strings, never lossy JS numbers.
const imprecise: DocumentEventPage = { events: [], next_cursor: 9007199254740992, has_more: false };
void checkpoint; void imprecise;

import type { DocumentListRequest, DocumentListPage } from '@aether/protocol';
const discovery: DocumentListRequest = { app: 'map', query: 'Opening', after: null, limit: 20 };
// @ts-expect-error Browser callers cannot select their actor or tenant.
const impersonation: DocumentListRequest = { ...discovery, actor: 'admin' };
function nextFiles(page: DocumentListPage): string | null { return page.next_after; }
void discovery; void impersonation; void nextFiles;

import type { DirectoryChange, OrganizationPage, WorkspacePage } from '@aether/protocol';
const removeWorkspaceMember: DirectoryChange = {
  action: 'workspace_member', organization: 'company', workspace: 'design', user: 'member', role: null,
};
// @ts-expect-error Removing a membership requires explicit null, not an omitted role.
const accidentalRemoval: DirectoryChange = { action: 'workspace_member', organization: 'company', workspace: 'design', user: 'member' };
// @ts-expect-error Organization creation must provision a default workspace atomically.
const incompleteOrganization: DirectoryChange = { action: 'create_organization', id: 'company', name: 'Company' };
function directoryNames(page: OrganizationPage | WorkspacePage): string[] {
  return ('organizations' in page ? page.organizations : page.workspaces).map(item => item.name);
}
void removeWorkspaceMember; void accidentalRemoval; void incompleteOrganization; void directoryNames;

import type { BrowseRequest, BrowseEntry, BrowsePage } from '@aether/protocol';
const browseFolder: BrowseRequest = { organization: 'company', workspace: null, parent: 'folder', app: null, query: '', after: null, limit: 20 };
function entryName(entry: BrowseEntry): string {
  if (entry.kind === 'folder') return entry.folder.name;
  return entry.document.name;
}
declare const folderEntry: Extract<BrowseEntry, { kind: 'folder' }>;
// @ts-expect-error Folder metadata does not pretend to have document revisions.
folderEntry.document.revision;
function breadcrumbNames(page: BrowsePage): string[] { return page.path.map(folder => folder.name); }
// @ts-expect-error Browsing cannot supply a caller identity.
const spoofedBrowse: BrowseRequest = { ...browseFolder, actor: 'admin' };
void browseFolder; void entryName; void breadcrumbNames; void spoofedBrowse;

import type { ResourceMutation, ResourceState } from '@aether/protocol';
const recycle: ResourceMutation = { id: 'show', operation_id: 'recycle-1', expected_structure_revision: 2, change: { kind: 'trash' } };
// @ts-expect-error Structural edits require a guard, independently of content revisions.
const unguardedRecycle: ResourceMutation = { id: 'show', operation_id: 'recycle-1', change: { kind: 'trash' } };
// @ts-expect-error Document content/rename uses its canonical document mutation contract.
const accidentalFileRename: ResourceMutation['change'] = { kind: 'rename', name: 'Show' };
function containingFolder(resource: ResourceState): string | null { return resource.parent_hidden ? null : resource.location.parent; }
void recycle; void unguardedRecycle; void accidentalFileRename; void containingFolder;

import type { BranchCommand, BranchDocumentMutation, BranchReceipt } from '@aether/protocol';
const mergeBranch: BranchCommand = {
  operation_id: 'merge-1', document_id: 'show', actor: 'trusted-host-user',
  change: { kind: 'merge', source: 'branch-stable-id', target: 'Main', expected_source_revision: 3, expected_revision: 4, resolution: 'source' },
};
// @ts-expect-error Merging must guard the source as well as the target.
const unguardedMerge: BranchCommand['change'] = { kind: 'merge', source: 'branch-stable-id', target: 'Main', expected_revision: 4, resolution: null };
function branchOutcome(receipt: BranchReceipt): number {
  return receipt.result.kind === 'head' ? receipt.result.branch.head_revision : receipt.result.document.revision;
}
function branchEditName(edit: BranchDocumentMutation): string { return edit.branch; }
void mergeBranch; void unguardedMerge; void branchOutcome; void branchEditName;

const saveNamed: DocumentMutation['change'] = {kind:'save_named', expected_revision:1, name:'Wheel.acad', content_base64:''};
// @ts-expect-error A named content change must guard its one atomic revision.
const unguardedNamed: DocumentMutation['change'] = {kind:'save_named', name:'Wheel.acad', content_base64:''};
void saveNamed; void unguardedNamed;
