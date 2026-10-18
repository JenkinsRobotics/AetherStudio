/**
 * WorkspaceShell.swift + Sidebars.swift: the three sidebars and the scaffold.
 *
 *   TOP   → ToolSidebar       tools that act on OBJECTS
 *   LEFT  → WorkspaceSidebar  what you are working ON (browser/tree/library)
 *   RIGHT → ViewSidebar       how it is PRESENTED (view, environment, appearance, inspector)
 *
 * Shared state (layout flags, armed tool, ribbon settings, the right sidebar's
 * panel stack and presentation prefs) travels through KitShellContext so the
 * viewport, prompt bar and every ribbon agree on what the pointer is doing.
 */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode } from "react";
import { MenuButton } from "../Menu";
import { Popover } from "../Popover";
import { Sym, ToolGlyph } from "./icons";
import {
  categoryIcon, detectPreset, floatingPanels, isEnabled, isOpen, nearHomeEdge, overflowTools, primaryTools, ribbonGroupsOf, stackedPanels, toolPrompt,
  TOOL_DENSITIES, type ArmedTool, type LayoutFlags, type Offset, type PanelStack, type PanelStackActions, type RibbonGroup, type RibbonTool,
  type ToolCategory, type ToolDensity, type ToolGroup, type ToolPopupStyle, usePanelStack, panelStack,
} from "./state";
import { AD, Caption, Divider, Range, Segmented, ToggleLine, tintStyle } from "./widgets";
import { CenterTray, type TrayItem } from "./viewport";
import { setWorkspaceChrome, useWorkspaceChrome } from "../WorkspaceChromePreferences";

// MARK: - Shared shell state

export interface RibbonSettings {
  density: ToolDensity; popupStyle: ToolPopupStyle; activeCategory: string;
  /** "sidebar" = the monochrome ToolSidebar; "ribbon" = the tinted legacy ToolRibbon the July-19 "Rex" build used. */
  toolbar: "sidebar" | "ribbon";
  /** The bottom-centre CenterTray the Rex build put in every workspace. */
  centerTray: boolean;
}

export interface ViewPrefs {
  viewPreset: string; displayMode: "wireframe" | "hiddenLine" | "shaded"; showHiddenEdges: boolean;
  navMode: "select" | "pan" | "orbit" | "measure"; panSpeed: number; invertPan: boolean; orbitSensitivity: number; turntable: boolean; measureUnits: string; snapToGeometry: boolean;
  showGrid: boolean; showOrigin: boolean; showViewCube: boolean; groundShadow: boolean; keyLight: number;
  themeName: string; showEdges: boolean; keepImportedColors: boolean; opacity: number;
}

export const defaultViewPrefs = (): ViewPrefs => ({
  viewPreset: "Standard", displayMode: "shaded", showHiddenEdges: true, navMode: "select", panSpeed: 1, invertPan: false, orbitSensitivity: 1, turntable: true,
  measureUnits: "mm", snapToGeometry: true, showGrid: true, showOrigin: true, showViewCube: true, groundShadow: true, keyLight: 1,
  themeName: "Studio Blue", showEdges: true, keepImportedColors: true, opacity: 1,
});

export const VIEW_TABS = [
  { id: "View", icon: "cube" }, { id: "Environment", icon: "appearance-light" }, { id: "Appearance", icon: "palette" }, { id: "Inspector", icon: "sliders" },
] as const;

/** A workspace the Expanded tool sidebar can switch between, boxed at its left like the glass WorkspaceRibbon's column. */
export interface ShellWorkspace { id: string; name: string; icon?: string }

export interface KitShell {
  /** The app's workspaces, for the Expanded sidebar's dropdown; a sidebar may override them with props. */
  workspaces?: readonly ShellWorkspace[];
  workspaceID?: string;
  onWorkspaceSelect?: (id: string) => void;
  layout: LayoutFlags;
  setLayout: (f: LayoutFlags | ((f: LayoutFlags) => LayoutFlags)) => void;
  armed: ArmedTool | null;
  arm: (tool: RibbonTool, group: RibbonGroup) => void;
  disarm: () => void;
  /** Call after a tool commits; honours `repeats`. */
  committed: () => void;
  repeats: boolean;
  /** A workspace claims immediate-action tools here; returning true means "handled, don't arm". */
  actionHandler: MutableRefObject<((tool: RibbonTool) => boolean) | null>;
  ribbon: RibbonSettings;
  setRibbon: (r: RibbonSettings | ((r: RibbonSettings) => RibbonSettings)) => void;
  viewPanels: PanelStack;
  viewPanelActions: PanelStackActions;
  view: ViewPrefs;
  setView: (v: ViewPrefs | ((v: ViewPrefs) => ViewPrefs)) => void;
}

const ShellContext = createContext<KitShell | null>(null);
export const useKitShell = () => {
  const shell = useContext(ShellContext);
  if (!shell) throw new Error("useKitShell needs an <KitShellProvider>");
  return shell;
};

