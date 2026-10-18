import { useEffect, useState, useSyncExternalStore } from "react";

export const HEADER_PINS_KEY = "aether-header-pins-v1";
export const LEGACY_HEADER_PINS_KEY = "aether-workspace-quick-controls";
export const DEFAULT_HEADER_PINS = ["theme", "share", "apps"] as const;
const aliases: Record<string, string> = { "cad-control-2": "plugins", "cad-control-3": "layout", "cad-control-4": "comments", "cad-control-5": "reminders" };
const memory = new Map<string, string[]>();
const validPins = (value: unknown): value is string[] => Array.isArray(value) && value.every(id => typeof id === "string");
const normalize = (ids: readonly string[]) => [...new Set(ids.map(id => aliases[id] ?? id))].filter(id => id !== "settings");
function savedPins(): Record<string, string[]> {
  try {
    const data = JSON.parse(localStorage.getItem(HEADER_PINS_KEY) ?? "null");
    if (data?.version === 1 && data.apps && typeof data.apps === "object" && !Array.isArray(data.apps))
      return Object.fromEntries(Object.entries(data.apps).filter((entry): entry is [string, string[]] => validPins(entry[1])));
  } catch { /* Device storage may be unavailable. */ }
  return {};
}
export function readHeaderPins(appID: string, defaults: readonly string[] = DEFAULT_HEADER_PINS): string[] {
  if (memory.has(appID)) return memory.get(appID)!;
  const saved = savedPins();
  if (Object.hasOwn(saved, appID)) return normalize(saved[appID]);
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_HEADER_PINS_KEY) ?? "null");
    if (validPins(legacy)) return normalize(legacy);
  } catch { /* Keep the app's defaults. */ }
  return normalize(defaults);
}
export function setHeaderPins(appID: string, ids: readonly string[]) {
  const pins = normalize(ids);
  try {
    localStorage.setItem(HEADER_PINS_KEY, JSON.stringify({ version: 1, apps: { ...savedPins(), [appID]: pins } }));
    memory.delete(appID);
  } catch { memory.set(appID, pins); }
  document.dispatchEvent(new Event(HEADER_PINS_KEY));
}
export function useHeaderPins(appID: string, defaults: readonly string[] = DEFAULT_HEADER_PINS) {
  const defaultsKey = JSON.stringify(defaults);
  const [pins, setPins] = useState(() => readHeaderPins(appID, defaults));
  useEffect(() => {
    const sync = () => setPins(readHeaderPins(appID, JSON.parse(defaultsKey)));
    sync();
    document.addEventListener(HEADER_PINS_KEY, sync);
    document.addEventListener(LEGACY_HEADER_PINS_KEY, sync);
    window.addEventListener("storage", sync);
    return () => {
      document.removeEventListener(HEADER_PINS_KEY, sync);
      document.removeEventListener(LEGACY_HEADER_PINS_KEY, sync);
      window.removeEventListener("storage", sync);
    };
  }, [appID, defaultsKey]);
  return pins;
}

export interface HeaderControlOption { id: string; label: string; icon: string }
export interface HeaderControlConfiguration { appID: string; name: string; controls: readonly HeaderControlOption[]; defaults: readonly string[] }
// Settings consumes metadata only; it never mounts or invokes the header's actions.
const registrations = new Map<string, HeaderControlConfiguration>();
const listeners = new Set<() => void>();
let snapshot: readonly HeaderControlConfiguration[] = [];
function emit() {
  snapshot = [...new Map([...registrations.values()].map(config => [config.appID, config])).values()];
  listeners.forEach(listener => listener());
}
export function registerHeaderControls(owner: string, config: HeaderControlConfiguration) {
  registrations.set(owner, config); emit();
  return () => { registrations.delete(owner); emit(); };
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useAvailableHeaderControls() { return useSyncExternalStore(subscribe, () => snapshot, () => snapshot); }
