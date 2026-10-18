import { useMemo, useSyncExternalStore } from "react";

export interface WorkspaceSpacing { margin: number; clearance: number }
export const DEFAULT_WORKSPACE_SPACING: Readonly<WorkspaceSpacing> = Object.freeze({ margin: 10, clearance: 22 });
const KEY = "aether.workspace-spacing";
const EVENT = "aether-workspace-spacing";
function snapshot() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function readWorkspaceSpacing(raw: string | null): WorkspaceSpacing {
  try {
    const value = JSON.parse(raw ?? "{}");
    const number = (key: keyof WorkspaceSpacing) => typeof value?.[key] === "number" && Number.isFinite(value[key])
      ? Math.round(Math.max(0, Math.min(64, value[key]))) : DEFAULT_WORKSPACE_SPACING[key];
    return { margin: number("margin"), clearance: number("clearance") };
  } catch { return { ...DEFAULT_WORKSPACE_SPACING }; }
}
export function setWorkspaceSpacing(patch: Partial<WorkspaceSpacing>) {
  const next = readWorkspaceSpacing(JSON.stringify({ ...readWorkspaceSpacing(snapshot()), ...patch }));
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* browser storage unavailable */ }
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => { window.removeEventListener(EVENT, listener); window.removeEventListener("storage", listener); };
}
export function useWorkspaceSpacing() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  return useMemo(() => readWorkspaceSpacing(raw), [raw]);
}