export function KitShellProvider({ layout, setLayout, initialRibbon, workspaces, workspaceID, onWorkspaceSelect, children }: {
  layout: LayoutFlags; setLayout: KitShell["setLayout"]; /** Starting toolbar settings — a gallery shows the three densities side by side. */ initialRibbon?: Partial<RibbonSettings>;
  workspaces?: readonly ShellWorkspace[]; workspaceID?: string; onWorkspaceSelect?: (id: string) => void; children: ReactNode;
}) {
  const [armed, setArmed] = useState<ArmedTool | null>(null);
  const actionHandler = useRef<((tool: RibbonTool) => boolean) | null>(null);
  const [localRibbon, setLocalRibbon] = useState<RibbonSettings>({ density: "standard", popupStyle: "list", activeCategory: "", toolbar: "sidebar", centerTray: false, ...initialRibbon });
  const chrome = useWorkspaceChrome();
  const ribbon: RibbonSettings = { ...localRibbon,
    density: chrome.toolbarDensity === "app" ? localRibbon.density : chrome.toolbarDensity,
    popupStyle: chrome.toolPopup === "app" ? localRibbon.popupStyle : chrome.toolPopup,
  };
  const ribbonRef = useRef(ribbon);
  ribbonRef.current = ribbon;
  const setRibbon: KitShell["setRibbon"] = update => {
    const previous = ribbonRef.current;
    const next = typeof update === "function" ? update(previous) : update;
    if (chrome.toolbarDensity !== "app" && next.density !== previous.density) setWorkspaceChrome({ toolbarDensity: next.density });
    if (chrome.toolPopup !== "app" && next.popupStyle !== previous.popupStyle) setWorkspaceChrome({ toolPopup: next.popupStyle });
    ribbonRef.current = next;
    setLocalRibbon(next);
  };
  const [viewPanels, viewPanelActions] = usePanelStack(() => panelStack(VIEW_TABS.map((t) => t.id), [], "right"));
  const [view, setView] = useState(defaultViewPrefs);
  const repeats = true;
  const shell: KitShell = {
    layout, setLayout, armed, repeats, actionHandler, ribbon, setRibbon, viewPanels, viewPanelActions, view, setView, workspaces, workspaceID, onWorkspaceSelect,
    arm: (tool, group) => { if (actionHandler.current?.(tool)) return; setArmed({ tool, groupName: group.name, tint: group.tint }); },
    disarm: () => setArmed(null),
    committed: () => { if (!repeats) setArmed(null); },
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setArmed(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return <ShellContext.Provider value={shell}>{children}</ShellContext.Provider>;
}

// MARK: - Sidebar chrome

/** Floating → a translucent pill; docked → a flat panel meeting its neighbours edge to edge. */
export const chromeClass = (docked: boolean) => (docked ? "aui-kit-chrome aui-kit-chrome-docked" : "aui-kit-chrome aui-kit-chrome-floating");

export interface SidebarTab { id: string; icon: string }

/** The icon rail. Every tab toggles its own panel. */
export function StackRail({ tabs, state, actions, docked = false }: { tabs: readonly SidebarTab[]; state: PanelStack; actions: PanelStackActions; docked?: boolean }) {
  return (
    <nav className={`aui-kit-rail ${chromeClass(docked)}`} data-docked={docked || undefined} aria-label={`${state.side === "left" ? "Workspace" : "View"} sidebar`}>
      {tabs.map((tab) => (
        <button key={tab.id} type="button" className="aui-kit-rail-btn" data-active={isEnabled(state, tab.id) || undefined} aria-pressed={isEnabled(state, tab.id)} aria-label={tab.id} title={tab.id} onClick={() => actions.toggle(tab.id)}>
          <Sym name={tab.icon} size={15} weight="medium" />
        </button>
      ))}
    </nav>
  );
}

/** One panel card: a header (the drag handle) over caller-supplied content. */
export function StackCard({ id, title, icon, onClose, docked = false, floating = false, width = 200, lifted = false, dragProps, style, children }: {
  id: string; title: string; icon: string; onClose: () => void; docked?: boolean; floating?: boolean; width?: number; lifted?: boolean;
  dragProps?: React.HTMLAttributes<HTMLDivElement>; style?: CSSProperties; children: ReactNode;
}) {
  return (
    <section className={`aui-kit-card ${chromeClass(docked && !floating)}`} data-lifted={lifted || undefined} data-floating={floating || undefined} aria-label={title} data-panel={id}
      style={{ width: docked && !floating ? undefined : width, ...style }}>
      <header className="aui-kit-card-head" {...dragProps}>
        <Sym name={icon} size={11} className="aui-kit-t3" /><span>{title}</span><span className="aui-kit-spacer" />
        <button type="button" className="aui-kit-plain aui-kit-t3" aria-label={`Hide ${title}`} title={`Hide ${title}`} onClick={onClose}><Sym name="close" size={9} weight="bold" /></button>
      </header>
      <div className="aui-kit-divider" />
      <div className="aui-kit-card-body" data-scroll={!(docked && !floating) || undefined}>{children}</div>
    </section>
  );
}

/**
 * A full side sidebar: the rail plus the stack of open panels. Header drag on a
 * stacked panel: mostly vertical → reorder (drop line), pulled sideways → tears
 * off to float where it is dropped. Floating cards are drawn by the scaffold.
 */
export function PanelSidebar({ tabs, state, actions, docked = false, outer = false, content }: {
  tabs: readonly SidebarTab[]; state: PanelStack; actions: PanelStackActions; docked?: boolean; outer?: boolean; content: (id: string) => ReactNode;
}) {
  const cardWidth = state.side === "left" ? 232 : 200;
  const stackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; dropIndex: number | null; willFloat: boolean } | null>(null);

  const startDrag = (id: string) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (docked || e.button !== 0) return;
    const startX = e.clientX, startY = e.clientY;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      const sideways = Math.abs(dx);
      const willFloat = sideways > cardWidth * 0.5 || (sideways > 6 && sideways > Math.abs(dy) * 1.5);
      let dropIndex: number | null = null;
      if (!willFloat && stackRef.current) {
        const others = Array.from(stackRef.current.querySelectorAll<HTMLElement>("[data-panel]")).filter((el) => el.dataset.panel !== id);
        dropIndex = others.reduce((acc, el) => { const box = el.getBoundingClientRect(); return acc + (ev.clientY > box.top + box.height / 2 ? 1 : 0); }, 0);
      }
      setDrag({ id, dx, dy, dropIndex, willFloat });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      setDrag((d) => {
        if (d && Math.hypot(d.dx, d.dy) > 4) {
          if (d.willFloat) actions.detach(id, { x: ev.clientX - startX, y: ev.clientY - startY });
          else if (d.dropIndex !== null) actions.reorder(id, d.dropIndex);
        }
        return null;
      });
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  const stacked = stackedPanels(state);
  const dropLine = <span className="aui-kit-drop-line" style={{ width: cardWidth - 16 }} />;
  const stack = (
    <div ref={stackRef} className="aui-kit-stack" data-docked={docked || undefined} style={{ width: cardWidth }}>
      {stacked.map((id, index) => {
        const tab = tabs.find((t) => t.id === id);
        const lifted = drag?.id === id;
        return (
          <span key={id} style={{ display: "contents" }}>
            {!docked && drag && !drag.willFloat && drag.dropIndex === index && dropLine}
            {docked && index > 0 && <span className="aui-kit-divider" />}
            <StackCard id={id} title={id} icon={tab?.icon ?? "square-dashed"} docked={docked} width={cardWidth} lifted={lifted}
              onClose={() => actions.toggle(id)} dragProps={docked ? undefined : { onPointerDown: startDrag(id), style: { cursor: "grab" } }}
              style={lifted ? { transform: `translate(${drag.dx}px, ${drag.dy}px)`, zIndex: 1, opacity: drag.willFloat ? 0.9 : 1 } : undefined}>
              {content(id)}
            </StackCard>
          </span>
        );
      })}
      {!docked && drag && !drag.willFloat && drag.dropIndex === stacked.length && dropLine}
    </div>
  );

  if (docked) {
    const rail = <StackRail tabs={tabs} state={state} actions={actions} docked />;
    const railFirst = (state.side === "left") !== outer;
    return (
      <div className="aui-kit-sidebar-docked">
        {railFirst && rail}
        {isOpen(state) && (<><span className="aui-kit-vdivider" style={{ height: "auto" }} /><div className="aui-kit-stack-scroll">{stack}</div></>)}
        {!railFirst && (<>{isOpen(state) && <span className="aui-kit-vdivider" style={{ height: "auto" }} />}{rail}</>)}
      </div>
    );
  }
  return (
    <div className="aui-kit-sidebar-floating" data-side={state.side} data-outer={outer || undefined}>
      <StackRail tabs={tabs} state={state} actions={actions} />
      {isOpen(state) && stack}
    </div>
  );
}

// MARK: - Tool sidebar

const ToolListRow = ({ tool, active, tint, onPick, glyph }: { tool: RibbonTool; active: boolean; tint: string; onPick: () => void; glyph?: ReactNode }) => (
  <button type="button" role={tool.selected === undefined ? "menuitem" : "menuitemradio"} aria-checked={tool.selected} disabled={tool.disabled} title={tool.title} className="aui-kit-tool-list-row" data-active={active || undefined} style={tintStyle(tint)} onClick={onPick}>
    {glyph ?? <ToolGlyph name={tool.icon} size={13} className={active ? "aui-kit-tinted" : "aui-kit-t2"} />}<span>{tool.label}</span><span className="aui-kit-spacer" />
    {(tool.selected ?? active) && <Sym name="check" size={10} weight="bold" className="aui-kit-tinted" />}
  </button>
);

/** Arrow navigation is shared by list, grid, variant and settings popovers. */
function toolMenuKey(event: React.KeyboardEvent<HTMLDivElement>) {
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)'));
  if (!items.length) return;
  const index = items.indexOf(document.activeElement as HTMLButtonElement);
  const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
    : event.key === "ArrowDown" || event.key === "ArrowRight" ? (index + 1) % items.length
    : event.key === "ArrowUp" || event.key === "ArrowLeft" ? (index - 1 + items.length) % items.length : -1;
  if (next < 0) return;
  event.preventDefault(); event.stopPropagation(); items[next].focus();
}

