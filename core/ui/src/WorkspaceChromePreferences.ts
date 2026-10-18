import { useMemo, useSyncExternalStore } from "react";

export const CHROME_PREFERENCES_KEY = "aether.workspace-chrome.v1";
const EVENT = "aether-workspace-chrome";
const options = {
  sidebarOpening: ["app", "inside", "outside"],
  sidebarAttachment: ["auto", "attached", "detached"],
  sidebarDesign: ["app", "rail", "tabs-top", "tabs-bottom"],
  tabSize: ["auto", "compact", "touch"],
  tabLabels: ["icons", "labels"],
  toolbarDensity: ["app", "compact", "standard", "expanded"],
  ribbonAppearance: ["app", "glass", "panel"],
  workspaceSelector: ["app", "column", "strip"],
  toolPopup: ["app", "list", "grid"],
  panelMotion: ["auto", "none"],
} as const;
export type WorkspaceChromePreferences = { [K in keyof typeof options]: (typeof options)[K][number] };
export type SidebarAttachment = WorkspaceChromePreferences["sidebarAttachment"];
export const DEFAULT_WORKSPACE_CHROME: Readonly<WorkspaceChromePreferences> = Object.freeze({
  sidebarOpening: "app", sidebarAttachment: "attached", sidebarDesign: "app", tabSize: "auto", tabLabels: "icons",
  toolbarDensity: "app", ribbonAppearance: "app", workspaceSelector: "app",
  toolPopup: "app", panelMotion: "auto",
});

export function readWorkspaceChrome(raw: string | null): WorkspaceChromePreferences {
  let value: Record<string, unknown> = {};
  try { const parsed = JSON.parse(raw ?? "{}"); if (parsed && typeof parsed === "object") value = parsed; } catch { /* use defaults */ }
  // Older automatic layouts split on narrow/touch windows. The primary design
  // is now always one card; preserve only an explicit detached choice.
  if (value.sidebarAttachment === "auto") value.sidebarAttachment = "attached";
  return Object.fromEntries(Object.entries(options).map(([key, values]) => [key,
    (values as readonly unknown[]).includes(value[key]) ? value[key] : DEFAULT_WORKSPACE_CHROME[key as keyof WorkspaceChromePreferences],
  ])) as WorkspaceChromePreferences;
}
let volatileSnapshot: string | null = null;
function snapshot() { try { return localStorage.getItem(CHROME_PREFERENCES_KEY); } catch { return volatileSnapshot; } }
function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => { window.removeEventListener(EVENT, listener); window.removeEventListener("storage", listener); };
}
export function setWorkspaceChrome(patch: Partial<WorkspaceChromePreferences>) {
  const next = readWorkspaceChrome(JSON.stringify({ ...readWorkspaceChrome(snapshot()), ...patch }));
  volatileSnapshot = JSON.stringify(next);
  try { localStorage.setItem(CHROME_PREFERENCES_KEY, volatileSnapshot); } catch { /* live settings still work */ }
  window.dispatchEvent(new Event(EVENT));
}
export function useWorkspaceChrome() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  return useMemo(() => readWorkspaceChrome(raw), [raw]);
}
/** Legacy automatic callers also receive the primary combined card. */
export function resolveSidebarAttachment(choice: SidebarAttachment): "attached" | "detached" {
  return choice === "detached" ? "detached" : "attached";
}
