import { fileTypeFor } from "@aether/ui/file-types";
import { api } from "./api";
import { fileLinkRequest, memberUpdateRequest, directoryCreateRequest, fileCopyRequest, fileGrantRequest, fileFavoriteRequest, fileCreateRequest, fileEditRequest, fileRecycleRequest, workspacePreferenceRequest } from "@aether/session/documents";
export interface DriveFile {
  id: string;
  name: string;
  kind: "file" | "folder";
  app: string;
  scope: string;
  parent: string | null;
  organization: string;
  workspace: string | null;
  owner: string;
  owner_id: string;
  size: number;
  modified: number;
  revision: number;
  structure_revision?: number;
  writable: boolean;
  manageable: boolean;
  role: string;
  favorite: boolean;
  versions: number;
  trashed: boolean;
  mime: string;
  opened?: number;
  deleted_at?: number | null;
  deleted_by?: string | null;
  created_by?: string | null;
  original_location?: string;
  shared_at?: number | null;
  shared_by?: string | null;
  modified_by?: string | null;
  child_count?: number | null;
  sharing?: "Private" | "Shared" | "Workspace";
  activity?: { action: string; author: string; created: number } | null;
}
export interface DriveWorkspace {
  id: string;
  organization: string;
  name: string;
  role: string;
  is_default?: boolean;
  favorite?: boolean;
  opened?: number | null;
}
export interface DriveContext {
  organizations: { id: string; name: string; role: string }[];
  workspaces: DriveWorkspace[];
  user: { id: string; username: string; name: string; admin: boolean };
  apps: {
    id: string;
    name: string;
    url: string;
    enabled: boolean;
    installed: boolean;
  }[];
}
export interface DriveLocation {
  organization: string;
  workspace?: string | null;
  parent?: string | null;
}
export const driveRequest = <T>(action: string, data: object = {}) =>
  action === "workspace_open" || action === "workspace_favorite"
    ? workspacePreferenceRequest<T>(action, { ...data })
    : action === "organization_create" || action === "workspace_create" ? directoryCreateRequest<T>(action, { ...data })
    : action === "link_create" || action === "link_revoke" ? fileLinkRequest<T>(action, { ...data })
    : action === "member_update" ? memberUpdateRequest<T>({ ...data })
    : action === "favorite" ? fileFavoriteRequest<T>({ ...data })
    : action === "trash" || action === "restore" ? fileRecycleRequest<T>(action, { ...data })
    : action === "rename" || action === "move" ? fileEditRequest<T>(action, { ...data })
    : action === "copy" ? fileCopyRequest<T>({ ...data })
    : action === "grant" ? fileGrantRequest<T>({ ...data })
    : action === "create" ? fileCreateRequest<T>({ ...data })
    : api<T>("/api/drive/" + action, data);
export const bytes = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1024 ** 2
      ? `${(n / 1024).toFixed(1)} KB`
      : n < 1024 ** 3
        ? `${(n / 1024 ** 2).toFixed(1)} MB`
        : `${(n / 1024 ** 3).toFixed(1)} GB`;
export const fileIcon = (file: DriveFile) => fileTypeFor(file).icon;
export const fileType = (file: DriveFile) => fileTypeFor(file).label;
export async function encodeFile(file: File) {
  const data = new Uint8Array(await file.arrayBuffer());
  let raw = "";
  for (let i = 0; i < data.length; i += 8192)
    raw += String.fromCharCode(...data.subarray(i, i + 8192));
  return btoa(raw);
}
export function fileBlob(encoded: string, mime: string) {
  return new Blob([Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))], {
    type: mime,
  });
}
export function editorURL(file: DriveFile) {
  return `/${file.app}/index.html?document=${encodeURIComponent(file.id)}`;
}
