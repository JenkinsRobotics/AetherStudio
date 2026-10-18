import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { LayoutPreset, WorkspacePanelState } from "./WorkspaceShell";
import "./WorkspaceShellMotion.css";
import { useWorkspaceSpacing } from "./WorkspaceSpacing";

export const WORKSPACE_PANEL_DURATION_MS = 240;

/** Retain closing panels for their exit transition, including their portal hosts.
 * Authoritative visibility changes immediately; retained chrome is inert. */
export function useClosingPanels(state: WorkspacePanelState, enabled: boolean, preset: LayoutPreset, sides: readonly (readonly string[])[]) {
  const previous = useRef(state);
  const previousPreset = useRef(preset);
  const [closing, setClosing] = useState<WorkspacePanelState>({});
  // A tab replacement must not temporarily stack two full-size editors. Only
  // closing a side (or one of its existing stacked panels) gets an exit phase.
  const replaced = (id: string) => sides.find(side => side.includes(id))?.some(peer =>
    peer !== id && state[peer] && state[peer].placement !== "hidden" &&
    (!previous.current[peer] || previous.current[peer].placement === "hidden"));
  useLayoutEffect(() => {
    const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next: Record<string, WorkspacePanelState[string]> = {};
    if (enabled && !reduced && previousPreset.current === preset) {
      for (const [id, entry] of Object.entries({...closing, ...previous.current})) {
        if (entry.placement !== "hidden" && (!state[id] || state[id].placement === "hidden") && !replaced(id)) next[id] = entry;
      }
    }
    previous.current = state;
    previousPreset.current = preset;
    setClosing(next);
    if (!Object.keys(next).length) return;
    const timer = setTimeout(() => setClosing({}), WORKSPACE_PANEL_DURATION_MS);
    return () => clearTimeout(timer);
  }, [state, enabled, preset]);
  const retained = {...closing};
  // Compute the first closing render synchronously so React never unmounts the
  // panel between the visible state and the exit animation.
  if (enabled && previousPreset.current === preset && !(typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    for (const [id, entry] of Object.entries(previous.current)) {
      if (entry.placement !== "hidden" && (!state[id] || state[id].placement === "hidden") && !replaced(id)) retained[id] = entry;
    }
  }
  return enabled ? retained : {};
}

/** Measure the actual chrome, not a toolbar-height estimate. Insets are relative
 * to the shell area; docked panels already participate in document flow. */
export function useWorkspaceInsets(areaRef: RefObject<HTMLDivElement | null>, enabled: boolean, preset: LayoutPreset, revision: readonly unknown[]): CSSProperties {
  const { margin, clearance } = useWorkspaceSpacing();
  const [insets,setInsets] = useState({top:margin,left:margin,right:margin,bottom:margin});
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area || !enabled) return;
    // Embedded previews own their own chrome. Never charge their dimensions
    // against the enclosing workspace's safe area.
    const ownedChrome = (selector: string) => Array.from(area.querySelectorAll<HTMLElement>(selector))
      .filter(node => node.closest(".aui-shell-area") === area);
    const measure = () => {
      const box = area.querySelector<HTMLElement>(":scope > .aui-shell-main")?.getBoundingClientRect() ?? area.getBoundingClientRect();
      const next = {top:margin,left:margin,right:margin,bottom:margin};
      if (preset !== "docked") {
        const toolbar = ownedChrome(".aui-shell-fltoolbar")[0];
        if (toolbar) next.top = Math.max(margin, toolbar.getBoundingClientRect().bottom - box.top + clearance);
      }
      // Detached panels can also exist in docked mode.
      for (const side of ["left","right"] as const) {
        const nodes = ownedChrome(`.aui-shell-fledge--${side}, .aui-shell[data-design="studio"] .aui-shell-fledge--${side} .aui-tabbed-sidebar-content, .aui-float-panel[data-shell-side="${side}"]`);
        for (const node of nodes) {
          const bounds = node.getBoundingClientRect();
          if (!bounds.width || !bounds.height) continue;
          next[side] = Math.max(next[side], side === "left" ? bounds.right-box.left+clearance : box.right-bounds.left+clearance);
        }
      }
      setInsets(old => Object.keys(next).every(key => old[key as keyof typeof old] === next[key as keyof typeof next]) ? old : next);
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(area);
    ownedChrome(".aui-shell-fltoolbar, .aui-shell-fledge, .aui-float-panel").forEach(node => observer?.observe(node));
    // Transforms do not trigger ResizeObserver; finish detached-panel entrance
    // motion with its settled bounds rather than its initial translated box.
    area.addEventListener("animationend", measure);
    area.addEventListener("transitionend", measure);
    return () => {
      observer?.disconnect();
      area.removeEventListener("animationend", measure);
      area.removeEventListener("transitionend", measure);
    };
  }, [enabled,preset,margin,clearance,...revision]);
  return Object.fromEntries(Object.entries(insets).map(([key,value]) => [`--aui-workspace-inset-${key}`,`${Math.max(0,value)}px`])) as CSSProperties;
}