/** The top sidebar, driven by a per-workspace catalog. */
export function ToolSidebar({ groups = [], categories = [], armGroup, docked = false, workspaces, workspaceID, onWorkspaceSelect, onCommand, renderIcon, activeCategory: controlledCategory, onCategoryChange }: {
  groups?: readonly ToolGroup[]; categories?: readonly ToolCategory[]; armGroup: RibbonGroup; docked?: boolean;
  /** Products own command behavior and state; omitted preserves the demo's armed-tool behavior. */
  onCommand?: (id: string) => void;
  renderIcon?: (tool: RibbonTool, size: number) => ReactNode;
  activeCategory?: string;
  onCategoryChange?: (category: string) => void;
  /** Expanded density's workspace dropdown; defaults to the shell's. */ workspaces?: readonly ShellWorkspace[]; workspaceID?: string; onWorkspaceSelect?: (id: string) => void;
}) {
  const shell = useKitShell();
  const { ribbon, setRibbon, armed } = shell;
  const density: ToolDensity = ribbon.density;
  const hasCategories = categories.length > 0;
  const activeCategory = categories.find((c) => c.name === (controlledCategory ?? ribbon.activeCategory)) ?? categories[0];
  const activeGroups = activeCategory?.groups ?? groups;
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [showOverflow, setShowOverflow] = useState(false);
  const closeGroup = useCallback(() => setOpenGroup(null), []);
  const closeSettings = useCallback(() => setShowOverflow(false), []);
  const anchors = useRef<Record<string, HTMLButtonElement | null>>({});
  const settingsAnchor = useRef<HTMLButtonElement>(null);
  const arm = (tool: RibbonTool) => { if (tool.disabled) return; if (onCommand) onCommand(tool.id); else shell.arm(tool, armGroup); setOpenGroup(null); setShowOverflow(false); };
  const isActive = (tool: RibbonTool) => tool.active ?? (!onCommand && armed?.tool.id === tool.id);
  const glyph = (tool: RibbonTool, size: number) => renderIcon?.(tool, size) ?? <ToolGlyph name={tool.icon} size={size} />;
  const withVariants = (tools: RibbonTool[]) => tools.flatMap(t => t.variants?.length ? [...t.variants] : [t]);
  const scrollTools = (event: React.WheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    const el = event.currentTarget, before = el.scrollLeft;
    el.scrollLeft += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientWidth : 1);
    if (before !== el.scrollLeft) event.preventDefault();
  };

  // A group's dropdown: its inline tools, then its "more" tools under MORE — every tool of the section is found in the section.
  const popover = (g: ToolGroup) => (
    <Popover open={openGroup === g.id} anchor={anchors.current[g.id]} onClose={closeGroup} focus="first" ariaLabel={g.name} placement="bottom-start" className="aui-kit-popover">
      <div className="aui-kit-tool-popover" role="menu" onKeyDown={toolMenuKey}>
        <Caption style={{ padding: "8px 10px 2px" }}>{g.name.toUpperCase()}</Caption>
        {popoverTools(g)}
      </div>
    </Popover>
  );
  const popoverTools = (g: ToolGroup) => (
    <>
      {popoverList(withVariants(primaryTools(g)))}
      {overflowTools(g).length > 0 && (<><Divider style={{ margin: "4px 0" }} /><Caption style={{ padding: "2px 10px 2px" }}>MORE</Caption>{popoverList(withVariants(overflowTools(g)))}</>)}
    </>
  );
  const popoverList = (tools: RibbonTool[]) => (
    <>
        {ribbon.popupStyle === "grid" ? (
          <div className="aui-kit-tool-grid">{tools.map((t) => (
            <button key={t.id} type="button" role={t.selected === undefined ? "menuitem" : "menuitemradio"} aria-checked={t.selected} disabled={t.disabled} aria-label={t.label} className="aui-kit-tool-grid-btn" data-active={(t.selected ?? isActive(t)) || undefined} title={t.label} style={tintStyle(armGroup.tint)} onClick={() => arm(t)}>{glyph(t, 16)}</button>))}</div>
        ) : tools.map((t) => <ToolListRow key={t.id} tool={t} active={isActive(t)} tint={AD.accent} glyph={glyph(t, 13)} onPick={() => arm(t)} />)}
    </>
  );

  const button = (t: RibbonTool) => {
    const compact = density === "compact";
    const primary = (
      <button type="button" className="aui-kit-tool-btn" disabled={t.disabled} data-compact={compact || undefined} data-active={isActive(t) || undefined} aria-label={t.label} aria-pressed={isActive(t)} title={t.title ?? t.label} onClick={() => arm(t)}>
        {glyph(t, compact ? 15 : 17)}{!compact && <span>{t.label}</span>}
      </button>
    );
    if (!t.variants?.length) return <span key={t.id} className="aui-kit-tool-slot">{primary}</span>;
    const key = `variants:${t.id}`, label = `${t.variants.map(v => v.label).join("/")} variants`;
    return <span key={t.id} className="aui-kit-tool-variants">
      {primary}
      <button type="button" ref={el => { anchors.current[key] = el; }} className="aui-kit-tool-variant-toggle" aria-label={label} aria-haspopup="menu" aria-expanded={openGroup === key} onClick={() => setOpenGroup(openGroup === key ? null : key)}><Sym name="chevron-down" size={8} /></button>
      <Popover open={openGroup === key} anchor={anchors.current[key]?.parentElement ?? anchors.current[key]} onClose={closeGroup} focus="first" ariaLabel={label} placement="bottom-start" className="aui-kit-popover">
        <div className="aui-kit-tool-popover" role="menu" onKeyDown={toolMenuKey}>{popoverList([...t.variants])}</div>
      </Popover>
    </span>;
  };

  const settingsMenu = (
    <>
      <button ref={settingsAnchor} type="button" className="aui-kit-tool-more" data-compact={density === "compact" || undefined} aria-label="More tools and toolbar settings" title="More" aria-haspopup="menu" aria-expanded={showOverflow} onClick={() => setShowOverflow((v) => !v)}>
        <Sym name="more" size={14} weight="medium" />
      </button>
      <Popover open={showOverflow} anchor={settingsAnchor.current} onClose={closeSettings} focus="first" ariaLabel="Toolbar settings" placement="bottom-end" className="aui-kit-popover">
        <div className="aui-kit-tool-popover" style={{ width: 232 }} role="menu" onKeyDown={toolMenuKey}>
          <Caption style={{ padding: "5px 10px 0" }}>DENSITY</Caption>
          {TOOL_DENSITIES.map((d) => (
            <button key={d.id} type="button" role="menuitemradio" aria-checked={ribbon.density === d.id} className="aui-kit-tool-list-row aui-kit-density-row" data-active={ribbon.density === d.id || undefined} onClick={() => { setRibbon({ ...ribbon, density: d.id }); setShowOverflow(false); }}>
              <Sym name={d.icon} size={12} className={ribbon.density === d.id ? "aui-kit-tinted" : "aui-kit-t3"} style={{ width: 20 }} />
              <span className="aui-kit-stack-1"><span>{d.label}</span><small>{d.detail}</small></span><span className="aui-kit-spacer" />
              {ribbon.density === d.id && <Sym name="check" size={10} weight="bold" className="aui-kit-tinted" />}
            </button>))}
        </div>
      </Popover>
    </>
  );

  // Each group's heading is a dropdown of the group's tools (the compact popover's list), as on the WorkspaceRibbon.
  const expandedGroup = (g: ToolGroup) => (
    <div key={g.id} className="aui-kit-tool-group-expanded">
      <div className="aui-kit-hstack-2">{primaryTools(g).map(button)}</div>
      <button ref={(el) => { anchors.current[g.id] = el; }} type="button" className="aui-kit-tool-group-caption" aria-label={`${g.name} tools`} title={`${g.name} tools`} aria-haspopup="menu" aria-expanded={openGroup === g.id} onClick={() => setOpenGroup(openGroup === g.id ? null : g.id)}>
        {g.name}<Sym name="chevron-down" size={8} weight="semibold" />
      </button>
      {popover(g)}
    </div>
  );
  // Expanded density leads with the workspace, boxed like the glass WorkspaceRibbon's column (Jonathan, 2026-09-24).
  const workspaceList = workspaces ?? shell.workspaces;
  const currentWorkspace = workspaceList?.find((w) => w.id === (workspaceID ?? shell.workspaceID)) ?? workspaceList?.[0];
  const selectWorkspace = onWorkspaceSelect ?? shell.onWorkspaceSelect;
  const workspaceBox = density === "expanded" && workspaceList?.length && currentWorkspace ? (
    <MenuButton className="aui-kit-tool-workspace" label={`Workspace: ${currentWorkspace.name}`} placement="bottom-start"
      items={workspaceList.map((w) => ({ id: w.id, label: w.name, icon: w.icon ? <Sym name={w.icon} size={14} /> : undefined, kind: "radio" as const, checked: w.id === currentWorkspace.id }))}
      onSelect={(id) => selectWorkspace?.(id)}>
      <Sym name={currentWorkspace.icon ?? "cube-transparent"} size={20} weight="medium" />
      <span className="aui-kit-tool-workspace-name">{currentWorkspace.name}</span>
      <Sym name="chevron-down" size={9} weight="semibold" />
    </MenuButton>
  ) : null;

  const chrome = `aui-kit-tool-sidebar ${chromeClass(docked)}`;
  const label = "Tools";

  const selectCategory = (name: string) => {
    if (onCategoryChange) onCategoryChange(name);
    else setRibbon({ ...ribbon, activeCategory: name });
  };
  const categoryKey = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === "Home" ? 0 : event.key === "End" ? categories.length - 1
      : event.key === "ArrowRight" ? (index + 1) % categories.length
      : event.key === "ArrowLeft" ? (index - 1 + categories.length) % categories.length : -1;
    if (next < 0) return;
    event.preventDefault();
    selectCategory(categories[next].name);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  // The catalogue's category tabs, above the tools at every density (Jonathan, 2026-09-24: Compact keeps them too).
  const categoryTabs = (
        <div className="aui-kit-category-tabs" role="tablist">
          {categories.map((c, index) => (
            <button key={c.name} type="button" role="tab" tabIndex={activeCategory?.name === c.name ? 0 : -1} onKeyDown={event => categoryKey(event, index)} aria-selected={activeCategory?.name === c.name} className="aui-kit-category-tab" data-active={activeCategory?.name === c.name || undefined} onClick={() => selectCategory(c.name)}>{c.name}</button>))}
          {docked && <span className="aui-kit-spacer" />}
        </div>
  );

  if (density === "compact") {
    const icons = (
      <>
        {activeGroups.map((g) => {
          const open = openGroup === g.id, active = g.tools.some(isActive);
          return (
            <span key={g.id} style={{ display: "contents" }}>
              <button ref={(el) => { anchors.current[g.id] = el; }} type="button" className="aui-kit-tool-category" data-active={(open || active) || undefined} aria-label={g.name} title={g.name} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpenGroup(open ? null : g.id)}>
                {renderIcon && g.tools[0] ? glyph(g.tools[0], 16) : <Sym name={categoryIcon(g)} size={16} weight="medium" />}
              </button>
              {popover(g)}
            </span>
          );
        })}
        <span className="aui-kit-vdivider" style={{ height: 30 }} />{settingsMenu}
      </>
    );
    if (hasCategories) {
      return (
        <div className={`${chrome} aui-kit-category-ribbon`} data-density="compact" data-docked={docked || undefined} role="toolbar" data-toolbar-menu-boundary="" aria-label={label}>
          {categoryTabs}
          <div className="aui-kit-category-tools" role="tabpanel" aria-label={`${activeCategory?.name} tools`} onWheel={scrollTools} data-compact="">{icons}{docked && <span className="aui-kit-spacer" />}</div>
        </div>
      );
    }
    return (
      <div className={chrome} data-density="compact" data-docked={docked || undefined} role="toolbar" data-toolbar-menu-boundary="" aria-label={label}>{icons}</div>
    );
  }
  // Standard and Expanded share the grouped layout — labelled tools under their group's heading, the
  // catalogue's category tabs above when it has them. Expanded adds the workspace box at the left.
  if (hasCategories) {
    return (
      <div className={`${chrome} aui-kit-category-ribbon`} data-density={density} data-docked={docked || undefined} data-workspace={workspaceBox ? "" : undefined} role="toolbar" data-toolbar-menu-boundary="" aria-label={label}>
        {workspaceBox}
        {categoryTabs}
        <div className="aui-kit-category-tools" role="tabpanel" aria-label={`${activeCategory?.name} tools`} onWheel={scrollTools}>
          {activeGroups.map((g, i) => (<span key={g.id} style={{ display: "contents" }}>{expandedGroup(g)}{i < activeGroups.length - 1 && <span className="aui-kit-vdivider" style={{ height: 46 }} />}</span>))}
          {docked && <span className="aui-kit-spacer" />}{settingsMenu}
        </div>
      </div>
    );
  }
  return (
    <div className={chrome} data-density={density} data-docked={docked || undefined} data-workspace={workspaceBox ? "" : undefined} role="toolbar" data-toolbar-menu-boundary="" aria-label={label}>
      {workspaceBox}{workspaceBox && <span className="aui-kit-vdivider" style={{ height: 46 }} />}
      {activeGroups.map((g, i) => (<span key={g.id} style={{ display: "contents" }}>{expandedGroup(g)}{i < activeGroups.length - 1 && <span className="aui-kit-vdivider" style={{ height: 46 }} />}</span>))}
      <span className="aui-kit-vdivider" style={{ height: 46 }} />{settingsMenu}
    </div>
  );
}

