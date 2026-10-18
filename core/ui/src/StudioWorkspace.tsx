import { useLayoutEffect, useRef, type ReactNode } from "react";
import { WorkspaceShell, type WorkspaceShellProps } from "./WorkspaceShell";
import { FloatingToolbar } from "./FloatingToolbar";
import "./StudioAppFrame.css";

export interface StudioWorkspaceProps extends Omit<WorkspaceShellProps, "preset" | "design"> {
  preset?: WorkspaceShellProps["preset"];
  /** Workspace selection and view-state buttons; never document/app identity. */
  workspaceControls?: ReactNode;
  /** Dense specialist workspaces may retain a top ribbon. */
  toolPosition?: "top" | "bottom";
}

function StudioToolTray({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    const center = node?.closest<HTMLElement>(".aui-shell-center");
    if (!node || !center) return;
    const measure = () => center.style.setProperty("--aui-studio-tools-clearance", `${Math.max(0, center.getBoundingClientRect().bottom - node.getBoundingClientRect().top + 12)}px`);
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(node); observer?.observe(center);
    return () => { observer?.disconnect(); center.style.removeProperty("--aui-studio-tools-clearance"); };
  }, []);
  return <div ref={ref} className="aui-studio-tool-tray">{children}</div>;
}

/** Shared floating cards, matched side widths and center tool trays. */
export function StudioWorkspace({ preset = "floating", workspaceControls, toolPosition = "bottom", toolbar, centerBottom, ...props }: StudioWorkspaceProps) {
  const tools = toolbar ? <StudioToolTray>{toolbar}</StudioToolTray> : null;
  return <WorkspaceShell {...props} design="studio" preset={preset}
    sidebarSizing={props.sidebarSizing ?? { width: 216, minWidth: 180, maxWidth: 520, minCenterWidth: 240 }}
    inheritChromePreferences={false} sidebarAttachment="detached" frameToolbar={false}
    toolbar={workspaceControls || (toolPosition === "top" && tools) ? <div className="aui-studio-workspace-tools">
      {workspaceControls && <FloatingToolbar variant="document" ariaLabel="Workspace controls" groups={[]} onAction={() => {}} leading={workspaceControls}/>}
      {toolPosition === "top" && tools}
    </div> : undefined}
    centerBottom={centerBottom || (toolPosition === "bottom" && tools) ? <>{centerBottom}{toolPosition === "bottom" && tools}</> : undefined} />;
}
