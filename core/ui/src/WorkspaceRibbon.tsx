import { ToolHelp, type ToolHelpContent } from "./ToolHelp";
import { ToolTrayScroll } from "./ToolTrayScroll";
import { useContext, useState, type ReactNode } from "react";
import { WorkspaceLayoutContext } from "./WorkspaceLayoutContext";
import { AetherIcon } from "./AetherIcon";
import type { MenuItem } from "./Menu";
import { Ribbon, RibbonTool } from "./Ribbon";
import { Tabs, type TabDefinition } from "./Tabs";
import { ToolMenuButton, WorkspaceSwitcher } from "./WorkspaceSwitcher";
import "./WorkspaceRibbon.css";
import { setWorkspaceChrome, useWorkspaceChrome } from "./WorkspaceChromePreferences";

export interface WorkspaceRibbonWorkspace {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
}

export interface WorkspaceRibbonCommand {
  help?: ToolHelpContent;
  id: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  /**
   * Related commands that share this button: a caret beside it picks which,
   * and the button then shows the one picked. Onshape's Line / Midpoint line,
   * the rectangle kinds and the five arcs all work this way, and so do Aether
   * Map's rectangle and ellipse pairs.
   *
   * The button keeps the family's own `id`, so it has one stable identity
   * whichever variant is showing; `selectedVariantID` says which that is, and
   * the app gives the button the current variant's label and icon. Choosing
   * from the caret reports the variant's id; clicking the button reports the
   * family's, and the app runs whatever it currently means.
   */
  variants?: readonly WorkspaceRibbonCommand[];
  /** Which variant the button is showing; defaults to the command's own id. */
  selectedVariantID?: string;
}

export interface WorkspaceRibbonGroup {
  id: string;
  label: string;
  tools: readonly WorkspaceRibbonCommand[];
  /** Optional full command list; otherwise the caption menu lists the tools. */
  menuItems?: readonly MenuItem[];
}

export interface WorkspaceRibbonTab extends TabDefinition {
  groups: readonly WorkspaceRibbonGroup[];
}

/**
 * Where the workspace selector sits, and what it looks like.
 *
 * "strip" puts it in the tab strip as another set of tabs. "column" gives it a
 * button in a column of its own at the far left, spanning both rows, with the
 * tool tabs above the tools to its right — Fusion's arrangement, and the more
 * honest one: a workspace is not a peer of the tool tabs, because choosing one
 * changes which tool tabs exist.
 */
export type WorkspaceRibbonLayout = "strip" | "column" | "none";

/**
 * "panel" is the flat, in-page ribbon this component has always drawn.
 * "glass" is the floating concept look from Jonathan's 2026-09-23 render: a
 * translucent rounded slab, the workspace as a boxed column, pill tabs,
 * icon-only tool groups under their captions, and a glowing active tool. Tool
 * labels stay in the DOM for assistive tech; only their paint changes.
 */
export type WorkspaceRibbonAppearance = "panel" | "glass";

export interface WorkspaceRibbonProps {
  /** Inherits WorkspaceShell's layout by default. Docked toolbars span their host. */
  docked?: boolean;
  workspaces: readonly WorkspaceRibbonWorkspace[];
  workspaceID: string;
  onWorkspaceSelect: (id: string) => void;
  tabs: readonly WorkspaceRibbonTab[];
  /** Optional tabless icon strip used only at compact density. */
  compactGroups?: readonly WorkspaceRibbonGroup[];
  /** Keep every command as a direct icon in the compact studio tray. */
  compactTools?: boolean;
  activeTabID: string;
  onTabSelect: (id: string) => void;
  onCommand: (id: string) => void;
  /**
   * A variant chosen from a split tool's caret. Distinct from `onCommand`
   * because a family and its own first variant share an id: clicking the
   * button means "run whatever this is", while choosing from the caret means
   * "make it this one". Without it, the caret reports through `onCommand`.
   */
  onVariantSelect?: (commandID: string, variantID: string) => void;
  /** Defaults to the standard workspace selector column; none omits navigation when the host provides it. */
  workspaceLayout?: WorkspaceRibbonLayout;
  /** Defaults to the standard glass appearance; panel is an explicit variant. */
  appearance?: WorkspaceRibbonAppearance;
  /** Extra entries for the trailing "•••" menu, after the density choices — overflow, customisation, resets. */
  moreItems?: readonly MenuItem[];
  /** Accessible name of the "•••" menu. */
  moreLabel?: string;
  /** Controlled density; otherwise the ribbon keeps its own, starting at `defaultDensity`. */
  density?: WorkspaceRibbonDensity;
  defaultDensity?: WorkspaceRibbonDensity;
  onDensityChange?: (density: WorkspaceRibbonDensity) => void;
}

