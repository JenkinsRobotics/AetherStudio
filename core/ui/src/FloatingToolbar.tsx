import type { KeyboardEvent, ReactNode } from "react";
import { AetherIcon } from "./AetherIcon";
import { IconButton } from "./IconButton";
import { MenuButton, type MenuButtonProps } from "./Menu";
import { TextField } from "./TextField";
import "./FloatingToolbar.css";

export interface FloatingToolbarAction {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Omit for a command; supply a boolean for a toggle or selected tool. */
  pressed?: boolean;
  disabled?: boolean;
  tone?: "neutral" | "amber" | "blue" | "green";
}

export interface FloatingToolbarGroup {
  id: string;
  label: string;
  actions: readonly FloatingToolbarAction[];
  /** A quiet shared capsule for related switches. */
  capsule?: boolean;
  separatorBefore?: boolean;
}

export interface FloatingToolbarProps {
  ariaLabel: string;
  variant?: "tools" | "document";
  groups: readonly FloatingToolbarGroup[];
  onAction: (id: string) => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  command?: {
    value: string;
    onValueChange: (value: string) => void;
    onSubmit: (value: string) => void;
    label?: string;
    placeholder?: string;
    shortcuts?: readonly FloatingToolbarAction[];
  };
  className?: string;
}

/** Compact floating chrome. Consumers own command matching, active state and
 * document operations; this component handles presentation and keyboard focus. */
export function FloatingToolbar({ ariaLabel, variant = "tools", groups, onAction, leading, trailing, command, className }: FloatingToolbarProps) {
  const focusAction = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    // Portalled menus have their own arrow-key model.
    if (!(event.target instanceof HTMLElement) || event.target.closest('[role="menu"]')) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    event.preventDefault();
    buttons[next]?.focus();
    buttons[next]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };
  return <div className={["aui-floating-toolbar", className].filter(Boolean).join(" ")} data-variant={variant}>
    {command && <form className="aui-floating-toolbar-command" role="search" aria-label={command.label ?? "Find a command"}
      onSubmit={event => { event.preventDefault(); command.onSubmit(command.value.trim()); }}>
      <label className="aui-floating-toolbar-input">
        <AetherIcon name="search" />
        <TextField type="search" aria-label={command.label ?? "Command"} placeholder={command.placeholder ?? "Command"}
          value={command.value} onChange={event => command.onValueChange(event.target.value)}
          onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); command.onValueChange(""); } }} />
      </label>
      {command.shortcuts && <div className="aui-floating-toolbar-shortcuts" aria-label="Suggested commands">
        {command.shortcuts.map(action => <button key={action.id} type="button" data-tone={action.tone ?? "neutral"}
          disabled={action.disabled} aria-pressed={action.pressed} onClick={() => onAction(action.id)}>{action.label}</button>)}
      </div>}
    </form>}
    <div className="aui-floating-toolbar-strip" role="toolbar" aria-label={ariaLabel} aria-orientation="horizontal" onKeyDown={focusAction}>
      {leading && <div className="aui-floating-toolbar-leading">{leading}</div>}
      {groups.map(group => <div key={group.id} className="aui-floating-toolbar-group" role="group" aria-label={group.label}
        data-capsule={group.capsule || undefined} data-separated={group.separatorBefore || undefined}>
        {group.actions.map(action => <IconButton key={action.id} label={action.label} appearance="rounded" size={variant === "document" || group.capsule ? "small" : "large"} aria-pressed={action.pressed}
          disabled={action.disabled} onClick={() => onAction(action.id)}>{action.icon}</IconButton>)}
      </div>)}
      {trailing && <div className="aui-floating-toolbar-trailing">{trailing}</div>}
    </div>
  </div>;
}

/** The same shared menu behavior for the leading menu and trailing document picker. */
export function FloatingToolbarMenu({ iconOnly, className, ...props }: MenuButtonProps & { iconOnly?: boolean }) {
  return <MenuButton {...props} className={["aui-floating-toolbar-menu", className].filter(Boolean).join(" ")} data-icon-only={iconOnly || undefined} />;
}
