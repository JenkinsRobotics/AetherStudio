import { useMemo, useState } from "react";
import {
  Button,
  DocumentVersionPanel,
  DocumentCollaborationPanel,
  type DocumentConnection,
} from "@aether/ui";
import { documentRequest } from "@aether/session/documents";

/** Studio uses the same document services as each editor. */
export function DocumentHistory({
  file,
  onClose,
  onChanged,
}: {
  file: {
    id: string;
    app?: string;
    name: string;
    revision: number;
    writable: boolean;
  };
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [tab, setTab] = useState<
    "versions" | "comments" | "notes" | "tasks" | "reminders"
  >("versions");
  const app = file.app ?? "cad";
  const connection = useMemo<DocumentConnection>(
    () => ({
      key: `${app}:${file.id}`,
      name: file.name,
      writable: file.writable,
      call: <T,>(action: string, data: Record<string, unknown> = {}) =>
        documentRequest<T>(app, action, { ...data, id: file.id }),
      flush: async () => {},
      reload: onChanged,
      openBranch: async (branch) => {
        location.assign(
          `/${app}/index.html?document=${encodeURIComponent(file.id)}&branch=${encodeURIComponent(branch)}`,
        );
      },
    }),
    [file.id, file.writable, app],
  );
  return (
    <div className="library-modal">
      <section
        className="history-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Document history"
      >
        <header>
          <h2>{file.name}</h2>
          <Button onClick={onClose}>Close</Button>
        </header>
        <nav aria-label="Document services">
          {(
            ["versions", "comments", "notes", "tasks", "reminders"] as const
          ).map((id) => (
            <Button
              key={id}
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
            >
              {id === "versions"
                ? "Versions and history"
                : id === "tasks"
                  ? "Action items"
                  : id.charAt(0).toUpperCase() + id.slice(1)}
            </Button>
          ))}
        </nav>
        {tab === "versions" ? (
          <DocumentVersionPanel connection={connection} />
        ) : (
          <DocumentCollaborationPanel connection={connection} kind={tab} />
        )}
      </section>
    </div>
  );
}