/** ToolRibbon.swift — the modular tool toolbar: floating pill of tinted category icons, or the docked legacy ribbon. */
export function ToolRibbon({ groups, docked }: { groups: readonly RibbonGroup[]; docked?: boolean }) {
  const shell = useKitShell();
  const isDocked = docked ?? shell.layout.ribbonDocked;
  const [openName, setOpenName] = useState<string | null>(null);
  const anchors = useRef<Record<string, HTMLButtonElement | null>>({});
  const activeID = shell.armed?.tool.id;
  if (isDocked) {
    return (
      <div className="aui-kit-tool-ribbon-docked" role="toolbar" aria-label="Tools">
        {groups.map((g, i) => (
          <span key={g.name} style={{ display: "contents" }}>
            <div className="aui-kit-tool-ribbon-group">
              <div className="aui-kit-hstack-4">{g.tools.map((t) => (
                <button key={t.id} type="button" className="aui-kit-tool-btn aui-kit-tool-btn-docked" data-active={activeID === t.id || undefined} style={tintStyle(g.tint)} onClick={() => shell.arm(t, g)}><ToolGlyph name={t.icon} size={19} className="aui-kit-tinted" /><span>{t.label}</span></button>))}</div>
              <span className="aui-kit-caption" style={{ paddingLeft: 6 }}>{g.name.toUpperCase()}</span>
            </div>
            {i < groups.length - 1 && <span className="aui-kit-vdivider" style={{ height: 58 }} />}
          </span>))}
      </div>
    );
  }
  return (
    <div className="aui-kit-tool-ribbon" role="toolbar" aria-label="Tools">
      {groups.map((g) => (
        <span key={g.name} style={{ display: "contents" }}>
          <button ref={(el) => { anchors.current[g.name] = el; }} type="button" className="aui-kit-tool-category aui-kit-tool-category-tinted" data-active={openName === g.name || undefined} style={tintStyle(g.tint)} aria-label={g.name} title={g.name} aria-haspopup="menu" aria-expanded={openName === g.name} onClick={() => setOpenName(openName === g.name ? null : g.name)}>
            <ToolGlyph name={g.icon} size={16} weight="medium" />
          </button>
          <Popover open={openName === g.name} anchor={anchors.current[g.name]} onClose={() => setOpenName(null)} ariaLabel={g.name} placement="bottom-start" className="aui-kit-popover">
            <div className="aui-kit-tool-popover" role="menu">
              <Caption style={{ padding: "9px 10px 0" }}>{g.name.toUpperCase()}</Caption>
              {shell.ribbon.popupStyle === "grid"
                ? <div className="aui-kit-tool-grid">{g.tools.map((t) => <button key={t.id} type="button" role="menuitem" className="aui-kit-tool-grid-btn" data-active={activeID === t.id || undefined} style={tintStyle(g.tint)} title={t.label} onClick={() => { shell.arm(t, g); setOpenName(null); }}><ToolGlyph name={t.icon} size={16} weight="medium" /></button>)}</div>
                : g.tools.map((t) => <ToolListRow key={t.id} tool={t} active={activeID === t.id} tint={g.tint} onPick={() => { shell.arm(t, g); setOpenName(null); }} />)}
            </div>
          </Popover>
        </span>))}
    </div>
  );
}

