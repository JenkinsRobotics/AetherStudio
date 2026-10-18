import { ToolHelp, type ToolHelpContent } from "./ToolHelp";
import { contextTargetAt, contextCommandsFor, contextCommandItems, runContextCommand } from './context-commands';
import { createPortal } from "react-dom";
import { AetherIcon } from "./AetherIcon";
import { useOverlayHost } from "./OverlayScope";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, CSSProperties, KeyboardEvent, ReactNode } from "react";
import {
  useOverlayPosition,
  type OverlayAnchor,
  type OverlayPlacement,
} from "./overlay-position";

export type MenuItemKind = "command" | "checkbox" | "radio";

export interface MenuItem {
  help?: ToolHelpContent;
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  kind?: MenuItemKind;
  checked?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  danger?: boolean;
  separatorBefore?: boolean;
  /** Names the section this item opens, for menus long enough to need finding
   *  rather than reading. A bare separator divides; a heading says what into. */
  heading?: string;
  children?: readonly MenuItem[];
}

export interface MenuProps {
  /** Comfortable spacing for creation pickers; context menus remain compact. */
  density?: "compact" | "comfortable";
  /** Existing pointer menus append registered application/work-area commands. */
  applicationCommands?: boolean;
  open: boolean;
  anchor: OverlayAnchor | null;
  items: readonly MenuItem[];
  onSelect: (id: string) => void;
  onClose: () => void;
  ariaLabel: string;
  placement?: OverlayPlacement;
  returnFocus?: boolean;
  className?: string;
  style?: CSSProperties;
}

function menuRole(item: MenuItem): "menuitem" | "menuitemcheckbox" | "menuitemradio" {
  if (item.kind === "checkbox") return "menuitemcheckbox";
  if (item.kind === "radio") return "menuitemradio";
  return "menuitem";
}

/** Controlled popup menu. All menu surfaces consume the same item model and
 * report command IDs; product code owns availability and execution. */
