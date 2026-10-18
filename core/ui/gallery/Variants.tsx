/**
 * Side-by-side variant specimens for the showcase. Where the shared library
 * and the Aether Animation Mockup kit (`@aether/ui/animation-mockup-widgets`) both have a
 * take on the same widget, both are shown under one heading with a caption,
 * which is the raw material for the consolidation pass in
 * dev/docs/roadmap/Animation_Mockup_Web_Port.md.
 */
import { useState, type ReactNode } from "react";
import { SidebarSpecimen } from "./SidebarSpecimen";
import { AetherIcon, DockPanel, Rail, RailButton, SegmentedControl, ToolIcon, WorkspaceRibbon, type ToolIconName, type WorkspaceRibbonGroup, type WorkspaceRibbonTab, type WorkspaceRibbonWorkspace } from "../src/index";
import {
  AD, KitShellProvider, CenterTray, DopeSheetTimeline, ListRow, PanelSidebar, StatusBar as KitStatusBar, ToolCluster, ToolSidebar, ToolRibbon, TreeView, defaultLayout, defaultRenderPrefs, panelStack, usePanelStack, ribbonGroupsOf, type RenderPrefs,
  treeNode, treeState, type LayoutFlags, type RibbonSettings, type ShellWorkspace, type TreeState,
} from "../src/Kit";
import { CATALOG, DemoProvider, TRAY_ITEMS, WORKSPACES } from "./animation-mockup/model";
import { useTray } from "./animation-mockup/tray";
import { Sym } from "../src/kit/icons";
import { OverlayScope } from "../src/OverlayScope";

