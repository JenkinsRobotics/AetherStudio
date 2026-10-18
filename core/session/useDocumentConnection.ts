import { useMemo, useRef } from "react";
import type { DocumentConnection } from "@aether/ui/DocumentServices";
import { subscribeDocumentChanges } from "./document-changes";
import { documentRequest } from "./documents";

/** File identity and save adapters are supplied by the owning editor. */
export function useDocumentConnection(options: {
  app: string;
  id?: string | null;
  name: string;
  writable?: boolean;
  flush: () => Promise<void>;
  saveCopy?: () => Promise<void>;
  reload?: () => Promise<void>;
}): DocumentConnection {
  const current = useRef(options);
  current.current = options;
  const query =
    typeof location === "undefined"
      ? new URLSearchParams()
      : new URLSearchParams(location.search);
  const id = options.id ?? query.get("document"),
    branch = query.get("branch") ?? "Main";
  return useMemo(
    () => ({
      key: `${options.app}:${id ?? "draft"}:${branch}`,
      name: options.name,
      subscribeChanges: id ? listener => subscribeDocumentChanges(options.app, id, listener) : undefined,
      branch,
      writable: query.has("revision") ? false : options.writable,
      flush: () => current.current.flush(),
      saveCopy: options.saveCopy
        ? () => current.current.saveCopy!()
        : undefined,
      async call<T>(action: string, data: Record<string, unknown> = {}) {
        if (action === "list") return documentRequest<T>(current.current.app, action, data);
        let documentID =
          current.current.id ??
          new URLSearchParams(location.search).get("document");
        if (!documentID) {
          await current.current.flush();
          documentID =
            current.current.id ??
            new URLSearchParams(location.search).get("document");
        }
        if (!documentID)
          throw new Error(
            "This document has not reached the server yet. Retry after it finishes saving.",
          );
        return documentRequest<T>(current.current.app, action, {
          ...(["history", "read_revision", "compare", "read", "save", "restore", "version", "version_update", "version_delete", "version_status", "collaboration", "collaboration_mutate"].includes(action) ? {branch} : {}),
          ...data,
          id: documentID,
        });
      },
      openLibrary() {
        const file = current.current.id ?? new URLSearchParams(location.search).get("document");
        window.open(`/drive/${file ? `?file=${encodeURIComponent(file)}` : ""}`, "_blank", "noopener");
      },
      async openDocument(next: string) {
        await current.current.flush();
        location.assign(`/${current.current.app}/index.html?document=${encodeURIComponent(next)}`);
      },
      async openBranch(next: string) {
        await current.current.flush();
        const q = new URLSearchParams(location.search);
        q.delete("revision");
        if (next === "Main") q.delete("branch");
        else q.set("branch", next);
        location.assign(`${location.pathname}?${q}`);
      },
      async reload() {
        if (current.current.reload) await current.current.reload();
        else location.reload();
      },
    }),
    [options.app, id, branch, options.name, options.writable],
  );
}
