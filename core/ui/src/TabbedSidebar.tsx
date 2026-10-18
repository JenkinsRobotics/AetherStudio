import { Fragment, useLayoutEffect, useState, useRef, type CSSProperties, type ReactNode } from "react";
import "./TabbedSidebar.css";
import { useInitialLayoutReady } from "./useInitialLayoutReady";
import { PanelResizeHandle } from "./PanelResizeHandle";
import { resolveSidebarAttachment, useWorkspaceChrome, type SidebarAttachment } from "./WorkspaceChromePreferences";

export interface SidebarTab {
  id: string;
  label: string;
  icon: ReactNode;
  separatorBefore?: boolean;
  command?: boolean;
}

export interface TabbedSidebarProps {
  tabs: readonly SidebarTab[];
  /** Null collapses the panel while leaving the tab strip accessible. */
  activeTab: string | null;
  /** Optional independent panel toggles; the parent composes their contents. */
  activeTabs?: readonly string[];
  onTabToggle?: (id: string) => void;
  onTabChange: (id: string | null) => void;
  tabPosition?: "top" | "bottom" | "left" | "right";
  /** Workspace edge retained while opening and collapsing, independent of tray order. */
  anchor?: "top" | "bottom" | "left" | "right";
  /** Combined card by default at every viewport. Detached is an explicit secondary variant. */
  attachment?: SidebarAttachment;
  /** Slim is an icon-only, equal-cell tray restricted to top/bottom edges. */
  variant?: "standard" | "slim";
  animate?: boolean;
  /** Floating trays collapse to intrinsic icon size; docked trays keep their span. */
  floating?: boolean;
  /** Expanded floating height policy. Content is capped by the available space. */
  heightPolicy?: "fill" | "content" | number;
  ariaLabel: string;
  resize?: {
    side: "left" | "right";
    width: number;
    minWidth?: number;
    maxWidth: number;
    onWidthChange: (width: number) => void;
    onHeightChange?: (height: number) => void;
    onResetWidth: () => void;
    onResetHeight: () => void;
  };
  /** Keep true during the shell's closing animation. */
  expanded?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
}

/** Docked or floating sidebar; parent owns selection and retained editors.
 * The tab strip uses toggle-button semantics because the active tab can close
 * its panel. Arrow keys move focus; Enter/Space activate or close a panel. */
