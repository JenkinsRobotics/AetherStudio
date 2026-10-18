import type { MenuItem } from "../../src";

/** Mirrors Aether-CAD/src/react/CADDocumentControls.tsx, with demo capabilities.
 * Keep product command execution out of shared UI and gallery code. */
export function demoDocumentMenu({ hasRecovery, openLabel, unitLabel, demoItems }: {
  hasRecovery: boolean; openLabel: string; unitLabel: string; demoItems: readonly MenuItem[];
}): MenuItem[] {
  const studio = "Requires a document connected to Aether Studio. This is a local demo.";
  return [
    { id: "file:save", label: "Save document", shortcut: "⌘S" },
    { id: "file:commit", label: "Commit…", disabled: true, disabledReason: studio },
    { id: "file:recover", label: "Recover…", disabled: !hasRecovery, disabledReason: "No local recovery is available yet." },
    { id: "file:open", label: openLabel, shortcut: "⌘O" },
    { id: "file:import", label: "Import…", disabled: true, disabledReason: "Production imports belong to the official app. Use Open to load a saved demo study." },
    { id: "file:details", label: "Document details…", separatorBefore: true },
    { id: "file:export", label: "Export…" },
    { id: "file:rename", label: "Rename document…", separatorBefore: true },
    { id: "file:move", label: "Move to…", disabled: true, disabledReason: studio },
    { id: "file:restore", label: "Restore deleted workspaces…", disabled: true, disabledReason: studio },
    { id: "file:copy", label: "Copy workspace…", separatorBefore: true },
    { id: "file:update", label: "Update workspace…", disabled: true, disabledReason: "No linked production workspaces are present in this study." },
    { id: "file:units", label: "Workspace units…", disabled: true, disabledReason: `This study uses fixed ${unitLabel}; conversion belongs to the official application.` },
    { id: "file:properties", label: "Workspace properties…" },
    { id: "file:print", label: "Print…", separatorBefore: true },
    { id: "file:link", label: "Copy document link", disabled: true, disabledReason: "Save to Aether Studio to obtain a shareable document link.", separatorBefore: true },
    { id: "file:close", label: "Close document", separatorBefore: true },
    ...demoItems.map((item, index) => index ? item : { ...item, separatorBefore: true, heading: "Demo" }),
  ];
}