/** The armed-tool banner, shared by every workspace's scaffold. */
export function PromptBar() {
  const shell = useKitShell();
  if (!shell.armed) return null;
  return (
    <div className="aui-kit-prompt-bar" role="status" style={tintStyle(shell.armed.tint)}>
      <span className="aui-kit-prompt-icon"><Sym name={shell.armed.tool.icon} size={12} weight="semibold" /></span>
      <span>{toolPrompt(shell.armed)}</span>
      <button type="button" className="aui-kit-plain aui-kit-t3" aria-label="Cancel tool" onClick={shell.disarm}><Sym name="close" size={9} weight="bold" /></button>
    </div>
  );
}

// MARK: - View sidebar content

const VIEW_PRESETS = ["Standard", "Isometric", "Front", "Top", "Right"];
const DISPLAY_MODES = [{ id: "wireframe", label: "Wireframe", icon: "cube-transparent" }, { id: "hiddenLine", label: "Hidden line", icon: "cube" }, { id: "shaded", label: "Shaded", icon: "cube-filled" }] as const;
const NAV_MODES = [{ id: "select", label: "Select", icon: "cursor" }, { id: "pan", label: "Pan", icon: "hand" }, { id: "orbit", label: "Orbit", icon: "refresh" }, { id: "measure", label: "Measure", icon: "ruler" }] as const;

