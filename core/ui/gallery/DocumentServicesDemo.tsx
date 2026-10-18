import { useCallback, useMemo, useRef, useState } from "react";
import {
  Button,
  DocumentFileManager,
  DocumentCollaborationPanel,
  DocumentVersionPanel,
  DocumentCreateDialog,
  type DocumentCollaboration,
  type DocumentConnection,
} from "../src/index";
import { documentHistoryPreview } from "./document-history-preview";
/** A deliberately local showcase fixture. Production apps inject the host adapter. */
export function DocumentServicesDemo() {
  const [selectedItem, setSelectedItem] = useState("wheel");
  const [createOpen, setCreateOpen] = useState(false);
  const closeCreate = useCallback(() => setCreateOpen(false), []);
  const [tab, setTab] = useState<
    "versions" | "comments" | "notes" | "tasks" | "reminders" | "files"
  >("versions");
  const state = useRef<DocumentCollaboration>({
    revision: 1,
    actor: "designer",
    owner: "designer",
    members: [{ id: "designer", name: "Designer" }],
    comments: [
      {
        id: "discussion",
        text: "Review the connector placement before release.",
        author: "designer",
        created: 1791043200,
        updated: 1791043200,
        resolved: false,
      },
    ],
    tasks: [],
    reminders: [],
    notes: { text: "Prototype review checklist" },
    activity: [],
  });
  const connection = useMemo<DocumentConnection>(
    () => ({
      key: "showcase:document",
      name: "Prototype",
      writable: false,
      flush: async () => {},
      reload: async () => {},
      async call<T>(action: string, data: Record<string, unknown> = {}) {
        if (action === "list") return {files: []} as T;
        if (["history", "compare", "read_revision"].includes(action))
          return documentHistoryPreview.call<T>(action, data);
        if (action === "collaboration_mutate") {
          if (data.expected_revision !== state.current.revision)
            throw new Error("Refresh this preview before editing.");
          const kind = data.collection as
              | "comments"
              | "tasks"
              | "reminders"
              | "notes",
            value = data.value as Record<string, unknown>;
          const now = Date.now() / 1000,
            id = String(data.item ?? crypto.randomUUID());
          if (kind === "notes")
            state.current.notes = {
              text: String(value.text),
              author: "designer",
              updated: now,
            };
          else if (data.operation === "add")
            state.current[kind].push({
              id,
              text: String(value.text),
              author: "designer",
              assignee: "designer",
              created: now,
              updated: now,
              status: "open",
              ...value,
            });
          else
            state.current[kind] = state.current[kind].map((item) =>
              item.id === id
                ? {
                    ...item,
                    ...value,
                    updated: now,
                    ...(data.operation === "delete"
                      ? { deleted: true, text: "" }
                      : {}),
                  }
                : item,
            );
          state.current.revision++;
        }
        return structuredClone(state.current) as T;
      },
    }),
    [],
  );
  return (
    <div>
      <p>
        Shared document panels · Local interaction preview. Example history is
        read only; production apps connect these controls to Studio.
      </p>
      <nav aria-label="Preview document services">
        {(["versions", "comments", "notes", "tasks", "reminders", "files"] as const).map(
          (id) => (
            <Button
              key={id}
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
            >
              {id}
            </Button>
          ),
        )}
        <Button onClick={() => setCreateOpen(true)}>Create version dialog</Button>
      </nav>
      {createOpen && <DocumentCreateDialog connection={connection} onClose={closeCreate} />}
      <div
        style={{
          maxWidth: 380,
          height: tab === "versions" || tab === "comments" || tab === "notes" || tab === "tasks" || tab === "files" ? 620 : undefined,
          maxHeight: 620,
          overflow: "auto",
        }}
      >
        {tab === "files" ? <DocumentFileManager connection={connection} activeID={selectedItem} documentGroups={[{id:"parts",label:"Part studios",items:[{id:"wheel",name:"Train wheel",kind:"part",detail:"Part Studio"},{id:"axle",name:"Axle",kind:"part",detail:"Part Studio"}]}]} onOpenItem={item=>setSelectedItem(item.id)}/> : tab === "versions" ? (
          <DocumentVersionPanel connection={connection} />
        ) : (
          <DocumentCollaborationPanel connection={connection} kind={tab} />
        )}
      </div>
    </div>
  );
}
