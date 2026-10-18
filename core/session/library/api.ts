import { DocumentError, documentRequest, fileCreateRequest } from "@aether/session/documents";
const documentActions = new Set(["project_create", "project_read", "project_edit", "create", "save", "rename", "read", "read_revision", "restore", "history", "list", "version", "version_update", "version_delete", "version_status", "collaboration", "collaboration_mutate"]);
export async function api<T>(path: string, body?: object): Promise<T> {
  if (body && path === "/api/drive/create") return fileCreateRequest<T>({ ...body });
  const action = path.startsWith("/api/library/") ? path.slice("/api/library/".length) : "";
  if (body && documentActions.has(action) && "app" in body && typeof body.app === "string") {
    try {
      return await documentRequest<T>(body.app, action, { ...body });
    } catch (error) {
      // Home operations have no editor draft recovery to promise the user.
      if (error instanceof DocumentError && error.detail?.code === "outcome_unknown") {
        throw new DocumentError(
          "The server may have applied this change, but its reply was lost. Refresh to check before trying again.",
          error.status, error.detail, false,
        );
      }
      throw error;
    }
  }
  const response = await fetch(
    path,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {},
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "The request could not be completed.");
  if (body && ["/api/login", "/api/logout", "/api/profile", "/api/setup", "/api/password"].includes(path))
    document.dispatchEvent(new Event("aether-account-refresh"));
  return data as T;
}