/**
 * The same three densities as the kit tool sidebar, chosen from the "•••"
 * menu: Compact collapses each group to one icon that opens its tools;
 * Standard shows the grouped tools under their captions; Expanded adds the
 * workspace column (the concept render). Jonathan, 2026-09-24: both toolbars
 * are equivalent.
 */
export type WorkspaceRibbonDensity = "compact" | "standard" | "expanded";
export const WORKSPACE_RIBBON_DENSITIES: readonly { id: WorkspaceRibbonDensity; label: string }[] = [
  { id: "compact", label: "Compact" }, { id: "standard", label: "Standard" }, { id: "expanded", label: "Expanded" },
];

/** Controlled workspace selector, tab strip, and grouped command ribbon.
 * Commands and workspace semantics remain with the consuming application. */
export function WorkspaceRibbon({
  workspaces, workspaceID, onWorkspaceSelect, tabs, compactGroups, compactTools = false, activeTabID, onTabSelect, onCommand, onVariantSelect,
  workspaceLayout: appWorkspaceLayout = "column", appearance: appAppearance = "glass", moreItems = [], moreLabel = "More tools",
  density: controlledDensity, defaultDensity = "expanded", onDensityChange, docked,
}: WorkspaceRibbonProps) {
  const layout = useContext(WorkspaceLayoutContext);
  const chrome = useWorkspaceChrome();
  const workspaceLayout = chrome.workspaceSelector === "app" ? appWorkspaceLayout : chrome.workspaceSelector;
  const appearance = chrome.ribbonAppearance === "app" ? appAppearance : chrome.ribbonAppearance;
  const isDocked = docked ?? layout === "docked";
  const [ownDensity, setOwnDensity] = useState<WorkspaceRibbonDensity>(defaultDensity);
  const density = chrome.toolbarDensity === "app" ? controlledDensity ?? ownDensity : chrome.toolbarDensity;
  const setDensity = (next: WorkspaceRibbonDensity) => {
    if (chrome.toolbarDensity !== "app") setWorkspaceChrome({ toolbarDensity: next });
    setOwnDensity(next); onDensityChange?.(next);
  };
  const activeTab = tabs.find((tab) => tab.id === activeTabID && !tab.disabled);
  const compact = compactGroups ?? (compactTools ? activeTab?.groups : undefined);
  const iconStrip = density === "compact" && compact !== undefined;
  const visibleGroups = iconStrip ? compact : activeTab?.groups;
  // The caption menu lists every command in the group. A tool that carries
  // variants contributes the variants themselves, which are the complete set,
  // so nothing is reachable only through a caret and nothing is listed twice.
  const groupMenu = (group: WorkspaceRibbonGroup): MenuItem[] => (group.menuItems ?? group.tools.flatMap((tool): MenuItem[] =>
    (tool.variants?.length ? tool.variants : [tool]).map((entry): MenuItem => ({
      id: entry.id, label: entry.label, icon: entry.icon, disabled: entry.disabled, disabledReason: entry.disabledReason,
    })),
  )).map((item, index) => (index === 0 ? { ...item, heading: item.heading ?? group.label } : item));
  const moreMenu: MenuItem[] = [
    ...WORKSPACE_RIBBON_DENSITIES.map((entry, index) => ({ id: `density:${entry.id}`, label: entry.label, kind: "radio" as const, checked: density === entry.id, heading: index === 0 ? "Density" : undefined })),
    ...moreItems.map((item, index) => (index === 0 ? { ...item, separatorBefore: true, heading: item.heading ?? "Toolbar" } : item)),
  ];
  const onMore = (id: string) => { if (id.startsWith("density:")) setDensity(id.slice(8) as WorkspaceRibbonDensity); else onCommand(id); };


  return (
    <div className="aui-workspace-ribbon" data-toolbar-menu-boundary="" data-docked={isDocked || undefined} data-workspace-layout={workspaceLayout} data-appearance={appearance} data-density={density} data-icon-strip={iconStrip || undefined} data-compact-tools={compactTools || undefined}>
      {/* No workspaces: the app shows its switcher elsewhere (e.g. its header). */}
      {!iconStrip && workspaceLayout === "column" && workspaces.length > 0 && (
        <div className="aui-workspace-ribbon-workspaces">
          <WorkspaceSwitcher workspaces={workspaces} workspaceID={workspaceID} onSelect={onWorkspaceSelect} menuClassName="aui-tool-menu" />
        </div>
      )}
      {(!iconStrip || compactTools) && <nav className="aui-workspace-ribbon-tabs" aria-label="Workspace tools">
        {workspaceLayout === "strip" && workspaces.length > 0 && (
          <div className="aui-workspace-ribbon-workspaces">
            <Tabs tabs={workspaces.map((item) => ({ ...item, title: item.disabledReason }))}
              activeID={workspaceID} onSelect={onWorkspaceSelect} />
          </div>
        )}
        <Tabs tabs={tabs} activeID={activeTabID} onSelect={onTabSelect} />
      </nav>}
      <ToolTrayScroll label={iconStrip ? "Compact tools" : activeTab?.label ?? "Tools"} role={iconStrip ? "group" : "tabpanel"}>
        <Ribbon>
          {density === "compact" && !iconStrip && activeTab?.groups.map((group) => (
            <div className="aui-workspace-ribbon-group" data-compact="" key={group.id}>
              <ToolMenuButton className="aui-workspace-ribbon-group-button" menuClassName="aui-tool-menu" label={`${group.label} tools`} items={groupMenu(group)} onSelect={onCommand} placement="bottom-start">
                <span className="aui-ribbon-tool-icon" aria-hidden="true">{group.tools[0]?.icon}</span>
              </ToolMenuButton>
            </div>
          ))}
          {(density !== "compact" || iconStrip) && visibleGroups?.map((group) => (
            <div className="aui-workspace-ribbon-group" key={group.id}>
              <div className="aui-workspace-ribbon-buttons">
                {group.tools.map((tool) => (
                  <span key={tool.id} className="aui-workspace-ribbon-tool" data-tool-id={tool.id}>
                    <ToolHelp label={tool.label} help={tool.help} disabledReason={tool.disabled ? tool.disabledReason : undefined}><RibbonTool label={tool.label} icon={tool.icon}
                      active={tool.active} aria-pressed={tool.active}
                      disabled={tool.disabled} title={tool.help ? undefined : tool.disabledReason ?? tool.label}
                      onClick={() => onCommand(tool.id)} /></ToolHelp>
                    {tool.variants?.length ? (
                      // The caret is named for the family, not for whichever
                      // variant is showing, so its name does not move under you.
                      <ToolMenuButton className="aui-workspace-ribbon-variants" menuClassName="aui-tool-menu" anchorTo="group"
                        label={`${tool.variants.find((variant) => variant.id === tool.id)?.label ?? tool.label} variants`}
                        onSelect={(variantID) => (onVariantSelect ? onVariantSelect(tool.id, variantID) : onCommand(variantID))}
                        items={tool.variants.map((variant): MenuItem => ({
                          id: variant.id, label: variant.label, icon: variant.icon, help: variant.help, kind: "radio",
                          checked: variant.id === (tool.selectedVariantID ?? tool.id), disabled: variant.disabled,
                          disabledReason: variant.disabledReason,
                        }))}>
                        <AetherIcon name="chevron" style={{ transform: "rotate(90deg)" }} width={9} height={9} />
                      </ToolMenuButton>
                    ) : null}
                  </span>
                ))}
              </div>
              <ToolMenuButton className="aui-workspace-ribbon-caption" menuClassName="aui-tool-menu" label={`${group.label} tools`}
                items={groupMenu(group)} onSelect={onCommand} anchorTo="group">
                {!iconStrip && group.label}<AetherIcon name="chevron" style={{ transform: "rotate(90deg)" }} width={10} height={10} />
              </ToolMenuButton>
            </div>
          ))}
          <div className="aui-workspace-ribbon-more">
            <ToolMenuButton className="aui-workspace-ribbon-more-button" menuClassName="aui-tool-menu" label={moreLabel} items={moreMenu} onSelect={onMore} anchorTo="group">
              <span aria-hidden="true">•••</span>
            </ToolMenuButton>
          </div>
        </Ribbon>
      </ToolTrayScroll>
    </div>
  );
}
