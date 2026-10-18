import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AetherIcon } from "./AetherIcon";
import { IconButton } from "./IconButton";
import { DocumentTabs } from "./DocumentTabs";
import { MenuButton, type MenuItem } from "./Menu";
import "./DocumentTabBar.css";

export interface DocumentElementTab {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Kind of element, displayed as a second line in the studio variant. */
  detail?: string;
  disabled?: boolean;
  current?: boolean;
  onSelect?: () => void;
  /** Makes the tab closable (open-file tabs). */
  onClose?: () => void;
}

/**
 * A document's tab row with an add control: the shared DocumentTabs strip plus
 * "+". Along the bottom (Onshape) or in the top bar (Fusion). Presentational —
 * the app supplies the tabs and decides what adding and opening mean.
 */
export function DocumentTabBar({ tabs, addItems = [], onAdd, onAddClick, addLabel = "Insert new tab", addDisabledReason, ariaLabel = "Document tabs", placement = "bottom", variant = "standard", onOverview, overviewLabel = "Document overview", trailing }: {
  tabs: readonly DocumentElementTab[];
  /** Choices for the "+" menu; omit to hide it. */
  addItems?: readonly MenuItem[];
  onAdd?: (id: string) => void;
  /** A plain "+" button instead of a menu, e.g. to open a creation dialog. */
  onAddClick?: () => void;
  addLabel?: string;
  /** When set, "+" is shown disabled with this explanation. */
  addDisabledReason?: string;
  ariaLabel?: string;
  /** "header": tabs along the top bar (Fusion), "+" after the tabs. */
  placement?: "bottom" | "header";
  /** Opt-in dark, full-width thumbnail row; always uses the bottom layout. */
  variant?: "standard" | "studio";
  /** Studio variant's trailing document browser action. */
  onOverview?: () => void;
  overviewLabel?: string;
  /** App-owned document/folder actions, fixed at the right while tabs overflow. */
  trailing?: ReactNode;
}) {
  const studio = variant === "studio";
  const edge = studio ? "bottom" : placement;
  const barRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>();
  const [actionsWidth, setActionsWidth] = useState(0);
  const hasAdd = Boolean(onAddClick || addItems.length);
  useLayoutEffect(() => {
    if (!studio || !barRef.current) return;
    const bar = barRef.current;
    const measure = () => { setWidth(bar.getBoundingClientRect().width); setActionsWidth(actionsRef.current?.getBoundingClientRect().width ?? 0); };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    if (actionsRef.current) observer.observe(actionsRef.current);
    return () => observer.disconnect();
  }, [studio, Boolean(trailing), Boolean(onOverview)]);
  // Reserve the overflow trigger before reducing the visible tab count.
  const room = width == null ? Infinity : width - 14 - (hasAdd ? 54 : 0) - 36 - actionsWidth;
  const maxVisible = studio && room < tabs.length * 174 ? Math.max(1, Math.floor((room - 36) / 174)) : Infinity;
  const enabled = tabs.filter((tab) => !tab.disabled);
  const next = enabled[(enabled.findIndex((tab) => tab.current) + 1) % enabled.length];
  const label = addDisabledReason ?? addLabel;
  const add = onAddClick
    ? <button type="button" className="aui-document-tabbar-add aui-menu-trigger" aria-label={label} title={label} disabled={Boolean(addDisabledReason)} onClick={onAddClick}><AetherIcon name="plus" /></button>
    : addItems.length > 0
      ? <MenuButton className="aui-document-tabbar-add" label={label} disabled={Boolean(addDisabledReason)} items={addItems} placement={edge === "header" ? "bottom-start" : "top-start"} onSelect={(id) => onAdd?.(id)}><AetherIcon name="plus" /></MenuButton>
      : null;
  const byID = (id: string) => tabs.find((tab) => tab.id === id);
  return <div ref={barRef} className={`aui-document-tabbar${studio ? " aui-document-tabbar--studio" : ""}`} data-placement={edge}>
    {edge === "bottom" ? add : null}
    <DocumentTabs ariaLabel={ariaLabel}
      tabs={tabs.map((tab) => ({ id: tab.id, label: tab.label, icon: tab.icon, disabled: tab.disabled, detail: studio ? tab.detail : undefined }))}
      maxVisible={maxVisible}
      activeID={tabs.find((tab) => tab.current)?.id ?? ""}
      onSelect={(id) => { const tab = byID(id); if (tab && !tab.current) tab.onSelect?.(); }}
      onClose={tabs.some((tab) => tab.onClose) ? (id) => byID(id)?.onClose?.() : undefined} />
    {edge === "header" ? add : null}
    {studio ? <IconButton className="aui-document-tabbar-next" label="Next document" size="medium" disabled={enabled.length < 2} onClick={() => next?.onSelect?.()}><AetherIcon name="chevron-right" /></IconButton> : null}
    {trailing || (studio && onOverview) ? <div ref={actionsRef} className="aui-document-tabbar-overview aui-document-tabbar-actions">
      {studio && onOverview && <IconButton label={overviewLabel} size="medium" onClick={onOverview}><AetherIcon name="grid-2" /></IconButton>}
      {trailing}
    </div> : null}
  </div>;
}
