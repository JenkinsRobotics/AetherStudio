import { AetherIcon, type AetherIconName } from "./AetherIcon";
import { DocumentCreateDialog } from "./DocumentCreateDialog";
import { DocumentVersionPanel } from "./DocumentVersionPanel";
import { DocumentCollaborationPanel } from "./DocumentCollaborationPanel";
import type { DocumentConnection } from "./DocumentServices";
import { DocumentFileManager } from "./DocumentFileManager";
import { EmptyState } from "./EmptyState";
import type { WorkspacePanel } from "./WorkspaceShell";

/** The suite's document rail. Products supply content, never their own order or glyphs. */
export const STANDARD_WORKSPACE_PANELS = [
  { id: "features", title: "Features and parts", icon: "features-parts" },
  { id: "versions", title: "Version control", icon: "version-control" },
  { id: "create-version", title: "Create version", icon: "version-create" },
  { id: "comments", title: "Comments", icon: "comment" },
  { id: "notes", title: "Document notes", icon: "notes" },
  { id: "reminders", title: "Reminders", icon: "stopwatch" },
  { id: "advisor", title: "AI advisor", icon: "advisor" },
  { id: "tasks", title: "Action items", icon: "tasks" },
  { id: "part-manager", title: "Part manager", icon: "part-manager" },
] as const satisfies readonly { id: string; title: string; icon: AetherIconName }[];
export type StandardWorkspacePanelID = typeof STANDARD_WORKSPACE_PANELS[number]["id"];
export type StandardWorkspacePanelBindings = Partial<Record<StandardWorkspacePanelID, string>>;

/** Preserve product IDs (saved layout, selection and commands) while standardizing
 * presentation. Extra product panels sit before the final Part manager entry.
 * Unconnected services have an explicit unavailable state, never fake data/actions. */
export function standardWorkspacePanels(
  panels: readonly WorkspacePanel[],
  bindings: StandardWorkspacePanelBindings = {},
  connection?: DocumentConnection,
): WorkspacePanel[] {
  const used = new Set<string>();
  const standard = STANDARD_WORKSPACE_PANELS.map(definition => {
    const id = bindings[definition.id] ?? definition.id;
    if (used.has(id)) throw new Error(`Two standard workspace panels are bound to ${id}.`);
    used.add(id);
    const panel = panels.find(panel => panel.id === id);
    return {
      ...panel,
      id,
      title: definition.title,
      icon: <AetherIcon name={definition.icon} />,
      ...(definition.id === "part-manager" ? { separatorBefore: true } : {}),
      ...(definition.id === "create-version" ? { command: (onClose: () => void) => <DocumentCreateDialog connection={connection} onClose={onClose} /> } : {}),
      content: definition.id === "create-version" ? null
        : connection && definition.id === "versions" ? <DocumentVersionPanel connection={connection} />
        : connection && ["comments", "notes", "reminders", "tasks"].includes(definition.id) ? <DocumentCollaborationPanel connection={connection} kind={definition.id as "comments" | "notes" | "reminders" | "tasks"} />
        : connection && definition.id === "part-manager" && !panel?.content ? <DocumentFileManager connection={connection} />
        : panel?.content ?? <EmptyState compact title={definition.title}
        icon={<AetherIcon name={definition.icon} />}
        description={`${definition.title} is not connected in this workspace yet.`} />,
    };
  });
  const extras = panels.filter(panel => !used.has(panel.id));
  return [...standard.slice(0, -1), ...extras, standard[standard.length - 1]];
}
