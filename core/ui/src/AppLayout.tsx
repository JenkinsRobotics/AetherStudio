import type { CSSProperties, ReactNode } from "react";
import { WorkspaceShell, type WorkspacePanel } from "./WorkspaceShell";
import "./AppLayout.css";

/** Shared measurements for the standard docked application. Values are CSS pixels. */
export const APP_LAYOUT_METRICS = {
  headerHeight: 56,
  sidebarWidth: 280,
  sidebarMinWidth: 220,
  sidebarMaxWidth: 360,
  centerMinWidth: 360,
  toolbarMinHeight: 44,
  toolbarMaxHeight: 96,
  footerMinHeight: 40,
  footerMaxFraction: 0.3,
  widgetPadding: 12,
  widgetGap: 8,
  minWidth: 960,
  minHeight: 480,
} as const;

export interface AppLayoutProps {
  /** App controls, workspace selection, user, appearance and sharing. */
  header?: ReactNode;
  /** Document navigation, structure, files, history and related controls. */
  left?: readonly WorkspacePanel[];
  /** The primary canvas, editor or viewport. */
  center: ReactNode;
  /** Properties and context for the active workspace or selection. */
  right?: readonly WorkspacePanel[];
  /** Workspace-adjacent content: documents, status, transport, timeline or output. */
  footer?: ReactNode;
  topToolbar?: ReactNode;
  bottomToolbar?: ReactNode;
  storageKey?: string;
  className?: string;
  style?: CSSProperties;
}

/** Standard Header / Left / Center / Right / Footer composition of WorkspaceShell.
 * Shared sidebars retain their existing resize, collapse and editor-state behavior. */
export function AppLayout({ header, left = [], center, right = [], footer, topToolbar, bottomToolbar, storageKey, className, style }: AppLayoutProps) {
  const m = APP_LAYOUT_METRICS;
  const metrics = Object.fromEntries(Object.entries(m).map(([key, value]) => [`--aui-app-${key}`, key === "footerMaxFraction" ? `${value * 100}%` : `${value}px`])) as CSSProperties;
  const panels = (items: readonly WorkspacePanel[], side: string) => items.map(panel => ({
    ...panel,
    contentLayout: panel.contentLayout ?? "custom" as const,
    content: <div className="aui-app-layout-widgets" data-app-region={side}>{panel.content}</div>,
  }));
  return <div className={["aui-app-layout", className].filter(Boolean).join(" ")} style={{ ...metrics, ...style }}>
    {header && <header className="aui-app-layout-header" aria-label="Header" data-app-region="header">{header}</header>}
    <WorkspaceShell preset="docked" toolbarSpan="center" sidebarVariant="tabs-top" sidebarAttachment="attached"
      inheritChromePreferences={false} animatePanels={false} storageKey={storageKey}
      sidebarSizing={{ width: m.sidebarWidth, minWidth: m.sidebarMinWidth, maxWidth: m.sidebarMaxWidth, minCenterWidth: m.centerMinWidth + 4 }}
      leftPanels={panels(left, "left")} rightPanels={panels(right, "right")}
      defaultOpenLeft={left[0] ? [left[0].id] : []} defaultOpenRight={right[0] ? [right[0].id] : []}
      toolbar={topToolbar && <div className="aui-app-layout-toolbar" data-app-region="top-toolbar" role="region" aria-label="Top toolbar">{topToolbar}</div>}
      centerBottom={bottomToolbar && <div className="aui-app-layout-toolbar aui-app-layout-toolbar--bottom" data-app-region="bottom-toolbar" role="region" aria-label="Bottom toolbar">{bottomToolbar}</div>}>
      <main className="aui-app-layout-center" aria-label="Center" data-app-region="center">{center}</main>
    </WorkspaceShell>
    {footer && <footer className="aui-app-layout-footer" aria-label="Footer" data-app-region="footer">{footer}</footer>}
  </div>;
}