export function Menu({
  open,
  anchor,
  items,
  onSelect,
  onClose,
  ariaLabel,
  placement = "bottom-start",
  returnFocus = true,
  className, style, applicationCommands = true, density = "compact",
}: MenuProps) {
  const contextTarget = applicationCommands ? contextTargetAt(anchor) : null;
  const commands = contextTarget ? contextCommandsFor(contextTarget).filter(c => !items.some(item => item.label === c.label)) : [];
  const displayedItems = commands.length ? [
    ...items,
    ...contextCommandItems(commands).map((item,index)=>index===0 ? {...item,separatorBefore:items.length>0} : item),
  ] : items;
  const choose = (id: string) => {
    const command = commands.find(c => `aether:${c.id}` === id);
    if (command) runContextCommand(command); else onSelect(id);
  };
  const overlayHost = useOverlayHost();
  const rootRef = useRef<HTMLUListElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [expandedIDs, setExpandedIDs] = useState<ReadonlySet<string>>(new Set());
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelLeave = () => {
    if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  };
  useEffect(() => { if (!open) cancelLeave(); return cancelLeave; }, [open]);
  const branchFor = (id: string, entries = displayedItems, parents: string[] = []): string[] | undefined => {
    for (const entry of entries) {
      if (entry.id === id) return [...parents, id];
      const found = entry.children && branchFor(id, entry.children as MenuItem[], [...parents, entry.id]);
      if (found) return found;
    }
  };
  const position = useOverlayPosition({
    open,
    overlayRef: rootRef,
    anchor,
    placement,
  });

  useLayoutEffect(() => {
    if (!open || position.visibility !== "visible") return;
    returnFocusRef.current =
      anchor instanceof HTMLElement && anchor.tabIndex >= 0
        ? anchor
        : (document.activeElement as HTMLElement | null);
    setExpandedIDs(new Set());
    rootRef.current
      ?.querySelector<HTMLButtonElement>('.aui-menu-item:not(:disabled)')
      ?.focus();
  }, [anchor, open, position.visibility]);

  useEffect(() => {
    if (!open) return;
    const onDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (anchor instanceof HTMLElement && anchor.contains(target)) return;
      onClose();
    };
    document.addEventListener("keydown", onDocumentKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onDocumentKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      // A command can open an inline editor or dialog before this menu unmounts.
      // Restore the trigger only when focus has not already moved to that control.
      const focused = document.activeElement;
      if (returnFocus && (!focused || focused === document.body || rootRef.current?.contains(focused))) {
        returnFocusRef.current?.focus?.();
      }
      returnFocusRef.current = null;
    };
  }, [anchor, onClose, open, returnFocus]);

  const buttonsIn = (list: HTMLElement): HTMLButtonElement[] =>
    Array.from(list.children)
      .map((child) => child.querySelector<HTMLButtonElement>(":scope > .aui-menu-item"))
      .filter((button): button is HTMLButtonElement => Boolean(button && !button.disabled));

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
      ".aui-menu-item",
    );
    if (!target) return;
    const list = target.closest<HTMLElement>('[role="menu"]');
    if (!list) return;
    const buttons = buttonsIn(list);
    const index = buttons.indexOf(target);
    const focusAt = (next: number) => buttons[next]?.focus();

    switch (event.key) {
      case "ArrowDown":
        focusAt((index + 1) % buttons.length);
        break;
      case "ArrowUp":
        focusAt((index - 1 + buttons.length) % buttons.length);
        break;
      case "Home":
        focusAt(0);
        break;
      case "End":
        focusAt(buttons.length - 1);
        break;
      case "ArrowRight": {
        const id = target.dataset.menuItemId;
        if (!id || target.getAttribute("aria-haspopup") !== "menu") return;
        cancelLeave();
        setExpandedIDs(new Set(branchFor(id)));
        queueMicrotask(() => {
          const submenu = Array.from(
            rootRef.current?.querySelectorAll<HTMLElement>("[data-menu-parent]") ?? [],
          ).find((candidate) => candidate.dataset.menuParent === id);
          submenu?.querySelector<HTMLButtonElement>(".aui-menu-item:not(:disabled)")?.focus();
        });
        break;
      }
      case "ArrowLeft": {
        const parentID = list.dataset.menuParent;
        if (!parentID) return;
        setExpandedIDs((current) => {
          const next = new Set(current);
          next.delete(parentID);
          return next;
        });
        Array.from(
          rootRef.current?.querySelectorAll<HTMLButtonElement>("[data-menu-item-id]") ?? [],
        )
          .find((candidate) => candidate.dataset.menuItemId === parentID)
          ?.focus();
        break;
      }
      case "Enter":
      case " ":
        target.click();
        break;
      case "Escape":
        onClose();
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const renderItems = (menuItems: readonly MenuItem[], parentID?: string, parents: string[] = []): ReactNode => (
    <ul
      data-density={density}
      className={[parentID ? "aui-menu aui-menu-submenu" : "aui-menu", className].filter(Boolean).join(" ")}
      role="menu"
      aria-label={parentID ? undefined : ariaLabel}
      data-menu-parent={parentID}
      onKeyDown={onKeyDown}
      ref={parentID ? undefined : rootRef}
      style={parentID ? undefined : { ...position, ...style }}
    >
      {menuItems.map((item) => {
        const hasChildren = Boolean(item.children?.length);
        const expanded = hasChildren && expandedIDs.has(item.id);
        const classes = ["aui-menu-item"];
        if (item.danger) classes.push("aui-menu-item--danger");
        return (
          <li key={item.id} className="aui-menu-entry" role="none"
            onMouseEnter={cancelLeave}
            onMouseLeave={() => {
              cancelLeave();
              // Allow crossing the small gap between parent and submenu.
              leaveTimer.current = setTimeout(() => setExpandedIDs(new Set(parents)), 160);
            }}>
            {item.separatorBefore ? <div className="aui-menu-separator" role="separator" /> : null}
            {item.heading ? <div className="aui-menu-heading" role="presentation">{item.heading}</div> : null}
            <ToolHelp label={item.label} help={item.help} disabledReason={item.disabled ? item.disabledReason : undefined}><button
              type="button"
              className={classes.join(" ")}
              role={menuRole(item)}
              aria-checked={item.kind && item.kind !== "command" ? Boolean(item.checked) : undefined}
              aria-haspopup={hasChildren ? "menu" : undefined}
              aria-expanded={hasChildren ? expanded : undefined}
              disabled={item.disabled}
              title={!item.help && item.disabled ? item.disabledReason : undefined}
              data-menu-item-id={item.id}
              onMouseEnter={() => {
                cancelLeave();
                setExpandedIDs(new Set(hasChildren && !item.disabled ? [...parents, item.id] : parents));
              }}
              onClick={() => {
                cancelLeave();
                if (hasChildren) {
                  setExpandedIDs(new Set([...parents, item.id]));
                  return;
                }
                choose(item.id);
                onClose();
              }}
            >
              <span className="aui-menu-check" aria-hidden>
                {item.checked && (item.kind === "radio" || item.kind === "checkbox") ? <AetherIcon name="check" /> : ""}
              </span>
              <span className="aui-menu-icon" aria-hidden>{item.icon ?? ""}</span>
              <span className="aui-menu-label">{item.label}</span>
              <span className="aui-menu-shortcut">{item.shortcut ?? ""}</span>
              <span className="aui-menu-arrow" aria-hidden>{hasChildren ? "›" : ""}</span>
            </button></ToolHelp>
            {expanded && item.children ? renderItems(item.children, item.id, [...parents, item.id]) : null}
          </li>
        );
      })}
    </ul>
  );

  if (!open || !anchor || typeof document === "undefined") return null;
  return createPortal(renderItems(displayedItems), overlayHost ?? document.body);
}

export interface MenuButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onSelect"> {
  density?: "compact" | "comfortable";
  label: string;
  items: readonly MenuItem[];
  onSelect: (id: string) => void;
  children: ReactNode;
  placement?: OverlayPlacement;
  /** What the menu lines up with.
   *
   *  `"trigger"` is the button itself. `"group"` is the element containing it,
   *  for a trigger that is only part of a control — a ribbon tool is a button
   *  plus a caret, and a menu hanging off the caret opens halfway across the
   *  tool it belongs to. */
  anchorTo?: "trigger" | "group";
}

/** Standard anchor button for a Menu. Context menus use Menu directly with a
 * pointer position anchor. */
export function MenuButton({
  label,
  items,
  onSelect,
  children,
  placement = "bottom-end",
  anchorTo = "trigger",
  density = "compact",
  className,
  ...buttonProps
}: MenuButtonProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const classes = ["aui-menu-trigger"];
  if (className) classes.push(className);
  return (
    <>
      <button
        {...buttonProps}
        ref={anchorRef}
        type="button"
        className={classes.join(" ")}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {children}
      </button>
      <Menu
        open={open}
        anchor={anchorTo === "group"
          ? (anchorRef.current?.parentElement ?? anchorRef.current)
          : anchorRef.current}
        items={items}
        onSelect={onSelect}
        onClose={() => setOpen(false)}
        ariaLabel={label}
        placement={placement}
        density={density}
      />
    </>
  );
}