/** One captioned variant. */
export const Variant = ({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) => (
  <div className="gallery-variant" data-wide={wide || undefined}><small>{label}</small>{children}</div>
);

/** The demo's theme scope: its widgets read `--ad-*` tokens, which follow the page's light/dark here, and
 *  its menus and popovers portal inside the scope (OverlayScope) so they keep the kit's look, as in the app. */
function KitScope({ children, ribbon, workspaces, workspaceID }: { children: ReactNode; ribbon?: Partial<RibbonSettings>; workspaces?: readonly ShellWorkspace[]; workspaceID?: string }) {
  const [layout, setLayout] = useState<LayoutFlags>(defaultLayout);
  const [workspace, setWorkspace] = useState(workspaceID ?? workspaces?.[0]?.id);
  return (
    <OverlayScope data-aether-kit="" className="gallery-kit-scope">
      <KitShellProvider layout={layout} setLayout={setLayout} initialRibbon={ribbon} workspaces={workspaces} workspaceID={workspace} onWorkspaceSelect={setWorkspace}>{children}</KitShellProvider>
    </OverlayScope>
  );
}

/** The demo's authoring workspaces, for the Expanded sidebar's dropdown. */
const DEMO_WORKSPACES = WORKSPACES.filter((w) => w.id !== "home" && w.id !== "uiKit");

/* Jonathan's 2026-09-23 concept renders: Fusion's Design workspace, Solid tab,
   drawn with the kit's SF-named line glyphs (the renders use line icons). */
const conceptWorkspaces: readonly WorkspaceRibbonWorkspace[] = [
  // Menu-sized glyphs; the glass switcher scales the current one up to 1.76em itself.
  { id: "design", label: "Design", icon: <AetherIcon name="design" width={16} height={16} /> },
  { id: "render", label: "Render", icon: <AetherIcon name="contrast" width={16} height={16} /> },
  { id: "manufacture", label: "Manufacture", icon: <AetherIcon name="hammer" width={16} height={16} />, disabled: true, disabledReason: "Manufacture is not in this build." },
];

function conceptGroup(id: string, label: string, tools: readonly [ToolIconName, string][]): WorkspaceRibbonGroup {
  return {
    id, label,
    tools: tools.map(([name, title]) => ({ id: `${id}-${name}`, label: title, icon: <ToolIcon name={name} width={40} height={40} /> })),
    menuItems: tools.map(([name, title]) => ({ id: `${id}-${name}`, label: title, icon: <ToolIcon name={name} width={16} height={16} /> })),
  };
}
const conceptTabs: readonly WorkspaceRibbonTab[] = [
  { id: "solid", label: "Solid", groups: [
    { id: "create", label: "Create", tools: [
      { id: "create-sketch", label: "Create Sketch", icon: <ToolIcon name="sketch" width={40} height={40} /> },
      // A split tool: the caret picks which rectangle the button is, the way
      // Onshape and Aether Map do. Its variants also list in the caption menu.
      { id: "create-rectangle", label: "Rectangle", icon: <ToolIcon name="rectangle" width={40} height={40} />, variants: [
        { id: "create-rectangle", label: "Rectangle", icon: <ToolIcon name="rectangle" width={16} height={16} /> },
        { id: "create-center-rectangle", label: "Center rectangle", icon: <ToolIcon name="center-rectangle" width={16} height={16} /> },
        { id: "create-aligned-rectangle", label: "Aligned rectangle", icon: <ToolIcon name="aligned-rectangle" width={16} height={16} /> },
      ] },
      { id: "create-box", label: "Box", icon: <ToolIcon name="box" width={40} height={40} /> },
      { id: "create-cylinder", label: "Cylinder", icon: <ToolIcon name="cylinder" width={40} height={40} /> },
    ] },
    conceptGroup("modify", "Modify", [["push-pull", "Press Pull"], ["chamfer", "Chamfer"], ["fillet", "Fillet"]]),
    conceptGroup("construct", "Construct", [["plane", "Offset Plane"]]),
    conceptGroup("inspect", "Inspect", [["measure", "Measure"]]),
    conceptGroup("insert", "Insert", [["insert", "Insert Canvas"]]),
    conceptGroup("assemble", "Assemble", [["connector", "Joint"]]),
    conceptGroup("select", "Select", [["select", "Select"]]),
  ] },
  ...["Surface", "Mesh", "Sheet Metal", "Plastic", "Manage", "Utilities"].map((label) => ({ id: label.toLowerCase().replace(" ", "-"), label, groups: [conceptGroup(label.toLowerCase(), label, [["settings", `${label} tools`]])] })),
];
const conceptMore = [
  { id: "customize", label: "Customize toolbar…", icon: <Sym name="sliders" size={15} /> },
  { id: "labels", label: "Show tool labels", kind: "checkbox" as const, checked: false, icon: <Sym name="align-left" size={15} /> },
  { id: "reset", label: "Reset ribbon", separatorBefore: true, icon: <Sym name="undo" size={15} /> },
];

/** A small row of mode switches above one widget instance, for modes the widget cannot flip itself. */
function ModeRow({ children }: { children: ReactNode }) { return <div className="gallery-mode-row">{children}</div>; }

/** One `WorkspaceRibbon` — the design is the glass column; density (Compact · Standard · Expanded) from its own "•••" menu, like the kit tool sidebar. */
const CONCEPT_TOOL_IDS = new Set(conceptTabs.flatMap((tab) => tab.groups.flatMap((group) => group.tools.map((tool) => tool.id))));

export function WorkspaceRibbonVariant() {
  const [docked, setDocked] = useState(false);
  const [workspace, setWorkspace] = useState("design");
  const [tab, setTab] = useState("solid");
  const [command, setCommand] = useState("—");
  // The blue tile is the armed tool, a state: it starts on Select and follows whatever tool is picked.
  const [armed, setArmed] = useState("select-select");
  const tabs = conceptTabs.map((entry) => ({ ...entry, groups: entry.groups.map((group) => ({ ...group, tools: group.tools.map((tool) => ({ ...tool, active: tool.id === armed })) })) }));
  const onCommand = (id: string) => { setCommand(id); if (CONCEPT_TOOL_IDS.has(id)) setArmed(id); };
  return (
    <Variant label={`Aether tool bar (WorkspaceRibbon) · density from its ••• menu: Compact · Standard · Expanded, with the workspace · shared default proportions · armed: ${armed} · last command: ${command}`} wide>
      <ModeRow><label><input type="checkbox" checked={docked} onChange={event => setDocked(event.target.checked)} /> docked</label></ModeRow>
      <div style={{ width: docked ? "100%" : "max-content", maxWidth: "100%" }}>
        <WorkspaceRibbon workspaces={conceptWorkspaces} workspaceID={workspace} onWorkspaceSelect={setWorkspace} tabs={tabs} activeTabID={tab} onTabSelect={setTab} onCommand={onCommand}
          workspaceLayout="column" appearance="glass" docked={docked} moreItems={conceptMore} />
      </div>
    </Variant>
  );
}

/** The Aether tool bar: one `ToolSidebar`, density from its own "•••" menu, docked flipped here. */
export function KitToolbarVariants() {
  const [docked, setDocked] = useState(false);
  return (
    <Variant label="Aether tool bar (ToolSidebar) · density from its ••• menu: Compact · Standard · Expanded, with the workspace dropdown · category tabs from the Design catalogue" wide={docked}>
      <ModeRow><label><input type="checkbox" checked={docked} onChange={(event) => setDocked(event.target.checked)} /> docked</label></ModeRow>
      <KitScope ribbon={{ density: "standard" }} workspaces={DEMO_WORKSPACES} workspaceID="design">
        <div style={{ width: docked ? "100%" : undefined }}><ToolSidebar groups={CATALOG.design.groups} categories={CATALOG.design.categories} armGroup={CATALOG.design.armGroup} docked={docked} /></div>
      </KitScope>
    </Variant>
  );
}

const SIDE_TOOLS = [
  { icon: "cursor", label: "Select" }, { icon: "flag", label: "Cue", tint: AD.warn }, { icon: "bolt", label: "Trigger", tint: AD.warn },
  { icon: "monitor", label: "Monitor", tint: AD.ok }, { icon: "hardware", label: "Hardware", tint: AD.ok }, { icon: "stop", label: "Stop", tint: AD.danger },
];

/** Both existing tinted ribbon presentations are visible for direct comparison. */
export function TintedToolbarVariants() {
  const groups = ribbonGroupsOf(CATALOG.design.groups, AD.accent);
  return <>{([false, true] as const).map(docked => <Variant key={String(docked)} label={`Tinted tool ribbon · ${docked ? "Docked" : "Floating"}`} wide>
    <KitScope><div style={{ width: docked ? "100%" : "max-content", maxWidth: "100%" }}><ToolRibbon groups={groups} docked={docked} /></div></KitScope>
  </Variant>)}</>;
}

export function SelectionRailVariant() {
  const [solid, setSolid] = useState(true);
  return <Variant label="Aether selection rail (ToolCluster) · CodexUI's tinted side cluster">
    <ModeRow><label><input type="checkbox" checked={solid} onChange={(event) => setSolid(event.target.checked)} /> solid</label></ModeRow>
    <KitScope><div style={{ justifySelf: "start" }}><ToolCluster tools={SIDE_TOOLS} solid={solid} /></div></KitScope>
  </Variant>;
}
const SIDE_TABS = [{ id: "Characters", icon: "character" }, { id: "Parts", icon: "cube" }, { id: "Mates", icon: "link" }, { id: "Clips", icon: "film" }];
const RAIL_TABS = [["Design", "design"], ["Layers", "layers"], ["Hardware", "hardware"], ["Settings", "settings"]] as const;

/** Sidebar navigation rails with the panels they launch. Command rails live under Toolbars. */
export function SideToolbarVariants() {
  const [rail, setRail] = useState<string | null>("Design");
  const [docked, setDocked] = useState(false);
  const [panels, panelActions] = usePanelStack(() => panelStack(SIDE_TABS.map((t) => t.id), ["Parts"], "left"));
  return (
    <>
      <Variant label="Tabbed sidebar · Attached — one surface">
        <SidebarSpecimen attachment="attached" />
      </Variant>
      <Variant label="Tabbed sidebar · Detached — separate tray">
        <SidebarSpecimen attachment="detached" />
      </Variant>
      <Variant label="Tabbed sidebar · Slim — equal tabs, top or bottom">
        <SidebarSpecimen attachment="detached" variant="slim" />
      </Variant>
      <Variant label="Aether side tool bar (Rail + RailButton) · a button opens its DockPanel">
        <div style={{ height: 260, display: "flex", justifySelf: "start", border: "1px solid var(--aether-color-border)", borderRadius: 8, overflow: "hidden" }}>
          <Rail>
            {RAIL_TABS.map(([id, icon]) => (
              <RailButton key={id} label={id} active={rail === id} onClick={() => setRail(rail === id ? null : id)}><AetherIcon name={icon} /></RailButton>
            ))}
          </Rail>
          {rail && <DockPanel title={rail} width={200}><div style={{ padding: "8px 10px", font: "12px var(--aether-font-family)", color: "var(--aether-color-text-faint)" }}>{rail} panel</div></DockPanel>}
        </div>
      </Variant>
      <Variant label="Aether side tool bar (PanelSidebar: StackRail + StackCard) · a tab opens its panel; drag a floating card sideways to detach">
        <ModeRow><label><input type="checkbox" checked={docked} onChange={(event) => setDocked(event.target.checked)} /> docked</label></ModeRow>
        <KitScope>
          <div style={{ height: 300, justifySelf: "start", position: "relative" }}>
            <PanelSidebar tabs={SIDE_TABS} state={panels} actions={panelActions} docked={docked}
              content={(id) => <div className="aui-kit-stack-8" style={{ padding: 12 }}><span className="aui-kit-caption">{id.toUpperCase()}</span><ListRow icon="cube" title={`${id} 1`} selected /><ListRow icon="cube" title={`${id} 2`} /></div>} />
          </div>
        </KitScope>
      </Variant>
    </>
  );
}

const TRAY_WORKSPACES = Object.keys(TRAY_ITEMS) as (keyof typeof TRAY_ITEMS)[];

/** The center tray tool bar: one `CenterTray` fed by the Rex build's per-workspace items, with the demo's own popovers (Display · Environment · Performance). */
export function CenterTrayVariant() {
  const [workspace, setWorkspace] = useState<keyof typeof TRAY_ITEMS>("character");
  const [render, setRender] = useState<RenderPrefs>(defaultRenderPrefs);
  return (
    <Variant label="Center tray tool bar (CenterTray) · sits under the viewport; items per workspace, popovers from the demo">
      <ModeRow>
        <SegmentedControl ariaLabel="workspace" options={TRAY_WORKSPACES.map((id) => ({ id, label: id }))} value={workspace} onChange={(id) => setWorkspace(id as keyof typeof TRAY_ITEMS)} />
      </ModeRow>
      <KitScope><DemoProvider><div style={{ justifySelf: "start" }}><DemoTray workspace={workspace} render={render} setRender={setRender} /></div></DemoProvider></KitScope>
    </Variant>
  );
}

function DemoTray({ workspace, render, setRender }: { workspace: keyof typeof TRAY_ITEMS; render: RenderPrefs; setRender: (r: RenderPrefs) => void }) {
  return <CenterTray items={useTray({ render, setRender }, workspace)} />;
}

/** The Aether demo's universal `TreeView` (folders, drag reorder, rename, visibility). */
export function KitTreeVariant() {
  const [model, setModel] = useState<TreeState>(() => {
    const s = treeState([
      treeNode("Rover Base", "cube", { detail: "42f" }),
      treeNode("Arm", "folder", { isFolder: true, children: [treeNode("Bracket L", "cube", { detail: "18f" }), treeNode("Bracket R", "cube", { detail: "18f" })] }),
      treeNode("Cover", "cube", { detail: "26f", visible: false }),
    ]);
    return { ...s, expanded: [s.nodes[1].id], selection: [s.nodes[0].id] };
  });
  return (
    <Variant label="animation-studio TreeView + TreeRow">
      <KitScope><div style={{ width: 232 }}><TreeView model={model} onChange={setModel} ariaLabel="Parts (Aether demo)" /></div></KitScope>
    </Variant>
  );
}

const sampleTracks = [
  { id: "hip", name: "Hip", color: AD.accent, keys: [0.05, 0.3, 0.62, 0.9] },
  { id: "knee", name: "Knee", color: AD.accent, keys: [0.12, 0.44, 0.78] },
  { id: "jaw", name: "Jaw", color: AD.warn, keys: [0.2, 0.55] },
];

/** The Aether demo's dope sheet beside the shared `Timeline`. */
export function KitTimelineVariant() {
  const [progress, setProgress] = useState(0.36);
  const [playing, setPlaying] = useState(false);
  return (
    <Variant label="animation-studio DopeSheetTimeline · one instance: keys, audio lane, badge, transport">
      <KitScope><DopeSheetTimeline tracks={sampleTracks} progress={progress} duration={8} isPlaying={playing} onScrub={setProgress} onTogglePlay={() => setPlaying((v) => !v)} onRewind={() => setProgress(0)} audio={{ name: "Dialogue.wav" }} badge={{ text: "LIVE FOLLOW" }} style={{ width: 720, maxWidth: "100%", height: 250 }} /></KitScope>
    </Variant>
  );
}

/** The Aether demo's 24pt footer beside the shared `StatusBar`. */
export const KitStatusBarVariant = () => (
  <Variant label="animation-studio StatusBar">
    <KitScope><div style={{ width: 640, maxWidth: "100%" }}><KitStatusBar workspace="Rig" model={{ name: "Rover Base", triangles: 8204 }} /></div></KitScope>
  </Variant>
);

export { panelStack };