const PrefSlider = ({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) => (
  <div className="aui-kit-stack-3"><div className="aui-kit-between"><span className="aui-kit-pref-label">{label}</span><span className="aui-kit-t3 aui-kit-s10">{value.toFixed(2)}×</span></div><Range value={value} min={min} max={max} onChange={onChange} ariaLabel={label} /></div>
);

/** The body of one view-sidebar panel. Inspector is caller-supplied; the rest are presentation settings. */
export function ViewTabContent({ tab, inspector }: { tab: string; inspector: ReactNode }) {
  const { view, setView, disarm } = useKitShell();
  const set = (patch: Partial<ViewPrefs>) => setView((v) => ({ ...v, ...patch }));
  if (tab === "Inspector") return <div className="aui-kit-stack-10">{inspector}</div>;
  if (tab === "Environment") {
    return (
      <div className="aui-kit-stack-10">
        <span className="aui-kit-pref-label">Scene</span>
        <ToggleLine label="Grid" isOn={view.showGrid} onChange={(showGrid) => set({ showGrid })} />
        <ToggleLine label="Origin" isOn={view.showOrigin} onChange={(showOrigin) => set({ showOrigin })} />
        <ToggleLine label="View cube" isOn={view.showViewCube} onChange={(showViewCube) => set({ showViewCube })} />
        <ToggleLine label="Ground shadow" isOn={view.groundShadow} onChange={(groundShadow) => set({ groundShadow })} />
        <PrefSlider label="Key light" value={view.keyLight} min={0} max={2} onChange={(keyLight) => set({ keyLight })} />
      </div>
    );
  }
  if (tab === "Appearance") {
    return (
      <div className="aui-kit-stack-10">
        <span className="aui-kit-pref-label">Theme</span>
        <MenuButton className="aui-kit-menu-btn" label="Theme" items={["Studio Blue", "Graphite", "Blueprint", "High Contrast"].map((t) => ({ id: t, label: t, kind: "radio" as const, checked: view.themeName === t }))} onSelect={(themeName) => set({ themeName })}>{view.themeName}<Sym name="chevron-down" size={8} /></MenuButton>
        <ToggleLine label="Show edges" isOn={view.showEdges} onChange={(showEdges) => set({ showEdges })} />
        <ToggleLine label="Keep imported colors" isOn={view.keepImportedColors} onChange={(keepImportedColors) => set({ keepImportedColors })} />
        <PrefSlider label="Opacity" value={view.opacity} min={0.2} max={1} onChange={(opacity) => set({ opacity })} />
      </div>
    );
  }
  return (
    <div className="aui-kit-stack-10">
      <MenuButton className="aui-kit-menu-btn" label="View preset" items={VIEW_PRESETS.map((p) => ({ id: p, label: p, kind: "radio" as const, checked: view.viewPreset === p }))} onSelect={(viewPreset) => set({ viewPreset })}>{view.viewPreset}<Sym name="chevron-down" size={8} /></MenuButton>
      <span className="aui-kit-pref-label">Display</span>
      <div className="aui-kit-mode-group" role="radiogroup" aria-label="Display mode">
        {DISPLAY_MODES.map((m) => <button key={m.id} type="button" role="radio" aria-checked={view.displayMode === m.id} title={m.label} className="aui-kit-mode-btn" style={{ width: 38, height: 32 }} data-active={view.displayMode === m.id || undefined} onClick={() => set({ displayMode: m.id })}><Sym name={m.icon} size={15} weight="light" /></button>)}
      </div>
      <ToggleLine label="Show hidden edges" isOn={view.showHiddenEdges} onChange={(showHiddenEdges) => set({ showHiddenEdges })} />
      <Divider />
      <span className="aui-kit-pref-label">Navigation</span>
      <div className="aui-kit-mode-group" role="radiogroup" aria-label="Camera navigation">
        {NAV_MODES.map((m) => <button key={m.id} type="button" role="radio" aria-checked={view.navMode === m.id} title={`${m.label} (camera)`} className="aui-kit-mode-btn" style={{ width: 34, height: 28 }} data-active={view.navMode === m.id || undefined} onClick={() => { set({ navMode: m.id }); disarm(); }}><Sym name={m.icon} size={13} weight="medium" /></button>)}
      </div>
      {view.navMode === "pan" && (<><PrefSlider label="Speed" value={view.panSpeed} min={0.25} max={3} onChange={(panSpeed) => set({ panSpeed })} /><ToggleLine label="Invert direction" isOn={view.invertPan} onChange={(invertPan) => set({ invertPan })} /></>)}
      {view.navMode === "orbit" && (<><PrefSlider label="Sensitivity" value={view.orbitSensitivity} min={0.25} max={3} onChange={(orbitSensitivity) => set({ orbitSensitivity })} /><ToggleLine label="Turntable" isOn={view.turntable} onChange={(turntable) => set({ turntable })} /></>)}
      {view.navMode === "measure" && (<><Segmented options={["mm", "cm", "in"].map((u) => ({ id: u, label: u }))} value={view.measureUnits} onChange={(measureUnits) => set({ measureUnits })} ariaLabel="Units" /><ToggleLine label="Snap to geometry" isOn={view.snapToGeometry} onChange={(snapToGeometry) => set({ snapToGeometry })} /></>)}
    </div>
  );
}

// MARK: - Scaffold

export interface ContentInsets { top: number; left: number; bottom: number; right: number }
export const ContentInsetsContext = createContext<ContentInsets>({ top: 16, left: 16, bottom: 16, right: 16 });
export const useContentInsets = () => useContext(ContentInsetsContext);

export interface WorkspaceScaffoldProps {
  toolGroups?: readonly ToolGroup[];
  toolCategories?: readonly ToolCategory[];
  toolArmGroup: RibbonGroup;
  leftTabs: readonly SidebarTab[];
  leftPanels: PanelStack;
  leftActions: PanelStackActions;
  /** Optional center-view modes (3D · Gallery · Table …) shown in a bottom pill. */
  centerTabs?: readonly SidebarTab[];
  centerSelection?: string;
  onCenterSelect?: (id: string) => void;
  center: ReactNode;
  left: (id: string) => ReactNode;
  inspector: ReactNode;
  /** The workspace's CenterTray items; shown when `ribbon.centerTray` is on. */
  tray?: readonly TrayItem[];
}

/** Canvas-mode edge reveal: hidden behind a thin hot-zone until hovered. */
function EdgeReveal({ edge, canvas, children }: { edge: "top" | "left" | "right"; canvas: boolean; children: ReactNode }) {
  const [shown, setShown] = useState(false);
  if (!canvas) return <>{children}</>;
  return (
    <div className="aui-kit-edge-reveal" data-edge={edge} data-shown={shown || undefined} onMouseEnter={() => setShown(true)} onMouseLeave={() => setShown(false)}>
      {shown ? children : <span className="aui-kit-edge-handle" aria-hidden />}
    </div>
  );
}

const FLOAT = { left: 72, right: 72, top: 56, bottom: 24, minH: 140 };

/** The whole workspace frame: tool sidebar on top, workspace sidebar left, view sidebar right, center between. */
export function WorkspaceScaffold({ toolGroups = [], toolCategories = [], toolArmGroup, leftTabs, leftPanels, leftActions, centerTabs = [], centerSelection, onCenterSelect, center, left, inspector, tray }: WorkspaceScaffoldProps) {
  const shell = useKitShell();
  const { layout, viewPanels, viewPanelActions } = shell;
  const isCanvas = detectPreset(layout) === "canvas";
  const hasCenterTabs = centerTabs.length > 0;
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1200, height: 800 });
  useLayoutEffect(() => {
    const el = hostRef.current; if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const bottom = hasCenterTabs ? 74 : 16;
  const insets: ContentInsets = layout.ribbonDocked
    ? { top: 10, left: 10, bottom, right: 10 }
    : { top: 74, left: 72 + (isOpen(leftPanels) ? 242 : 0), bottom: 12 + bottom, right: 72 + (isOpen(viewPanels) ? 210 : 0) };

  const floatBase = (side: "left" | "right", cardW: number) => (side === "left" ? { x: 64, y: 60 } : { x: size.width - 64 - cardW, y: 60 });
  const clamp = (off: Offset, side: "left" | "right", cardW: number): Offset => {
    const base = floatBase(side, cardW);
    const minX = FLOAT.left - base.x, maxX = size.width - FLOAT.right - cardW - base.x;
    const minY = FLOAT.top - base.y, maxY = size.height - FLOAT.bottom - FLOAT.minH - base.y;
    return { x: Math.min(Math.max(off.x, minX), Math.max(minX, maxX)), y: Math.min(Math.max(off.y, minY), Math.max(minY, maxY)) };
  };

  const floatingCards = (state: PanelStack, actions: PanelStackActions, tabs: readonly SidebarTab[], content: (id: string) => ReactNode) => {
    const cardW = state.side === "left" ? 232 : 200;
    return floatingPanels(state).map((id) => {
      const tab = tabs.find((t) => t.id === id);
      const base = floatBase(state.side, cardW);
      const off = clamp(state.floatingOffset[id] ?? { x: 0, y: 0 }, state.side, cardW);
      const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        const origin = state.floatingOffset[id] ?? { x: 0, y: 0 };
        const sx = e.clientX, sy = e.clientY;
        let last = origin;
        const move = (ev: PointerEvent) => { last = clamp({ x: origin.x + ev.clientX - sx, y: origin.y + ev.clientY - sy }, state.side, cardW); actions.setOffset(id, last); };
        const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); if (nearHomeEdge(state, last)) actions.restack(id); };
        window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
      };
      return (
        <div key={id} className="aui-kit-floating-card" style={{ transform: `translate(${base.x + off.x}px, ${base.y + off.y}px)` }}>
          <StackCard id={id} title={id} icon={tab?.icon ?? "square-dashed"} floating width={cardW} onClose={() => actions.toggle(id)} dragProps={{ onPointerDown: startDrag, style: { cursor: "grab" } }}>
            {content(id)}
          </StackCard>
        </div>
      );
    });
  };

  // The Rex-era toolbar: every group tinted, tools in popovers when floating.
  const toolSidebar = (docked: boolean) => shell.ribbon.toolbar === "ribbon"
    ? <ToolRibbon groups={ribbonGroupsOf(toolCategories.length ? (toolCategories.find((c) => c.name === shell.ribbon.activeCategory) ?? toolCategories[0]).groups : toolGroups, toolArmGroup.tint)} docked={docked} />
    : <ToolSidebar groups={toolGroups} categories={toolCategories} armGroup={toolArmGroup} docked={docked} />;
  const centerTray = shell.ribbon.centerTray && tray && tray.length > 0 && (
    <div className="aui-kit-tray-slot" style={{ bottom: hasCenterTabs ? 76 : 18 }}><CenterTray items={tray} /></div>
  );
  const workspaceSidebar = (docked: boolean) => <PanelSidebar tabs={leftTabs} state={leftPanels} actions={leftActions} docked={docked} outer={layout.panelsOnOuterEdge} content={left} />;
  const viewSidebar = (docked: boolean) => <PanelSidebar tabs={VIEW_TABS} state={viewPanels} actions={viewPanelActions} docked={docked} outer={layout.panelsOnOuterEdge} content={(id) => <ViewTabContent tab={id} inspector={inspector} />} />;

  const centerSwitcher = hasCenterTabs && (
    <div className="aui-kit-center-switcher" role="tablist" aria-label="Center view">
      <span className="aui-kit-caption" style={{ padding: "0 10px 0 8px" }}>CENTER VIEW</span>
      {centerTabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={centerSelection === tab.id} className="aui-kit-center-tab" data-active={centerSelection === tab.id || undefined} onClick={() => onCenterSelect?.(tab.id)}><Sym name={tab.icon} size={13} weight="medium" /><span>{tab.id}</span></button>)}
    </div>
  );

  const zoneOverlay = layout.showZones && (
    <div className="aui-kit-zone-overlay" aria-hidden style={{ inset: `${insets.top}px ${insets.right}px ${insets.bottom}px ${insets.left}px` }}><span>VISIBLE ZONE</span></div>
  );

  return (
    <ContentInsetsContext.Provider value={insets}>
      <div ref={hostRef} className="aui-kit-scaffold" data-mode={layout.ribbonDocked ? "docked" : isCanvas ? "canvas" : "floating"}>
        {layout.ribbonDocked ? (
          <div className="aui-kit-scaffold-docked">
            {workspaceSidebar(true)}
            <span className="aui-kit-vdivider" style={{ height: "auto" }} />
            <div className="aui-kit-scaffold-column">
              {toolSidebar(true)}
              <span className="aui-kit-divider" />
              <div className="aui-kit-scaffold-center">{center}<PromptBar /></div>
            </div>
            <span className="aui-kit-vdivider" style={{ height: "auto" }} />
            {viewSidebar(true)}
          </div>
        ) : (
          <div className="aui-kit-scaffold-floating">
            <div className="aui-kit-scaffold-center">{center}</div>
            <div className="aui-kit-overlay-top"><EdgeReveal edge="top" canvas={isCanvas}>{toolSidebar(false)}</EdgeReveal><PromptBar /></div>
            <div className="aui-kit-overlay-left"><EdgeReveal edge="left" canvas={isCanvas}>{workspaceSidebar(false)}</EdgeReveal></div>
            <div className="aui-kit-overlay-right"><EdgeReveal edge="right" canvas={isCanvas}>{viewSidebar(false)}</EdgeReveal></div>
          </div>
        )}
        <div className="aui-kit-floating-layer">
          {floatingCards(leftPanels, leftActions, leftTabs, left)}
          {floatingCards(viewPanels, viewPanelActions, VIEW_TABS, (id) => <ViewTabContent tab={id} inspector={inspector} />)}
        </div>
        {centerTray}
        {centerSwitcher}
        {zoneOverlay}
      </div>
    </ContentInsetsContext.Provider>
  );
}

