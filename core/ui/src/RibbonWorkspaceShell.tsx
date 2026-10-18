import type { CSSProperties } from "react";
import { DocumentBar, type DocumentBarProps } from "./DocumentBar";
import { WorkspaceShell, type WorkspaceShellProps } from "./WorkspaceShell";
import { WorkspaceRibbon, type WorkspaceRibbonProps } from "./WorkspaceRibbon";
import "./RibbonWorkspaceShell.css";

export interface RibbonWorkspaceShellProps extends Omit<WorkspaceShellProps, "toolbar" | "style"> {
  /** Document identity and account/chrome slots. Workspace switching lives in the ribbon. */
  documentBar: Omit<DocumentBarProps, "center">;
  ribbon: WorkspaceRibbonProps;
  className?: string;
  /** Give the shell a bounded height, or place it in a parent with a definite height. */
  style?: CSSProperties;
}

/** Document header and tabbed ribbon layout. Uses the same retained viewport,
 * rails, dockable panels, bottom panel, and status bar as WorkspaceShell. */
export function RibbonWorkspaceShell({
  documentBar, ribbon, className, style, preservePanelContent = true, ...workspace
}: RibbonWorkspaceShellProps) {
  return (
    <div className={["aui-ribbon-workspace-shell", className].filter(Boolean).join(" ")} style={style}>
      <DocumentBar {...documentBar} />
      <WorkspaceShell {...workspace} preservePanelContent={preservePanelContent}
        style={{ flex: "1 1 0", minHeight: 0 }} toolbar={<WorkspaceRibbon {...ribbon} />} />
    </div>
  );
}
