import { useId, useState, type ReactNode } from "react";
import { AetherIcon } from "./AetherIcon";
import { SplitPane } from "./SplitPane";
import "./WorkbenchWindow.css";

export interface WorkbenchWindowProps {
  title: string;
  subtitle?: string;
  sidebar: ReactNode;
  sidebarTitle?: string;
  sidebarActions?: ReactNode;
  sidebarFooter?: ReactNode;
  toolbar?: ReactNode;
  statusBar?: ReactNode;
  /** Presentation overlays only; the owner supplies real diagnostic values. */
  canvasOverlay?: ReactNode;
  canvasFooter?: ReactNode;
  children: ReactNode;
  sidebarCollapsed?: boolean;
  defaultSidebarCollapsed?: boolean;
  onSidebarCollapsedChange?: (collapsed: boolean) => void;
  sidebarWidth?: number;
  defaultSidebarWidth?: number;
  onSidebarWidthChange?: (width: number) => void;
  className?: string;
}

/** Codex Bench's split-window anatomy, without its renderer or benchmark logic.
 * Compose file lists/trees, toolbar, canvas and status from the owning product.
 * The hidden sidebar remains mounted, preserving drafts and selection.
 */
export function WorkbenchWindow({
  title, subtitle, sidebar, sidebarTitle = "Files", sidebarActions,
  sidebarFooter, toolbar, statusBar, canvasOverlay, canvasFooter, children,
  sidebarCollapsed, defaultSidebarCollapsed = false, onSidebarCollapsedChange,
  sidebarWidth, defaultSidebarWidth = 265, onSidebarWidthChange, className,
}: WorkbenchWindowProps) {
  const sidebarID = useId();
  const [localCollapsed, setLocalCollapsed] = useState(defaultSidebarCollapsed);
  const collapsed = sidebarCollapsed ?? localCollapsed;
  const changeCollapsed = (next: boolean) => {
    if (sidebarCollapsed === undefined) setLocalCollapsed(next);
    onSidebarCollapsedChange?.(next);
  };
  return <section className={["aui-workbench-window",className].filter(Boolean).join(" ")} aria-label={title}>
    <SplitPane
      defaultPrimarySize={defaultSidebarWidth}
      primarySize={sidebarWidth}
      minPrimarySize={220}
      maxPrimarySize={340}
      onResize={onSidebarWidthChange}
      collapsed={collapsed}
      onCollapsedChange={changeCollapsed}
      collapseSide="primary"
      separatorLabel="Resize workspace sidebar"
      primary={<aside id={sidebarID} className="aui-workbench-sidebar" aria-label={sidebarTitle}>
        <header><strong>{sidebarTitle}</strong>{sidebarActions}</header>
        <div className="aui-workbench-sidebar-content">{sidebar}</div>
        {sidebarFooter ? <footer>{sidebarFooter}</footer> : null}
      </aside>}
      secondary={<div className="aui-workbench-detail">
        <header className="aui-workbench-toolbar">
          <button type="button" className="aui-icon-button" aria-label={collapsed ? "Show sidebar" : "Hide sidebar"} aria-expanded={!collapsed} aria-controls={sidebarID} onClick={() => changeCollapsed(!collapsed)}>
            <AetherIcon name="sidebar"/>
          </button>
          <div className="aui-workbench-heading"><strong>{title}</strong>{subtitle ? <small>{subtitle}</small> : null}</div>
          {toolbar ? <div className="aui-workbench-actions" role="group" aria-label="Workspace actions">{toolbar}</div> : null}
        </header>
        <div className="aui-workbench-canvas">
          <div className="aui-workbench-content">{children}</div>
          {canvasOverlay ? <div className="aui-workbench-overlay">{canvasOverlay}</div> : null}
          {canvasFooter ? <div className="aui-workbench-canvas-footer">{canvasFooter}</div> : null}
        </div>
        {statusBar ? <footer className="aui-workbench-status">{statusBar}</footer> : null}
      </div>}
    />
  </section>;
}