// MARK: - CodexUI DockingWorkspace.swift

export type DockPlacement = "docked" | "floating" | "hidden";

/** The area in-window floating chrome covers (PanelObstructionInsets). Spatial canvases ignore it; structured content opts in via DockSafeArea. */
export interface DockInsets { top: number; bottom: number; left: number; right: number }
const DockInsetsContext = createContext<DockInsets>({ top: 0, bottom: 0, left: 0, right: 0 });
export const useDockInsets = () => useContext(DockInsetsContext);

/** CodexUI's `.avoidsFloatingWorkspacePanels(edges)`: keeps tables and timelines inside the visible area. */
export function DockSafeArea({ edges = ["top", "bottom", "left", "right"], children, style }: { edges?: readonly ("top" | "bottom" | "left" | "right")[]; children: ReactNode; style?: CSSProperties }) {
  const i = useDockInsets();
  return <div className="aui-kit-dock-safe" style={{ paddingTop: edges.includes("top") ? i.top : 0, paddingBottom: edges.includes("bottom") ? i.bottom : 0, paddingLeft: edges.includes("left") ? i.left : 0, paddingRight: edges.includes("right") ? i.right : 0, ...style }}>{children}</div>;
}

/** CodexUI's FloatingPanelSizing: floating panels are capped cards, never full-height columns. */
export const floatingPanelHeight = (available: number, preferredFraction = 0.72, minimum = 380, margins = 24) =>
  Math.min(Math.max(0, available - margins), Math.max(minimum, available * preferredFraction));

