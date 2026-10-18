import {driveCreationDestination} from "./drive-destination";
import { SaveError } from "./autosave";
/** Host-owned transport only. Product adapters own serialization and opening. */
export class DocumentError extends SaveError {
  constructor(
    message: string,
    status: number,
    public detail?: Record<string, unknown>,
    retryable?: boolean,
  ) {
    super(message, status, retryable);
  }
}
const readActions = new Set(["read", "read_revision", "project_read", "history", "compare", "collaboration", "list"]);
const fileActions = new Set(["read", "create", "save", "rename"]);
function unknownOutcome(operationId: string, status = 0, service: "library" | "drive" = "library"): DocumentError {
  return new DocumentError(
    service === "drive"
      ? "The server may have applied this change, but its reply was lost. Refresh to check before trying again."
      : "The server may have saved this change, but its reply was lost. Your draft is retained. Check the saved document before continuing or saving a copy.",
    status, { code: "outcome_unknown", operation_id: operationId }, false,
  );
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function fileResult(value: unknown, action: string): boolean {
  return record(value) && typeof value.id === "string" && value.id.length > 0 &&
    typeof value.name === "string" && Number.isSafeInteger(value.revision) &&
    (value.revision as number) > 0 && typeof value.writable === "boolean" &&
    (action !== "read" || typeof value.data_base64 === "string");
}
const stableBranch = (value: unknown): value is string => typeof value === "string" && /^branch-[0-9a-f]{64}$/.test(value);
const positiveRevision = (value: unknown) => Number.isSafeInteger(value) && (value as number) > 0;
const milestoneActions = new Set(["branch_create", "branch_rename", "branch_delete", "merge", "restore", "version", "version_update", "version_delete", "version_status"]);
function milestoneResult(value: unknown, action: string, data: Record<string, unknown>): boolean {
  if (!record(value) || value.ok !== true || ("replayed" in value && typeof value.replayed !== "boolean")) return false;
  if (action === "version" || action === "restore") return positiveRevision(value.revision);
  if (action === "version_status") return value.status === data.status;
  if (action === "branch_create") return positiveRevision(value.head_revision) && ("branch_id" in value ? stableBranch(value.branch_id) && value.branch === String(data.name).trim() : value.name === String(data.name).trim());
  if (action === "branch_rename" || action === "branch_delete") {
    if (stableBranch(data.branch)) return value.branch_id === data.branch && positiveRevision(value.head_revision) && value.deleted === (action === "branch_delete") && (action !== "branch_rename" || value.branch === String(data.new_name).trim());
    return action === "branch_delete" || value.name === String(data.new_name).trim();
  }
  if (action === "merge") return typeof value.merged === "boolean" && positiveRevision(value.revision) && (!(stableBranch(data.target) || stableBranch(data.source) || 'target' in value) || (value.target === data.target && value.branch_id === (data.target === "Main" ? null : data.target) && value.source_head === data.expected_source_revision));
  return true;
}
async function serviceRequest<T>(
  service: "library" | "drive",
  app: string | undefined,
  action: string,
  data: Record<string, unknown> = {},
): Promise<T> {
  const writing = service === "drive" || !readActions.has(action);
  const operationId = writing ? (typeof data.operation_id === "string" ? data.operation_id : crypto.randomUUID()) : "";
  // Serialize before issuing a request: serialization errors never imply a write.
  const body = JSON.stringify({ ...data,
    ...(service === "library" && data.organization === undefined && (action === "create" || action === "project_create") ? driveCreationDestination() : {}),
    ...(writing ? { operation_id: operationId } : {}), ...(app === undefined ? {} : { app }) });
  let response: Response;
  try {
    response = await fetch(`/api/${service}/${action}`, {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" }, body,
    });
  } catch (error) {
    if (writing) throw unknownOutcome(operationId, 0, service);
    throw error;
  }
  let result: unknown;
  try { result = await response.json(); }
  catch {
    if (writing && (response.ok || response.status >= 500)) throw unknownOutcome(operationId, response.status, service);
    throw new DocumentError("The document service returned an unreadable response.", response.status);
  }
  if (!response.ok) {
    const error = record(result) ? result : {};
    if (writing && (error.execution === "unknown" || (response.status >= 500 && error.execution !== "rejected" && error.execution !== "not_started")))
      throw unknownOutcome(operationId, response.status, service);
    const message = typeof error.error === "string" ? error.error :
      record(error.error) && typeof error.error.message === "string" ? error.error.message : "Document service unavailable.";
    throw new DocumentError(message, response.status, record(error.detail) ? error.detail : undefined);
  }
  if (service === "library" && fileActions.has(action) && !fileResult(result, action)) {
    if (writing) throw unknownOutcome(operationId, response.status, service);
    throw new DocumentError("The server returned an invalid document. Your editor has not been changed.", 502, undefined, false);
  }
  if (service === "library" && fileActions.has(action) && record(result) &&
    ((typeof data.id === "string" && result.id !== data.id) ||
     (stableBranch(data.branch) && result.branch_id !== data.branch) ||
     ((data.branch === undefined || data.branch === "Main") && result.branch_id != null))) {
    if (writing) throw unknownOutcome(operationId, response.status, service);
    throw new DocumentError("The server returned a different document or branch. The editor has not been changed.", 502, undefined, false);
  }
  if (service === "library" && milestoneActions.has(action) && !milestoneResult(result, action, data))
    throw unknownOutcome(operationId, response.status, service);
  if (service === "drive" && (action === "organization_create" || action === "workspace_create")) {
    if (!record(result) || typeof result.id !== "string" || !result.id ||
      ("operation_id" in result && (result.operation_id !== operationId || typeof result.replayed !== "boolean")))
      throw unknownOutcome(operationId, response.status, service);
    return result as T;
  }
  if (service === "drive" && action === "member_update") {
    const role = (v: unknown) => v === null || (data.workspace ? ["owner", "editor", "viewer"] : ["owner", "member"]).includes(v as string);
    if (!record(result) || result.ok !== true || ("operation_id" in result &&
      (result.operation_id !== operationId || result.organization !== data.organization ||
       result.workspace !== (data.workspace ?? null) || result.user !== data.user ||
       typeof result.member_id !== "string" || !result.member_id || typeof result.replayed !== "boolean" ||
       !role(result.role) || !role(result.applied_role))))
      throw unknownOutcome(operationId, response.status, service);
    return result as T;
  }
  if (service === "drive" && action === "link_create") {
    if (!record(result) || typeof result.id !== "string" || !result.id || typeof result.url !== "string" ||
      !/^\/drive\/\?share=[A-Za-z0-9_-]{43}$/.test(result.url) ||
      ("operation_id" in result && (result.operation_id !== operationId || typeof result.replayed !== "boolean" ||
       result.url !== `/drive/?share=${data.token}` || typeof result.active !== "boolean" || typeof result.revoked !== "boolean" ||
       typeof result.expires !== "number" || !Number.isFinite(result.expires))))
      throw unknownOutcome(operationId, response.status, service);
    return result as T;
  }
  if (service === "drive" && action === "link_revoke") {
    if (!record(result) || result.ok !== true || ("operation_id" in result &&
      (result.operation_id !== operationId || result.id !== data.id || result.link !== data.link || typeof result.replayed !== "boolean")))
      throw unknownOutcome(operationId, response.status, service);
    return result as T;
  }
  if (service === "drive" && action === "grant") {
    const role = (v: unknown) => v === null || v === "viewer" || v === "editor";
    if (!record(result) || result.ok !== true || ("operation_id" in result &&
      (result.operation_id !== operationId || result.id !== data.id || result.user !== data.user ||
       typeof result.replayed !== "boolean" || !role(result.role) || !role(result.applied_role))))
      throw unknownOutcome(operationId, response.status, service);
    return result as T;
  }
  if (service === "drive" && (action === "create" || action === "copy")) {
    if (!fileResult(result, action) || !record(result) ||
      ("operation_id" in result && (result.operation_id !== operationId || typeof result.replayed !== "boolean")))
      throw unknownOutcome(operationId, response.status, service);
    return result as T;
  }
  if (service === "drive" && (action === "rename" || action === "move")) {
    if (fileResult(result, action) && record(result) && result.id === data.id) {
      if ("operation_id" in result && (result.operation_id !== operationId || typeof result.replayed !== "boolean"))
        throw unknownOutcome(operationId, response.status, service);
      return result as T;
    }
    if (!record(result) || result.ok !== true || !record(result.resource) || result.resource.id !== data.id ||
      result.operation_id !== operationId || typeof result.replayed !== "boolean" ||
      !Number.isSafeInteger(result.resource.structure_revision) || (result.resource.structure_revision as number) < 1)
      throw unknownOutcome(operationId, response.status, service);
    return result as T;
  }
  if (service === "drive" && (action === "trash" || action === "restore")) {
    if (!record(result) || result.ok !== true || ("resource" in result &&
      (!record(result.resource) || result.resource.id !== data.id ||
       !Number.isSafeInteger(result.resource.structure_revision) || (result.resource.structure_revision as number) < 1 ||
       result.resource.trashed !== (action === "trash") || result.operation_id !== operationId || typeof result.replayed !== "boolean")))
      throw unknownOutcome(operationId, response.status, service);
    return result as T;
  }
  if (service === "drive" && (!record(result) ||
    (action === "favorite" ? result.ok !== true || ("favorite" in result && typeof result.favorite !== "boolean") : !Array.isArray(result.workspaces)) ||
    ("applied_revision" in result && (!Number.isSafeInteger(result.applied_revision) || (result.applied_revision as number) < 1)) ||
    ("replayed" in result && typeof result.replayed !== "boolean")))
    throw unknownOutcome(operationId, response.status, service);
  return result as T;
}
export function documentRequest<T>(app: string, action: string, data: Record<string, unknown> = {}): Promise<T> {
  return serviceRequest<T>("library", app, action, data);
}
/** Personal preference writes share the document transport's uncertain-outcome handling. */
export function workspacePreferenceRequest<T>(action: "workspace_open" | "workspace_favorite", data: Record<string, unknown> = {}): Promise<T> {
  return serviceRequest<T>("drive", undefined, action, data);
}
/** Personal file/folder favorite writes do not change document revisions. */
export function fileFavoriteRequest<T>(data: Record<string, unknown>): Promise<T> {
  return serviceRequest<T>("drive", undefined, "favorite", data);
}
/** Recycle writes retain the selected row's structural guard; never fetch a newer guard silently. */
export function fileRecycleRequest<T>(action: "trash" | "restore", data: Record<string, unknown>): Promise<T> {
  return serviceRequest<T>("drive", undefined, action, data);
}
/** File management preserves caller-selected content/structure guards and never silently retries. */
export function fileEditRequest<T>(action: "rename" | "move", data: Record<string, unknown>): Promise<T> {
  return serviceRequest<T>("drive", undefined, action, data);
}
/** The explicit Drive destination wins over any editor URL defaults. */
export function fileCreateRequest<T>(data: Record<string, unknown>): Promise<T> {
  return serviceRequest<T>("drive", undefined, "create", data);
}
export function encodeDocument(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let raw = "";
  for (let i = 0; i < bytes.length; i += 8192)
    raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(raw);
}
export function decodeDocument(data: string): string {
  return new TextDecoder().decode(
    Uint8Array.from(atob(data), (c) => c.charCodeAt(0)),
  );
}
export interface HostedDocument {
  id: string;
  name: string;
  revision: number;
  writable: boolean;
  data_base64?: string;
  branch?: string;
  branch_id?: string;
}

/** Sharing writes retain the direct role that the owner actually inspected. */
export function fileGrantRequest<T>(data: Record<string, unknown>): Promise<T> {
  return serviceRequest<T>("drive", undefined, "grant", data);
}

/** Copies keep the inspected source revisions and the caller's explicit destination. */
export function fileCopyRequest<T>(data: Record<string, unknown>): Promise<T> {
  return serviceRequest<T>("drive", undefined, "copy", data);
}

/** Administration creates retain one identity through an uncertain response. */
export function directoryCreateRequest<T>(action: "organization_create" | "workspace_create", data: Record<string, unknown>): Promise<T> {
  return serviceRequest<T>("drive", undefined, action, data);
}

/** Guarded organization/workspace assignments; interrupted writes never auto-retry. */
export function memberUpdateRequest<T>(data: Record<string, unknown>): Promise<T> {
  return serviceRequest<T>("drive", undefined, "member_update", data);
}

/** Keep this request in the initiating dialog until an uncertain reply is resolved.
 * Only the server-side digest is persisted. Never put this capability in logs.
 */
export function newSharingLink(id: string, role: string, days: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { id, role, days, token, operation_id: crypto.randomUUID() };
}
export function fileLinkRequest<T>(action: "link_create" | "link_revoke", data: Record<string, unknown>): Promise<T> {
  return serviceRequest<T>("drive", undefined, action, data);
}
