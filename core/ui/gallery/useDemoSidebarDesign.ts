import { useCallback, useSyncExternalStore } from "react";
import { sidebarDesignOptions, type SidebarDesign } from "../src/SidebarDesignMenu";

const CHANGE = "aether-demo-sidebar-design";
const subscribe = (notify: () => void) => {
  window.addEventListener(CHANGE, notify);
  window.addEventListener("storage", notify);
  return () => { window.removeEventListener(CHANGE, notify); window.removeEventListener("storage", notify); };
};

/** Demo-only preference; comparing specimens must not change product layouts. */
export function useDemoSidebarDesign(demo: string): [SidebarDesign, (value: SidebarDesign) => void] {
  const key = `aether-ui.demo.${demo}.sidebar-design`;
  const read = useCallback((): SidebarDesign => {
    try { return sidebarDesignOptions.find(option => option.id === localStorage.getItem(key))?.id ?? "rail"; }
    catch { return "rail"; }
  }, [key]);
  const value = useSyncExternalStore(subscribe, read, () => "rail" as const);
  return [value, next => {
    try { localStorage.setItem(key, next); } catch { /* browser preference only */ }
    window.dispatchEvent(new Event(CHANGE));
  }];
}
