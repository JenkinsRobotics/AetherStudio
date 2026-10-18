/** Presentation boundary: server/session adapters own transport and product saves. */
export type DocumentChange = { kind: "state"; writable: boolean } | { kind: "unavailable" | "fallback" };
export interface DocumentConnection {
  /** Host-owned invalidation only: never replace unsaved product content. */
  subscribeChanges?(listener: (event: DocumentChange) => void): () => void;
  key: string;
  name: string;
  branch?: string;
  branchLabel?: string;
  writable?: boolean;
  call<T>(action: string, data?: Record<string, unknown>): Promise<T>;
  /** Flush the editor before capturing a version or moving a branch head. */
  flush(): Promise<void>;
  saveCopy?(): Promise<void>;
  /** Stream snapshots when a host stores large file bytes outside the JSON API. */
  downloadSnapshot?(revision: number): Promise<void>;
  /** Reload the product after restore/merge; switch branches after saving. */
  /** Save pending edits before navigating to another hosted file. */
  openDocument?(id: string): Promise<void>;
  openLibrary?(): void;
  openBranch?(branch: string): Promise<void>;
  reload(): Promise<void>;
}
export type DocumentVersionStatus = "version" | "candidate" | "released" | "obsolete";
export interface DocumentHistory {
  /** Native hosts address branches by permanent IDs; legacy hosts use labels. */
  branch_identity?: "stable";
  writable?: boolean;
  scope?: string;
  revisions: {
    revision: number;
    name: string;
    saved: number;
    author: string;
    event: string;
    note: string;
    branch: string;
    branch_id?: string;
    parent_revision: number | null;
    merge_parent_revision: number | null;
  }[];
  versions: { name: string; revision: number; message: string; created?: number; branch?: string; branch_id?: string; status?: DocumentVersionStatus; origin?: "user" | "automatic"; status_updated?: number; status_note?: string }[];
  branches: { id?: string; name: string; head_revision: number; message?: string }[];
}
export interface CommentImage { name: string; data_url: string; }
export interface CollaborationItem {
  id: string;
  text: string;
  author: string;
  created: number;
  updated: number;
  parent?: string | null;
  branch?: string;
  branch_id?: string;
  reference_name?: string;
  attachments?: CommentImage[];
  revision?: number;
  resolved?: boolean;
  deleted?: boolean;
  status?: "open" | "in_progress" | "done";
  assignee?: string;
  due?: string;
}
export interface DocumentCollaboration {
  mutation_replay?: "operation_id";
  revision: number;
  actor: string;
  owner: string;
  members: { id: string; name: string; avatar?: string }[];
  comments: CollaborationItem[];
  tasks: CollaborationItem[];
  reminders: CollaborationItem[];
  notes: { text: string; author?: string; updated?: number };
  activity: {
    revision: number;
    created: number;
    author: string;
    collection: string;
    operation: string;
    item: string;
  }[];
}

/** Notify mounted history views after an explicit document milestone action. */
export const DOCUMENT_HISTORY_CHANGED = "aether:document-history-changed";

/** Stable selectors are distinct from mutable display labels. */
export const historyBranchKey = (branch: {id?: string; name: string}): string => branch.id ?? branch.name;
export const historyReferenceKey = (reference: {branch_id?: string; branch?: string}): string => reference.branch_id ?? reference.branch ?? "Main";
