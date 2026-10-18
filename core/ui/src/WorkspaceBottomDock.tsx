import { useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PanelResizeHandle } from "./PanelResizeHandle";
import { TabbedSidebar, type SidebarTab } from "./TabbedSidebar";
import "./WorkspaceBottomDock.css";
import { WorkspaceLayoutContext } from "./WorkspaceLayoutContext";
import { useWorkspaceSpacing } from "./WorkspaceSpacing";

export interface WorkspaceBottomDockProps {
  tabs: readonly SidebarTab[];
  activeTab: string | null;
  /** Independent open panels; when provided, an empty list collapses the dock. */
  activeTabs?: readonly string[];
  onTabToggle?: (id: string) => void;
  onTabChange: (id: string | null) => void;
  children: ReactNode;
  ariaLabel?: string;
  /** Fraction of the workspace width, excluding outer margins; defaults to 60%. */
  widthFraction?: number;
  storageKey?: string;
  defaultHeight?: number;
  /** Preferred content height, excluding the icon tray. */
  height?: number;
  minHeight?: number;
  onHeightChange?: (height: number) => void;
}

/** A bottom-centered card whose floating anchor is independent of sidebars.
 * Docked mode reserves canvas space. The last panel stays mounted while collapsed. */
export function WorkspaceBottomDock({ tabs, activeTab: selectedTab, activeTabs, onTabToggle, onTabChange, children,
  ariaLabel = "Bottom workspace dock", widthFraction = 0.6, height = 240,
  minHeight = 72, onHeightChange, storageKey, defaultHeight = 240 }: WorkspaceBottomDockProps) {
  const activeTab = activeTabs ? activeTabs[0] ?? null : selectedTab;
  const docked = useContext(WorkspaceLayoutContext) === "docked";
  const { margin } = useWorkspaceSpacing();
  const [customWidth, setCustomWidth] = useState<number | undefined>(() => {
    try { const saved = storageKey ? Number(localStorage.getItem(`${storageKey}.width`)) : 0; return Number.isFinite(saved) && saved >= 180 ? saved : undefined; } catch { return undefined; }
  });
  const resizeWidth = (width: number | undefined) => {
    setCustomWidth(width);
    try { if (storageKey) { if (width === undefined) localStorage.removeItem(`${storageKey}.width`); else localStorage.setItem(`${storageKey}.width`, String(width)); } } catch { /* Optional preference. */ }
  };
  const frame = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ width: 800, height: 600 });
  const drag = useRef<{ y: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const node = frame.current;
    if (!node) return;
    const measure = () => setRoom(old => {
      const next = { width: node.clientWidth, height: docked ? node.closest<HTMLElement>(".aui-shell-center")?.clientHeight ?? node.clientHeight : node.clientHeight };
      return old.width === next.width && old.height === next.height ? old : next;
    });
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(node);
    if (docked && node.closest(".aui-shell-center")) observer?.observe(node.closest(".aui-shell-center")!);
    return () => observer?.disconnect();
  }, [docked]);
  useLayoutEffect(() => {
    const node = frame.current;
    const card = node?.querySelector<HTMLElement>(".aui-tabbed-sidebar");
    const center = node?.closest<HTMLElement>(".aui-shell-center");
    if (!card || !center) return;
    const previous = center.style.getPropertyValue("--aui-bottom-dock-clearance");
    const measure = () => center.style.setProperty("--aui-bottom-dock-clearance", docked ? "0px" : `${Math.max(0, center.getBoundingClientRect().bottom - card.getBoundingClientRect().top + 10)}px`);
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(card); observer?.observe(center);
    return () => { observer?.disconnect(); if(previous) center.style.setProperty("--aui-bottom-dock-clearance",previous); else center.style.removeProperty("--aui-bottom-dock-clearance"); };
  }, [docked]);
  const maxHeight = Math.max(minHeight, room.height * 0.65 - 52);
  const clamp = (value: number) => Math.max(minHeight, Math.min(maxHeight, value));
  const contentHeight = clamp(height);
  const width = Math.min(room.width, customWidth ?? Math.max(480, room.width * Math.min(1, Math.max(0.6, widthFraction))));
  return <div className="aui-workspace-bottom-dock" data-layout={docked ? "docked" : "floating"} ref={frame}
    style={{ "--aui-bottom-dock-margin": `${margin}px` } as CSSProperties}>
    <TabbedSidebar tabs={tabs} activeTab={activeTab} activeTabs={activeTabs} onTabToggle={onTabToggle} onTabChange={onTabChange}
      ariaLabel={ariaLabel} tabPosition="bottom" attachment="attached" floating={!docked}
      expanded heightPolicy="fill" style={{
        // Container units resolve against the outer frame on the first layout;
        // an observer's provisional pixel width would visibly jump on refresh.
        "--aui-sidebar-expanded-width": docked ? "100cqw" : customWidth === undefined
          ? `min(100cqw, max(480px, ${Math.min(1, Math.max(0.6, widthFraction)) * 100}cqw))`
          : `min(100cqw, ${customWidth}px)`,
        "--aui-bottom-dock-content-height": `${contentHeight}px`,
      } as CSSProperties}>
      <div className="aui-workspace-bottom-dock-editor" inert={activeTab === null} aria-hidden={activeTab === null}>
        {onHeightChange && <div className="aui-workspace-bottom-dock-resize" role="separator" aria-label="Resize bottom dock"
          aria-orientation="horizontal" aria-valuemin={minHeight} aria-valuemax={Math.round(maxHeight)} aria-valuenow={Math.round(contentHeight)} tabIndex={activeTab === null ? -1 : 0}
          title="Resize"
          onDoubleClick={() => onHeightChange(defaultHeight)}
          onPointerDown={event => {
            if (event.button !== 0) return;
            event.preventDefault();
            drag.current = { y: event.clientY, height: contentHeight };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={event => { if (drag.current) onHeightChange(clamp(drag.current.height + drag.current.y - event.clientY)); }}
          onPointerUp={event => { drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
          onPointerCancel={() => { drag.current = null; }}
          onLostPointerCapture={() => { drag.current = null; }}
          onKeyDown={event => {
            const step = event.shiftKey ? 50 : 10;
            const next = event.key === "ArrowUp" ? contentHeight + step : event.key === "ArrowDown" ? contentHeight - step : event.key === "Home" ? defaultHeight : event.key === "End" ? maxHeight : null;
            if (next !== null) { event.preventDefault(); onHeightChange(clamp(next)); }
          }} />}
        <div className="aui-workspace-bottom-dock-body">{children}</div>
        {!docked && activeTab !== null && <PanelResizeHandle edge="right" label="Resize bottom dock width" value={width} min={Math.min(180,room.width)} max={room.width} scale={2} onChange={resizeWidth} onReset={() => resizeWidth(undefined)} /> }
      </div>
    </TabbedSidebar>
  </div>;
}