export function TabbedSidebar({ tabs, activeTab, activeTabs, onTabToggle, onTabChange, tabPosition = "top", anchor = tabPosition, attachment, variant = "standard", animate, floating = false, heightPolicy = "fill", resize, ariaLabel, expanded = activeTab !== null, style, children }: TabbedSidebarProps) {
  const layoutReady = useInitialLayoutReady();
  const cardRef = useRef<HTMLElement>(null);
  const position = variant === "slim" && tabPosition !== "bottom" ? "top" : tabPosition;
  const anchoredEdge = variant === "slim" && anchor !== "top" && anchor !== "bottom" ? position : anchor;
  const vertical = position === "left" || position === "right";
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const prefs = useWorkspaceChrome();
  const labels = variant === "slim" ? "icons" : prefs.tabLabels;
  const resolved = resolveSidebarAttachment(attachment ?? prefs.sidebarAttachment);
  const trayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [intrinsic, setIntrinsic] = useState({ tray: 0, content: 0 });
  useLayoutEffect(() => {
    if (!floating) return;
    const tray = trayRef.current;
    if (!tray) return;
    const measure = () => {
      const css = getComputedStyle(tray);
      const pixels = (value: string) => parseFloat(value) || 0;
      const elements = Array.from(tray.children) as HTMLElement[];
      const gap = parseFloat(vertical ? css.rowGap : css.columnGap) || 0;
      const padding = vertical ? pixels(css.paddingTop) + pixels(css.paddingBottom) : pixels(css.paddingLeft) + pixels(css.paddingRight);
      const length = elements.reduce((sum, child) => {
        const box = child.getBoundingClientRect(), style = getComputedStyle(child);
        return sum + (vertical ? box.height + pixels(style.marginTop) + pixels(style.marginBottom) : box.width + pixels(style.marginLeft) + pixels(style.marginRight));
      }, padding + gap * Math.max(0, elements.length - 1) + 2);
      const content = Array.from(contentRef.current?.children ?? []).reduce((sum, child) => sum + child.getBoundingClientRect().height, 0);
      setIntrinsic(old => old.tray === length && old.content === content ? old : { tray: length, content });
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(tray);
    for (const node of [...Array.from(tray.children), ...Array.from(contentRef.current?.children ?? [])]) observer?.observe(node);
    return () => observer?.disconnect();
  }, [floating, resolved, vertical, expanded, activeTab, heightPolicy, tabs, prefs.tabSize, labels, variant]);
  const sizing = {
    ...style,
    ...(typeof heightPolicy === "number" ? { "--aui-sidebar-fixed-height": `${Math.max(0, heightPolicy)}px` } : {}),
    ...(intrinsic.tray > 0 ? { "--aui-sidebar-tray-length": `${Math.ceil(intrinsic.tray)}px` } : {}),
    "--aui-sidebar-content-height": `${Math.ceil(intrinsic.content) + 2}px`,
  } as CSSProperties;
  return <aside ref={cardRef} className="aui-tabbed-sidebar" data-variant={variant} data-tabs={position} data-anchor={anchoredEdge} data-expanded={expanded} data-open={activeTab !== null}
    data-floating={floating} data-height-policy={typeof heightPolicy === "number" ? "fixed" : heightPolicy} data-orientation={vertical ? "vertical" : "horizontal"} data-attachment={resolved} data-tab-size={prefs.tabSize} data-labels={labels} data-animate={layoutReady && (animate ?? prefs.panelMotion !== "none")} aria-label={ariaLabel} style={sizing}>
    <div ref={trayRef} className="aui-tabbed-sidebar-tabs" role="toolbar" aria-label={`${ariaLabel} tabs`} aria-orientation={vertical ? "vertical" : "horizontal"}
      onKeyDown={event => {
        const index = tabs.findIndex(tab => buttons.current.get(tab.id) === event.target);
        if (index < 0) return;
        const next = event.key === (vertical ? "ArrowDown" : "ArrowRight") ? (index + 1) % tabs.length : event.key === (vertical ? "ArrowUp" : "ArrowLeft") ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
        if (next < 0) return;
        event.preventDefault();
        const button = buttons.current.get(tabs[next].id);
        button?.focus();
        button?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      }}>
      {tabs.map((tab, index) => <Fragment key={tab.id}>
        {tab.separatorBefore && <span className="aui-sidebar-tab-separator" role="separator" aria-orientation={vertical ? "horizontal" : "vertical"} />}
        <button type="button"
        ref={node => { if (node) buttons.current.set(tab.id, node); else buttons.current.delete(tab.id); }}
        className="aui-tabbed-sidebar-tab" title={tab.label} aria-label={tab.label} aria-pressed={tab.command ? undefined : activeTabs ? activeTabs.includes(tab.id) : activeTab === tab.id} aria-haspopup={tab.command ? "dialog" : undefined}
        tabIndex={activeTab === tab.id || (!tabs.some(item => item.id === activeTab) && index === 0) ? 0 : -1}
        onClick={() => onTabToggle ? onTabToggle(tab.id) : onTabChange(activeTab === tab.id ? null : tab.id)}>{tab.icon}{labels === "labels" && <span className="aui-tabbed-sidebar-tab-label">{tab.label}</span>}</button></Fragment>)}
    </div>
    {expanded && <div ref={contentRef} className="aui-tabbed-sidebar-content">{children}</div>}
    {resize && activeTab !== null && <>
      <PanelResizeHandle edge={resize.side === "left" ? "right" : "left"} label={`Resize ${resize.side} sidebar width`}
        value={resize.width} min={resize.minWidth} max={resize.maxWidth} onChange={resize.onWidthChange} onReset={resize.onResetWidth} />
      {floating && resize.onHeightChange && <PanelResizeHandle edge={anchoredEdge === "bottom" ? "top" : "bottom"} label={`Resize ${resize.side} sidebar height`}
        min={72} value={() => cardRef.current?.getBoundingClientRect().height ?? 240}
        max={cardRef.current?.parentElement?.clientHeight || 1000}
        onChange={resize.onHeightChange} onReset={resize.onResetHeight} />}
    </>}
  </aside>;
}