/**
 * The canvas-first layout every CodexUI workspace used: one source view per
 * side region with three presentations — docked in the flow, floating over the
 * canvas (right side draggable, clamped to the window), or hidden with a hover
 * strip that reveals it in the Canvas preset.
 */
export function DockingWorkspace({ left, center, right, leftPlacement, rightPlacement, leftWidth = 246, rightWidth = 286, centerInset = 10, canvasReveal = false, leftTitle = "Browser", rightTitle = "Inspector", overlayTop, overlayBottom, ribbonClearance }: {
  left: ReactNode; center: ReactNode; right: ReactNode; leftPlacement: DockPlacement; rightPlacement: DockPlacement; leftWidth?: number; rightWidth?: number; centerInset?: number;
  /** Hidden regions reveal on hover at the edge (only in the Canvas preset, as CodexUI's policy says). */ canvasReveal?: boolean; leftTitle?: string; rightTitle?: string;
  /** The floating ribbon, placed over the centre at the top or bottom. */ overlayTop?: ReactNode; overlayBottom?: ReactNode;
  /** Where a floating ribbon sits (74px of clearance for DockSafeArea), if the app draws it outside this component. */ ribbonClearance?: "top" | "bottom" | null;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1200, height: 800 });
  const [revealed, setRevealed] = useState<"left" | "right" | null>(null);
  const [rightOffset, setRightOffset] = useState<Offset>({ x: 0, y: 0 });
  useLayoutEffect(() => {
    const el = host.current; if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => { if (rightPlacement !== "floating") setRightOffset({ x: 0, y: 0 }); }, [rightPlacement]);
  const cardHeight = floatingPanelHeight(size.height);
  const dragRight = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const sx = e.clientX, sy = e.clientY, origin = rightOffset;
    const move = (ev: PointerEvent) => {
      // Clamp like FloatingWidgetPlacement: stay inside the workspace with an 8px margin.
      const maxLeft = size.width - 12 - rightWidth - 8, maxDown = size.height - 12 - cardHeight - 8;
      setRightOffset({ x: Math.min(0, Math.max(-maxLeft, origin.x + ev.clientX - sx)), y: Math.max(0, Math.min(maxDown, origin.y + ev.clientY - sy)) });
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const floating = (side: "left" | "right", content: ReactNode, width: number, title: string, peek = false) => (
    <div className="aui-kit-dock-floating" data-side={side} data-peek={peek || undefined} aria-label={title} style={{ width, height: cardHeight, transform: side === "right" ? `translate(${rightOffset.x}px, ${rightOffset.y}px)` : undefined }}
      onMouseLeave={() => { if (peek) setRevealed(null); }}>
      {side === "right" && !peek && <div className="aui-kit-dock-grip" title="Drag to reposition" onPointerDown={dragRight}><Sym name="menu" size={10} weight="semibold" /></div>}
      <div className="aui-kit-dock-floating-body">{content}</div>
    </div>
  );
  const reveal = (side: "left" | "right", content: ReactNode, width: number, title: string) => (
    <div className="aui-kit-dock-reveal" data-side={side} onMouseEnter={() => setRevealed(side)}>
      {revealed === side ? floating(side, content, width, title, true) : <span className="aui-kit-dock-reveal-handle" aria-hidden />}
    </div>
  );
  const insets: DockInsets = {
    top: overlayTop || ribbonClearance === "top" ? 74 : 0, bottom: overlayBottom || ribbonClearance === "bottom" ? 74 : 0,
    left: leftPlacement === "floating" ? leftWidth + 18 : 0, right: rightPlacement === "floating" ? rightWidth + 18 : 0,
  };
  return (
    <div className="aui-kit-dock-workspace">
      {leftPlacement === "docked" && (<><div className="aui-kit-dock-column" style={{ width: leftWidth }} aria-label={leftTitle}>{left}</div><span className="aui-kit-vdivider" style={{ height: "auto" }} /></>)}
      <div ref={host} className="aui-kit-dock-center">
        <DockInsetsContext.Provider value={insets}><div className="aui-kit-dock-center-body" style={{ padding: centerInset }}>{center}</div></DockInsetsContext.Provider>
        {leftPlacement === "floating" && floating("left", left, leftWidth, leftTitle)}
        {rightPlacement === "floating" && floating("right", right, rightWidth, rightTitle)}
        {canvasReveal && leftPlacement === "hidden" && reveal("left", left, leftWidth, leftTitle)}
        {canvasReveal && rightPlacement === "hidden" && reveal("right", right, rightWidth, rightTitle)}
        {overlayTop && <div className="aui-kit-dock-overlay" data-edge="top">{overlayTop}</div>}
        {overlayBottom && <div className="aui-kit-dock-overlay" data-edge="bottom">{overlayBottom}</div>}
      </div>
      {rightPlacement === "docked" && (<><span className="aui-kit-vdivider" style={{ height: "auto" }} /><div className="aui-kit-dock-column" style={{ width: rightWidth }} aria-label={rightTitle}>{right}</div></>)}
    </div>
  );
}
