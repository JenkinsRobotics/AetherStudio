import { useRef, useState, type ReactNode } from "react";
import { AetherIcon } from "./AetherIcon";
import { Menu, type MenuButtonProps } from "./Menu";
import "./WorkspaceSwitcher.css";

export interface WorkspaceSwitcherItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
}

export interface WorkspaceSwitcherProps {
  workspaces: readonly WorkspaceSwitcherItem[];
  workspaceID: string;
  onSelect: (id: string) => void;
  /**
   * Overrides the accessible name. The default — "Workspace: Mapping" — names
   * the control *and* its value, which matters because an application may also
   * have a workspace *window* menu, and two controls called "Workspace" are
   * ambiguous to anyone reading by label.
   */
  label?: string;
  className?: string;
  /** Class on the dropdown, e.g. `aui-tool-menu` for the toolbar look. */
  menuClassName?: string;
}

/**
 * The room you are working in, as a button that names it.
 *
 * A workspace is not a tab. Picking one changes *which tabs exist*, so drawing
 * it as a peer of the tool tabs misreports the hierarchy — which is why this
 * exists as its own control rather than another entry in the strip.
 *
 * It owns its appearance so no application needs override CSS. That matters
 * more than it sounds: `.aui-menu-trigger` is an `inline-grid` with no border,
 * and a single-class rule in an app stylesheet loses to it on source order —
 * silently, producing a control that reads as a heading. The selector here is
 * element-plus-class so it wins wherever the sheets land.
 */
/**
 * `MenuButton` with a class on the menu it opens — the tool-menu look
 * (`aui-tool-menu`: dark rounded panel, uppercase caption, icon-and-label
 * rows, the kit sidebar's popover) for every toolbar dropdown. Lives here
 * rather than in Menu.tsx while that file is under another lane's claim;
 * fold it into MenuButton as `menuClassName` when it frees.
 */
export function ToolMenuButton({
  label, items, onSelect, children, placement = "bottom-end", anchorTo = "trigger", className, menuClassName, ...buttonProps
}: MenuButtonProps & { menuClassName?: string }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const classes = ["aui-menu-trigger"];
  if (className) classes.push(className);
  return (
    <>
      <button {...buttonProps} ref={anchorRef} type="button" className={classes.join(" ")} aria-label={label} title={label}
        aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        {children}
      </button>
      <Menu open={open} anchor={anchorTo === "group" ? (anchorRef.current?.parentElement ?? anchorRef.current) : anchorRef.current}
        items={items} onSelect={onSelect} onClose={() => setOpen(false)} ariaLabel={label} placement={placement} className={menuClassName} />
    </>
  );
}

export function WorkspaceSwitcher({
  workspaces, workspaceID, onSelect, label, className, menuClassName,
}: WorkspaceSwitcherProps) {
  const current = workspaces.find((workspace) => workspace.id === workspaceID);
  const classes = ["aui-workspace-switcher"];
  if (className) classes.push(className);
  return (
    <ToolMenuButton
      className={classes.join(" ")}
      menuClassName={menuClassName}
      label={label ?? `Workspace: ${current?.label ?? ""}`}
      placement="bottom-start"
      items={workspaces.map((workspace, index) => ({
        id: workspace.id,
        label: workspace.label,
        icon: workspace.icon,
        disabled: workspace.disabled,
        disabledReason: workspace.disabledReason,
        kind: "radio" as const,
        checked: workspace.id === workspaceID,
        heading: index === 0 ? "Workspace" : undefined,
      }))}
      onSelect={onSelect}
    >
      {current?.icon ? <span className="aui-workspace-switcher-icon" aria-hidden="true">{current.icon}</span> : null}
      <span className="aui-workspace-switcher-name">{current?.label ?? "Workspace"}</span>
      <AetherIcon name="chevron" />
    </ToolMenuButton>
  );
}
