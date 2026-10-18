import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

export type ToolIconPack = "classic" | "graphite-ribbon";
export type ToolIconPalette = "auto" | "light" | "dark";
const ToolIconContext = createContext<{ pack: ToolIconPack; palette: ToolIconPalette } | null>(null);
const ICON_PACK_KEY = "aether.tool-icon-pack";
export function activeToolIconPack(): ToolIconPack {
  try { return localStorage.getItem(ICON_PACK_KEY) === "graphite-ribbon" ? "graphite-ribbon" : "classic"; }
  catch { return "classic"; }
}
export function setToolIconPack(pack: ToolIconPack) {
  try { localStorage.setItem(ICON_PACK_KEY, pack); } catch { /* device storage unavailable */ }
  window.dispatchEvent(new Event("aether-icon-pack"));
}
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("aether-icon-pack", listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener("aether-icon-pack", listener); };
}
export function useGlobalToolIconPack() {
  return useSyncExternalStore(subscribe, activeToolIconPack, () => "classic" as const);
}

/** Scope an illustrated tool pack to a ribbon, workspace or app. No global mutation. */
export function ToolIconTheme({ pack, palette = "auto", children }: {
  pack: ToolIconPack;
  palette?: ToolIconPalette;
  children: ReactNode;
}) {
  return <ToolIconContext.Provider value={{ pack, palette }}>{children}</ToolIconContext.Provider>;
}
export function useToolIconTheme() {
  const scoped = useContext(ToolIconContext);
  const pack = useGlobalToolIconPack();
  return scoped ?? { pack, palette: "auto" as const };
}
