import { StudioSpecimens } from "./showcase/StudioSpecimens";
import { DocumentTabsSpecimens } from "./DocumentTabsSpecimens";
import { AppWordmarkSpecimens } from "./AppWordmarkSpecimens";
import { WheelReferenceDemo } from "./wheel-studio/WheelReferenceDemo";
import { WheelStudioDemo } from "./wheel-studio/WheelStudioDemo";
import { SpotlightStudioDemo } from "./spotlight-studio/SpotlightStudioDemo";
import { StandardWindowLayouts, GeneralWindowLayout, ApplicationWindowLayout, ThreeColumnWireframe } from "./StandardWindowLayouts";
import { MaterialStudioDemo } from "./material-studio/MaterialStudioDemo";
import { ModelStudioAppDemo } from "./model-studio-apps/ModelStudioAppDemo";
import { PlasticityStudioDemo } from "./plasticity-studio/PlasticityStudioDemo";
import { MaterialSwatchSpecimen } from "./material-studio/StudioSpecimens";
import { AvatarStudioDemo } from "./avatar-studio/AvatarStudioDemo";
import { HeaderBarSpecimens } from "./HeaderBarSpecimens";
import { ConceptHeaderBar } from "./ConceptHeaderBar";
import { HorizontalNavigationHeader } from "./HorizontalNavigationHeader";
import { MediaPreviewSpecimen } from "./avatar-studio/AvatarStudioSpecimens";
import { AnalyticsDemo } from "./analytics-demo/AnalyticsDemo";
import { AppNavigationBarSpecimen, AnalyticsSpecimens, ChartLegendSpecimen, StatusBadgeSpecimen, DashboardNavigationSpecimen } from "./analytics-demo/AnalyticsSpecimens";
import { WorkflowWidgetsDemo, WorkflowElementDemo, WorkflowLinkDemo } from "./WorkflowWidgetsDemo";
import { OverlayContainerOverview, OverlayWindowSpecimens } from "./OverlayContainers";
import { ApplicationWelcome } from "../src/ApplicationWelcome";
import { SplitPaneSpecimen, BottomPanelSpecimen, problemRows, problemColumns } from "./PanelSpecimens";
import { DockingWorkspaceDemo } from "./showcase/LibraryGaps";
import { WorkspaceDemoDirectory, WorkspaceDemoWindow, WORKSPACE_DEMOS, type WorkspaceDemoID } from "./WorkspaceDemos";
import { SidebarProperties, TabbedSidebarDemo } from "./TabbedSidebarDemo";
import { BottomDockSpecimen, WorkspaceBottomDockDemo } from "./WorkspaceBottomDockDemo";
import { SplashDemo } from "./SplashDemo";
import { ElementSpec } from "./showcase/ElementSpec";
import { IconButtonSpecimen } from "./IconButtonSpecimen";
import { ShowcaseHome } from "./showcase/ShowcaseHome";
import { useSuiteApps } from "./suite-apps";
import { PDMRevisionTreeDemo } from "./PDMRevisionTreeDemo";
import { DocumentServicesDemo } from "./DocumentServicesDemo";
import { ElectronicsWidgetsDemo } from "./ElectronicsWidgetsDemo";
import { useDemoSidebarDesign } from "./useDemoSidebarDesign";
import { SidebarDesignMenu } from "../src/SidebarDesignMenu";
import { PropertiesPanelDemo, PropertiesPanelSpecimen, StylePropertiesWidget } from "./PropertiesPanelDemo";
import { DashboardDemo } from "./dashboard-demo/DashboardDemo";
import { DashboardSpecimens } from "./dashboard-demo/DashboardSpecimens";
import { FlowDiagramDemo } from "./FlowDiagramDemo";
import { GradientControlsDemo } from './GradientControlsDemo';
import { ParameterRowDemo } from './ParameterRowDemo';
import { ShowcaseSections } from "./showcase/ShowcaseLayout";
import { ShowcaseBrowser } from "./showcase/ShowcaseBrowser";
import { useShowcaseView } from "./showcase/ShowcaseView";
import { SystemIconBrowser, ToolPackBrowser } from "./IconPacks";
import { ThemePackBrowser } from "./ThemePack";
import { legacyShowcaseLocation } from "./showcase";
import { ImportedSpecimens, NativeLibrary } from "./showcase/DemoShowcase";
import { TreePanelDemo } from "./TreePanelDemo";
import { FeatureTreeDemo } from "./FeatureTreeDemo";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "../tokens/tokens.css";
import "../src/widgets.css";
import "./gallery.css";
import "./DemoViewport.css";
import { AppIcon } from "../src/AppIcon";
import { AppMark } from "../src/AppMark";
import { FileIconsDemo } from "./FileIconsDemo";
import { ComingSoonHome } from "../src/ComingSoonHome";
import { StudioModeButton, WorkspaceWindowMenu, AppearanceToggle } from "../src/StudioChrome";
import { SettingsCard, SettingsRow, SettingsWindow } from "../src/SettingsWindow";
import { RibbonWorkspaceDemo } from "./RibbonWorkspaceDemo";
import { AnimationStudioDemo } from "./AnimationStudioDemo";
import { AnimationMockupApp } from "./animation-mockup/AnimationMockupApp";
import { AtlasDemoApp } from "./atlas-demo/AtlasDemoApp";
import { ConceptAppDirectory, conceptApps } from "./ConceptAppDirectory";
import { demoAppsURL } from "./demo-location";
import { comparisonGroup, sectionTab, sectionLabel, sectionID } from "./showcase";
import { KitStatusBarVariant, KitTimelineVariant, KitToolbarVariants, KitTreeVariant, CenterTrayVariant, SideToolbarVariants, SelectionRailVariant, TintedToolbarVariants, Variant, WorkspaceRibbonVariant } from "./Variants";
import { FloatingToolbarDemo } from "./FloatingToolbarDemo";
import { CADDocumentListDemo } from "./CADDocumentListDemo";
import { DimensionedSketchDemo } from "./DimensionedSketchDemo";
import { FeatureEditorVariants } from "./FeatureEditorVariants";
import { DialogWindowSpecimens, PopoverWindowSpecimen, ProgressWindowSpecimen } from "./DialogPopoverSpecimens";
import { NavBarsDemo } from "./NavBarsDemo";
import {
  ToolIcon,
  AetherIcon,
  Button,
  Breadcrumbs,
  Checkbox,
  ColorField,
  CommandPalette,
  DataTable,
  DockPanel,
  DocumentBar,
  DocumentTabs,
  EmptyState,
  ErrorState,
  FieldRow,
  FileField,
  ListBox,
  MenuButton,
  NumberField,
  NotificationCenter,
  PanelPlacementMenu,
  PanelHeading,
  PropertyGrid,
  RadioGroup,
  Rail,
  RailButton,
  Ribbon,
  RibbonGroup,
  RibbonTool,
  SelectField,
  SearchField,
  SegmentedControl,
  Slider,
  StatusBar,
  ApplicationStatusBar,
  StatusDot,
  Tabs,
  TextField,
  Timeline,
  ToastStack,
  Tooltip,
  Tree,
  ViewportCanvas,
  ViewportNavigationCube,
  WorkspaceShell,
  standardWorkspacePanels,
} from "../src/index";
import type {
  DataTableColumn,
  DataTableSort,
  DocumentTab,
  LayoutPreset,
  ListBoxItem,
  NotificationItem,
  PanelPlacement,
  TreeNode,
} from "../src/index";

// The UIDev-style widget gallery: every shared widget on one page, with
// live state, so design changes are reviewed here before any app ships
// them. `npm run gallery` serves it.

const sampleTree: TreeNode[] = [
  {
    id: "instances",
    label: "Instances",
    badge: "3",
    icon: <AetherIcon name="cube" />,
    children: [
      {
        id: "base", label: "base", icon: <AetherIcon name="box" />,
        actions: [{ id: "hide", label: "Hide", icon: <AetherIcon name="visible" /> }],
      },
      { id: "yoke", label: "yoke", icon: <AetherIcon name="box" /> },
      { id: "head", label: "head (suppressed)", icon: <AetherIcon name="box" />, dimmed: true },
    ],
  },
  {
    id: "mates",
    label: "Mate features",
    badge: "2",
    icon: <AetherIcon name="mate" />,
    children: [
      { id: "pan", label: "pan · revolute", icon: <AetherIcon name="revolute" /> },
      { id: "tilt", label: "tilt · revolute", icon: <AetherIcon name="revolute" /> },
    ],
  },
];

const sampleMaterials: ListBoxItem[] = [
  { id: "al-6061", label: "Aluminum 6061", description: "2.70 g/cm³", icon: <AetherIcon name="keyframe-filled" />, group: "Metals", badge: "Used" },
  { id: "steel", label: "Mild steel", description: "7.85 g/cm³", icon: <AetherIcon name="keyframe-filled" />, group: "Metals" },
  { id: "titanium", label: "Titanium", description: "Library unavailable", icon: <AetherIcon name="keyframe-filled" />, group: "Metals", disabled: true },
  { id: "abs", label: "ABS", description: "Injection molded", icon: <AetherIcon name="keyframe" />, group: "Polymers" },
  { id: "nylon", label: "Nylon", description: "Suppressed override", icon: <AetherIcon name="keyframe" />, group: "Polymers", dimmed: true },
];

const sampleConstraints: ListBoxItem[] = [
  { id: "coincident-1", label: "Coincident", description: "Point 1 · Origin", icon: <AetherIcon name="circle-filled" />, badge: "Fixed" },
  { id: "horizontal-1", label: "Horizontal", description: "Line 1", icon: "—" },
  {
    id: "distance-1",
    label: "Distance · 60 mm",
    description: "Line 1",
    icon: "↔",
    actions: [{ id: "edit", label: "Edit dimension", icon: <AetherIcon name="pencil" /> }],
  },
];

const galleryTreeInitial: TreeNode[] = [
  ...sampleTree.map((node) =>
    node.id !== "instances"
      ? node
      : {
          ...node,
          children: node.children?.map((child) =>
            child.id === "yoke"
              ? {
                  ...child,
                  actions: [{ id: "rename", label: "Rename", icon: <AetherIcon name="pencil" /> }],
                }
              : child
          ),
        }
  ),
  { id: "linked", label: "Linked components", icon: <AetherIcon name="open-external" />, childrenLoading: true },
  { id: "unavailable", label: "Offline library", icon: <AetherIcon name="keyframe" />, childrenError: "Connection unavailable" },
];

const largeAssemblyTree: TreeNode[] = Array.from({ length: 1200 }, (_, index) => ({
  id: `assembly-node-${index}`,
  label: `Component ${String(index + 1).padStart(4, "0")}`,
  icon: <AetherIcon name="box" />,
}));

function renameTreeNode(
  nodes: readonly TreeNode[],
  id: string,
  label: string
): TreeNode[] {
  return nodes.map((node) => ({
    ...node,
    label: node.id === id ? label : node.label,
    children: node.children ? renameTreeNode(node.children, id, label) : undefined,
  }));
}

interface BomRow { id: string; item: string; quantity: number; material: string }
const initialBomRows: BomRow[] = Array.from({ length: 140 }, (_, index) => ({
  id: `bom-${index}`,
  item: index === 0 ? "Yoke bracket" : `Component ${String(index + 1).padStart(3, "0")}`,
  quantity: (index % 4) + 1,
  material: index % 3 === 0 ? "Aluminum 6061" : index % 3 === 1 ? "ABS" : "Steel",
}));
const bomColumns: DataTableColumn<BomRow>[] = [
  { id: "item", header: "Item", cell: (row) => row.item, sortValue: (row) => row.item, editValue: (row) => row.item, editable: true, sortable: true, resizable: true, reorderable: true, pinned: true, width: 170 },
  { id: "quantity", header: "Qty", cell: (row) => row.quantity, sortValue: (row) => row.quantity, sortable: true, resizable: true, reorderable: true, width: 65, align: "end" },
  { id: "material", header: "Material", cell: (row) => row.material, sortValue: (row) => row.material, sortable: true, resizable: true, reorderable: true, width: 130 },
];

const modelCommands = [
  { id: "new-sketch", label: "New sketch", category: "Create", description: "Start on the selected plane", shortcut: "S", recent: true, icon: <AetherIcon name="sketch" /> },
  { id: "extrude", label: "Extrude profile", category: "Create", keywords: ["push pull solid"], shortcut: "E", icon: <AetherIcon name="cube" /> },
  { id: "rename", label: "Rename component", category: "Edit", argument: { label: "Component name", placeholder: "New name", required: true, submitLabel: "Rename", help: "Names are unique within the parent assembly." }, icon: <AetherIcon name="pencil" /> },
  { id: "measure", label: "Measure selection", category: "Inspect", disabled: true, disabledReason: "Select two geometric entities.", shortcut: "M", icon: "↔" },
  { id: "fit", label: "Fit view", category: "View", shortcut: "F", recent: true, icon: <AetherIcon name="fit" /> },
] as const;

const animationCommands = [
  { id: "add-key", label: "Add keyframe", category: "Animate", shortcut: "K", recent: true, icon: <AetherIcon name="keyframe-filled" /> },
  { id: "select-track", label: "Select track", category: "Navigate", keywords: ["channel joint"], argument: { label: "Track name", placeholder: "Search tracks", required: true, submitLabel: "Select" }, icon: <AetherIcon name="list" /> },
  { id: "loop", label: "Toggle loop playback", category: "Transport", shortcut: "L", icon: <AetherIcon name="revolute" /> },
  { id: "send", label: "Send to hardware", category: "Output", disabled: true, disabledReason: "Connect and arm an output device.", icon: <AetherIcon name="hardware" /> },
  { id: "play", label: "Play or pause", category: "Transport", shortcut: "Space", recent: true, icon: <AetherIcon name="play" /> },
] as const;

const cadDocuments: DocumentTab[] = [
  { id: "assembly", label: "Atlas Assembly", pinned: true },
  { id: "bracket", label: "Jaw Bracket", dirty: true },
  { id: "drawing", label: "Head Layout", preview: true },
  { id: "reference", label: "Imported Reference", disabled: true },
];
const animationDocuments: DocumentTab[] = [
  { id: "scene", label: "Main Scene", dirty: true },
  { id: "walk", label: "Walk Cycle" },
  { id: "jaw", label: "Jaw Performance", preview: true },
  { id: "output", label: "Output Mapping" },
  { id: "diagnostics", label: "Diagnostics" },
];
const initialCadNotifications: NotificationItem[] = [
  { id: "cad-save", kind: "success", title: "Part saved", message: "Jaw Bracket is current.", timestamp: "Now", actionLabel: "Show" },
  { id: "cad-link", kind: "warning", title: "Linked source changed", message: "Review before rebuilding.", timestamp: "1 min", persistent: true },
  { id: "cad-import", kind: "progress", title: "Importing assembly", message: "Resolving exact topology.", progress: 58, timestamp: "Now", persistent: true },
];
const initialAnimationNotifications: NotificationItem[] = [
  { id: "anim-output", kind: "error", title: "Output disconnected", message: "Playback remains in preview.", timestamp: "Now", actionLabel: "Reconnect" },
  { id: "anim-bake", kind: "success", title: "Clip baked", message: "240 evaluated frames are ready.", timestamp: "4 min", read: true },
];

function reorderDocuments<T extends { id: string }>(items: readonly T[], sourceID: string, targetID: string): T[] {
  const source = items.findIndex((item) => item.id === sourceID);
  const target = items.findIndex((item) => item.id === targetID);
  if (source < 0 || target < 0) return [...items];
  const next = [...items];
  const [moved] = next.splice(source, 1);
  if (moved) next.splice(target, 0, moved);
  return next;
}

function SettingsWindowDemo() {
  const [pane, setPane] = useState("workspace");
  return (
    <div className="aui-settings-inline" style={{ width: "min(880px, 100%)" }}>
      <SettingsWindow
        open
        title="App Settings"
        activePaneID={pane}
        onSelectPane={setPane}
        onClose={() => {}}
        sections={[
          { title: "General", panes: [{ id: "workspace", label: "Workspace" }, { id: "layout", label: "Layout" }, { id: "ui", label: "UI" }] },
          { title: "Viewport", panes: [{ id: "renderer", label: "Renderer" }, { id: "appearance", label: "Appearance" }, { id: "lighting", label: "Lighting" }, { id: "navigation", label: "Navigation", disabled: true }] },
          { title: "Advanced", panes: [{ id: "developer", label: "Developer", disabled: true }] },
        ]}
      >
        <SettingsCard title="Project Workspace" caption="Choose where new project folders are created by default.">
          <SettingsRow label="Default project location" caption="New Project, Open Project, and Save As begin in this folder.">
            <input aria-label="Demo project location" value="~/Documents/AetherStudio" readOnly />
            <Button>Change…</Button>
          </SettingsRow>
        </SettingsCard>
        <SettingsCard title="Authoring Defaults">
          <SettingsRow label="Unitless model units">
            <select aria-label="Demo units" defaultValue="mm">
              <option value="mm">Millimeters (mm)</option>
              <option value="cm">Centimeters (cm)</option>
              <option value="in">Inches (in)</option>
            </select>
          </SettingsRow>
          <SettingsRow label="Autosave after import">
            <input type="checkbox" aria-label="Demo autosave" defaultChecked />
          </SettingsRow>
          <SettingsRow label="Default frame rate" disabled caption="Disabled placeholder row.">
            <input type="range" aria-label="Demo frame rate" min={12} max={60} defaultValue={30} disabled />
            <output>30 fps</output>
          </SettingsRow>
        </SettingsCard>
        <SettingsCard tone="notice" title="Plain project folders" caption="Each project remains a browsable folder containing portable assets." />
      </SettingsWindow>
    </div>
  );
}

/** The browser mounts a selected section or a related design family from the canonical inventory.
 *  After its own widgets, every section lists the imported demo specimens
 *  filed under it (gallery/showcase/inventory.ts), so a section that only
 *  holds imports is written self-closing, with just its title. */
function Section({ title, children }: { title: string; children?: React.ReactNode }) {
  const view = useShowcaseView();
  const active = view.tab;
  const comparison = comparisonGroup(active, view.section, Boolean(view.collectionId));
  const tab = sectionTab(title);
  if (tab && tab !== active) return null;
  return (
    <section id={sectionID(title)} aria-label={sectionLabel(title)} data-gallery-section={title} data-gallery-tab={tab ?? "unfiled"} style={{ display: "grid", gap: 10, minWidth: 0, maxWidth: "calc(100vw - 48px)" }}>
      {comparison && <h2 className="showcase-comparison-title">{sectionLabel(title)}</h2>}
      <div className="showcase-section-content" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 12, minWidth: 0, maxWidth: "100%" }}>
        {children}
        <StudioSpecimens section={title}/>
        {/* All designs stay openly visible in their functional category. */}
        {tab === "apps" || title === "Workspaces — launchable concepts" || title === "Overlay containers — standards" || title === "Window layouts" ? null : <ImportedSpecimens section={title}/> }
      </div>
    </section>
  );
}

function WorkspaceDemo() {
  const [sidebarDesign, setSidebarDesign] = useDemoSidebarDesign("workspace");
  // Deep link for design review: gallery/#layout=floating|docked|canvas
  const [preset, setPreset] = useState<LayoutPreset>(() => {
    const requested = new URLSearchParams(location.hash.slice(1)).get("layout");
    return requested === "floating" || requested === "canvas" ? requested : "docked";
  });
  const [tool, setTool] = useState<string | null>("extrude");
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set(["body-1"]));

  // Studio layout modes — the same presets Aether CAD exposes.
  const MODES: { id: LayoutPreset; label: string }[] = [
    { id: "docked", label: "Docked" },
    { id: "floating", label: "Floating" },
    { id: "canvas", label: "Hidden" },
  ];

  const toolbar = (
    <Ribbon>
      <RibbonGroup label="Create">
        {[
          ["sketch", "Sketch"],
          ["extrude", "Extrude"],
          ["revolve", "Revolve"],
        ].map(([id, label]) => (
          <RibbonTool
            key={id}
            icon={<ToolIcon name={id as Parameters<typeof ToolIcon>[0]["name"]} />}
            label={label}
            active={tool === id}
            onClick={() => setTool(tool === id ? null : id)}
          />
        ))}
      </RibbonGroup>
      <RibbonGroup label="Modify">
        {[
          ["fillet", "Fillet"],
          ["chamfer", "Chamfer"],
        ].map(([id, label]) => (
          <RibbonTool
            key={id}
            icon={<ToolIcon name={id as Parameters<typeof ToolIcon>[0]["name"]} />}
            label={label}
            active={tool === id}
            onClick={() => setTool(tool === id ? null : id)}
          />
        ))}
      </RibbonGroup>
    </Ribbon>
  );

  const featureTree: TreeNode[] = [
    {
      id: "reference",
      label: "Reference Geometry",
      badge: "5",
      icon: <AetherIcon name="design" />,
      children: [
        { id: "origin", label: "Origin", icon: <ToolIcon name="point" /> },
        { id: "axes", label: "Axes", icon: <ToolIcon name="axis" />, dimmed: true, badge: "—" },
        { id: "top", label: "Top Plane", icon: <ToolIcon name="plane" /> },
        { id: "front", label: "Front Plane", icon: <ToolIcon name="plane" /> },
        { id: "right", label: "Right Plane", icon: <ToolIcon name="plane" /> },
      ],
    },
    {
      id: "part",
      label: "Part 1",
      badge: "3",
      icon: <AetherIcon name="design" />,
      children: [
        { id: "sketch-1", label: "Sketch 1", icon: <ToolIcon name="sketch" /> },
        { id: "extrude-1", label: "Extrude 1", icon: <ToolIcon name="extrude" /> },
        { id: "fillet-1", label: "Fillet 1", icon: <ToolIcon name="fillet" />, dimmed: true, badge: "Suppressed" },
      ],
    },
    {
      id: "bodies",
      label: "Bodies",
      badge: "1",
      icon: <AetherIcon name="cube" />,
      children: [{ id: "body-1", label: "Body 1", icon: <AetherIcon name="cube" /> }],
    },
  ];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <DocumentBar windowChrome={false}
        leading={
          <>
            <AppMark app="cad" size={26} />
            <strong style={{ fontSize: 12 }}>Part 1</strong>
            <span style={{ color: "var(--aether-color-text-faint)", fontSize: 11 }}>Main</span>
            <span style={{ color: "var(--aether-color-ok)", fontSize: 10 }}>SAVED</span>
          </>
        }
        center={
          <Tabs
            tabs={MODES.map(({ id, label }) => ({ id, label }))}
            activeID={preset}
            onSelect={(id) => setPreset(id as LayoutPreset)}
          />
        }
        trailing={
          <>
            <SidebarDesignMenu value={sidebarDesign} onChange={setSidebarDesign} />
            <div data-aether-account="" />
          </>
        }
      />
      <WorkspaceShell
        preset={preset}
        sidebarVariant={sidebarDesign}
        style={{ flex: 1, minHeight: 0 }}
        toolbar={toolbar}
        leftPanels={standardWorkspacePanels([
          {
            id: "tree",
            title: "Feature tree",
            icon: <AetherIcon name="design" />,
            content: (
              <Tree
                nodes={featureTree}
                selectedIDs={selection}
                onSelect={(ids) => setSelection(new Set(ids))}
              />
            ),
          },
          {
            id: "versions",
            title: "Version control",
            icon: <AetherIcon name="document" />,
            content: (
              <div style={{ padding: 12, fontSize: 11, color: "var(--aether-color-text-dim)", display: "grid", gap: 6 }}>
                <span>Main · current</span>
                <span>v3 · Fillet added</span>
                <span>v2 · Extrude 1</span>
              </div>
            ),
          },
        ], { features: "tree" })}
        rightPanels={[
          {
            id: "properties",
            title: "Properties",
            icon: <AetherIcon name="settings" />,
            content: (
              <div style={{ display: "grid", gap: 8, padding: 12 }}>
                <TextField unit="mm" defaultValue="12.5" />
                <TextField unit="deg" defaultValue="30" />
              </div>
            ),
          },
          {
            id: "appearance",
            title: "Appearance",
            icon: <AetherIcon name="palette" />,
            content: (
              <div style={{ padding: 12, fontSize: 11, color: "var(--aether-color-text-dim)" }}>
                Environment theme · Onshape
              </div>
            ),
          },
          {
            id: "performance",
            title: "Performance",
            icon: <AetherIcon name="gauge" />,
            content: (
              <div style={{ padding: 12, fontSize: 11, color: "var(--aether-color-text-dim)" }}>
                60.0 fps · 16.7 ms
              </div>
            ),
          },
        ]}
        defaultOpenLeft={["tree"]}
        defaultOpenRight={["properties"]}
        statusBar={
          <StatusBar>
            <StatusDot kind="ok" />
            Aether CAD · Three.js WebGPU · OCCT ready · layout: {preset}
          </StatusBar>
        }
      >
        <div
          style={{
            display: "grid",
            placeItems: "center",
            height: "100%",
            color: "var(--aether-color-text-faint)",
            fontSize: 12,
          }}
        >
          viewport canvas — switch Docked / Floating / Hidden above
        </div>
      </WorkspaceShell>
    </div>
  );
}

function TimelineDemo() {
  const [timeS, setTimeS] = useState(0.8);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<{ trackID: string; index: number } | null>(null);
  return (
    <div style={{ width: 640, overflow: "hidden" }}>
      <Timeline
        tracks={[
          { id: "pan", label: "pan.rotation", keyframes: [{ timeS: 0 }, { timeS: 1 }, { timeS: 2 }] },
          { id: "tilt", label: "tilt.rotation", keyframes: [{ timeS: 0 }, { timeS: 0.5 }, { timeS: 2 }] },
          { id: "jaw", label: "jaw.open", keyframes: [{ timeS: 0.25 }, { timeS: 1.4 }] },
        ]}
        durationS={2}
        timeS={timeS}
        onSeek={setTimeS}
        playing={playing}
        onTogglePlay={() => setPlaying((current) => !current)}
        selected={selected}
        onSelectKeyframe={(trackID, index) => setSelected({ trackID, index })}
      />
    </div>
  );
}


function ResizableWorkspaceDemo() {
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set());
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  return <div style={{ display: "grid", gridTemplateRows: `minmax(0, 1fr) ${bottomCollapsed ? "auto" : "minmax(180px, 35%)"}`, width: "100%", height: "100%", overflow: "hidden" }}>
    <SplitPaneSpecimen
      primary={<div style={{ height: "100%", background: "var(--aether-color-bg-panel)" }}>
        <PanelHeading>Assembly navigator</PanelHeading>
        <Tree nodes={sampleTree} selectedIDs={selection} onSelect={ids => setSelection(new Set(ids))} />
      </div>}
      secondary={<div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--aether-color-text-faint)" }}>Persistent viewport</div>}
    />
    <BottomPanelSpecimen fill onCollapsedChange={setBottomCollapsed} />
  </div>;
}

function Gallery() {
  const showcaseView = useShowcaseView();
  const [activeTab, setActiveTab] = useState("modeling");
  const [activeRail, setActiveRail] = useState("tree");
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set(["yoke"]));
  const [galleryTreeNodes, setGalleryTreeNodes] = useState<readonly TreeNode[]>(galleryTreeInitial);
  const [renamingTreeID, setRenamingTreeID] = useState<string | null>(null);
  const [materialSelection, setMaterialSelection] = useState<ReadonlySet<string>>(new Set(["al-6061"]));
  const [constraintSelection, setConstraintSelection] = useState<ReadonlySet<string>>(new Set(["distance-1"]));
  const [bomRows, setBomRows] = useState<readonly BomRow[]>(initialBomRows);
  const [bomSelection, setBomSelection] = useState<ReadonlySet<string>>(new Set(["bom-0"]));
  const [bomSort, setBomSort] = useState<DataTableSort | null>({ columnID: "item", direction: "ascending" });
  const [bomFilter, setBomFilter] = useState("");
  const [problemSelection, setProblemSelection] = useState<ReadonlySet<string>>(new Set(["p1"]));
  const [propertyFilter, setPropertyFilter] = useState("");
  const [modifiedOnly, setModifiedOnly] = useState(false);
  const [treeFilter, setTreeFilter] = useState("");
  const [panelPlacement, setPanelPlacement] = useState<PanelPlacement>("docked");
  const [name, setName] = useState("my_robot");
  const [draftAngle, setDraftAngle] = useState(3);
  const [stateMessage, setStateMessage] = useState("No components yet");
  const [modelSearch, setModelSearch] = useState("");
  const [librarySearch, setLibrarySearch] = useState("aluminum");
  const [libraryScope, setLibraryScope] = useState("all");
  const [projectionStandard, setProjectionStandard] = useState("third");
  const [displayStyle, setDisplayStyle] = useState("shaded");
  const [environmentIntensity, setEnvironmentIntensity] = useState(70);
  const [bodyColor, setBodyColor] = useState("#2b9cf3");
  const [modelFiles, setModelFiles] = useState<readonly File[]>([]);
  const [channelMode, setChannelMode] = useState("position");
  const [interpolation, setInterpolation] = useState("smooth");
  const [cueIntensity, setCueIntensity] = useState(45);
  const [cueColor, setCueColor] = useState("#f59e0b");
  const [cueFiles, setCueFiles] = useState<readonly File[]>([]);
  const [modelPaletteOpen, setModelPaletteOpen] = useState(false);
  const [animationPaletteOpen, setAnimationPaletteOpen] = useState(false);
  const [paletteResult, setPaletteResult] = useState("No command chosen");
  const [cadTabs, setCadTabs] = useState(cadDocuments);
  const [cadActiveTab, setCadActiveTab] = useState("bracket");
  const [animationTabs, setAnimationTabs] = useState(animationDocuments);
  const [animationActiveTab, setAnimationActiveTab] = useState("scene");
  const [cadNotifications, setCadNotifications] = useState(initialCadNotifications);
  const [animationNotifications, setAnimationNotifications] = useState(initialAnimationNotifications);
  const [toastItems, setToastItems] = useState<readonly NotificationItem[]>([]);

  return (
    <main
      style={{
        minHeight: "100%",
        background: "var(--aether-color-bg-app)",
        color: "var(--aether-color-text)",
        fontFamily: "var(--aether-font-family)",
        padding: 24,
        display: "grid",
        gap: 26,
        alignContent: "start",
      }}
    >
      <ShowcaseSections tab={showcaseView.tab} selected={showcaseView.section} individual={Boolean(showcaseView.collectionId)}>
      <Section title="Home"><ShowcaseHome /></Section>

      {/* Elements — one component per page: standard, allowed variations, standard configuration. */}
      <Section title="Buttons">
        <ElementSpec summary="A button runs one command. Label it with a verb in title case."
          standard={<Button>Button</Button>}
          variants={[
            { label: "Primary", note: "The one main action in a view.", node: <Button primary>Create</Button> },
            { label: "Active", note: "A toggled command that is on.", node: <Button active>Snap</Button> },
            { label: "Text link", note: "A quiet secondary action, using button semantics.", node: <WorkflowLinkDemo /> },
            { label: "Flat", note: "Low-emphasis, inside dense panels.", node: <Button appearance="flat">Reset</Button> },
            { label: "Disabled", note: "Unavailable; say why in a tooltip.", node: <Button disabled>Export</Button> },
          ]}
          configuration={<div style={{ display: "flex", gap: 8, marginLeft: "auto" }}><Button>Cancel</Button><Button primary>Create</Button></div>}
          rules={["At most one primary button per view.", "Cancel sits before the confirming action, on the right."]} />
      </Section>

      <Section title="Icon buttons">
        <IconButtonSpecimen />
      </Section>

      <Section title="Text fields">
        <ElementSpec summary="Single-line text entry."
          standard={<TextField value={name} onChange={(event) => setName(event.target.value)} placeholder="Assembly name" style={{ width: 220 }} />}
          variants={[
            { label: "With unit", node: <TextField unit="mm" defaultValue="12.5" style={{ width: 120 }} /> },
            { label: "Invalid", note: "Explain the problem in its title or help.", node: <TextField unit="deg" defaultValue="400" invalid title="Invalid: exceeds the joint limit" style={{ width: 120 }} /> },
            { label: "Disabled", node: <TextField defaultValue="Locked" disabled style={{ width: 120 }} /> },
          ]}
          configuration={<div style={{ width: 280 }}><FieldRow label="Name" htmlFor="spec-name"><TextField id="spec-name" placeholder="Bracket" /></FieldRow></div>} />
      </Section>

      <Section title="Password fields"><WorkflowElementDemo kind="password" /></Section>
      <Section title="Avatars"><WorkflowElementDemo kind="avatar" /></Section>
      <Section title="Choice cards"><WorkflowElementDemo kind="choice" /></Section>
      <Section title="Settings rows"><WorkflowElementDemo kind="setting" /></Section>
      <Section title="Structure steps"><WorkflowElementDemo kind="step" /></Section>
      <Section title="Chart legends"><ChartLegendSpecimen /></Section>
      <Section title="Status badges"><StatusBadgeSpecimen /></Section>
      <Section title="Workflow widgets — forms, lists and account controls"><WorkflowWidgetsDemo /></Section>

      <Section title="Number fields">
        <ElementSpec summary="Numeric entry with units, limits, scrubbing and expressions that commit on Enter or blur."
          standard={<NumberField defaultValue={60} min={0.001} step={1} unit="mm" scrubLabel="Width" />}
          variants={[
            { label: "Angle with limits", node: <NumberField value={draftAngle} onCommit={setDraftAngle} min={-89} max={89} step={0.5} unit="deg" /> },
            { label: "Invalid", node: <NumberField defaultValue={-4} unit="mm" invalid /> },
          ]}
          configuration={<div style={{ width: 280 }}><FieldRow label="Draft angle" htmlFor="spec-angle" modified={draftAngle !== 0} onReset={() => setDraftAngle(0)}><NumberField id="spec-angle" value={draftAngle} onCommit={setDraftAngle} min={-89} max={89} step={0.5} unit="deg" /></FieldRow></div>}
          rules={["Always state the unit.", "A modified value shows a reset control in its field row."]} />
      </Section>

      <Section title="Select fields">
        <ElementSpec summary="Choose one value from a short list."
          standard={<SelectField defaultValue="mm" options={[{ value: "mm", label: "Millimeters" }, { value: "cm", label: "Centimeters" }, { value: "in", label: "Inches" }]} />}
          variants={[
            { label: "With placeholder", node: <SelectField placeholder="Choose a material" options={[{ value: "al", label: "Aluminum 6061" }, { value: "steel", label: "Steel" }]} /> },
            { label: "Invalid", node: <SelectField invalid defaultValue="" placeholder="Required" options={[{ value: "a", label: "Option" }]} /> },
          ]}
          configuration={<div style={{ width: 280 }}><FieldRow label="Display units" htmlFor="spec-units"><SelectField id="spec-units" defaultValue="mm" options={[{ value: "mm", label: "Millimeters" }, { value: "in", label: "Inches" }]} /></FieldRow></div>}
          rules={["Use a segmented control instead when there are two to five visible choices."]} />
      </Section>

      <Section title="Search fields">
        <ElementSpec summary="Filter a list or library as you type."
          standard={<div style={{ width: 340 }}><SearchField value={modelSearch} onQueryChange={setModelSearch} ariaLabel="Search model" placeholder="Features, bodies, sketches"
            resultCount={galleryTreeNodes.filter((node) => node.label.toLocaleLowerCase().includes(modelSearch.toLocaleLowerCase())).length} /></div>}
          variants={[
            { label: "With scopes", node: <div style={{ width: 380 }}><SearchField value={librarySearch} onQueryChange={setLibrarySearch} ariaLabel="Search library"
              scopes={[{ id: "all", label: "All" }, { id: "materials", label: "Materials" }, { id: "parts", label: "Parts" }]} scopeID={libraryScope} onScopeChange={setLibraryScope}
              resultCount={sampleMaterials.filter((item) => item.label.toLocaleLowerCase().includes(librarySearch.toLocaleLowerCase())).length} /></div> },
          ]} />
      </Section>

      <Section title="Checkboxes">
        <ElementSpec summary="Turn an independent option on or off."
          standard={<Checkbox label="Show constraints" />}
          variants={[
            { label: "With description", node: <Checkbox label="Construction" description="Exclude from solid profiles" /> },
            { label: "Mixed", note: "Some of a selection.", node: <Checkbox label="Visible" indeterminate /> },
            { label: "Disabled", node: <Checkbox label="Imprinting" disabled /> },
          ]}
          configuration={<div style={{ display: "grid", gap: 6 }}><Checkbox label="Disable imprinting" /><Checkbox label="Show constraints" defaultChecked /><Checkbox label="Show expressions" /><Checkbox label="Show errors" /></div>} />
      </Section>

      <Section title="Radio buttons">
        <ElementSpec summary="Choose exactly one of a few options, each with room for a description."
          standard={<RadioGroup label="Projection standard" orientation="horizontal" options={[{ id: "first", label: "First angle" }, { id: "third", label: "Third angle" }]} value={projectionStandard} onChange={setProjectionStandard} />}
          variants={[
            { label: "Vertical with descriptions", node: <RadioGroup label="Channel mode" options={[{ id: "position", label: "Position", description: "Evaluated target" }, { id: "velocity", label: "Velocity" }]} value={channelMode} onChange={setChannelMode} /> },
            { label: "Disabled option", node: <RadioGroup label="Source" defaultValue="file" options={[{ id: "file", label: "File" }, { id: "device", label: "Device", disabled: true }]} /> },
          ]} />
      </Section>

      <Section title="Segmented controls">
        <ElementSpec summary="Switch between two to five related modes. The selected segment is highlighted."
          standard={<SegmentedControl ariaLabel="Display style" options={[{ id: "shaded", label: "Shaded" }, { id: "edges", label: "Edges" }, { id: "wire", label: "Wire" }]} value={displayStyle} onChange={setDisplayStyle} />}
          variants={[
            { label: "Two segments", node: <SegmentedControl ariaLabel="View" defaultValue="list" options={[{ id: "list", label: "List" }, { id: "grid", label: "Grid" }]} /> },
            { label: "Five segments", node: <SegmentedControl ariaLabel="Interpolation" defaultValue="smooth" options={["Step", "Linear", "Smooth", "Ease", "Hold"].map((label) => ({ id: label.toLowerCase(), label }))} /> },
            { label: "Disabled", node: <SegmentedControl ariaLabel="Units" defaultValue="mm" disabled options={[{ id: "mm", label: "mm" }, { id: "in", label: "in" }]} /> },
          ]}
          configuration={<div style={{ width: 320 }}><FieldRow label="Interpolation"><SegmentedControl ariaLabel="Interpolation" options={[{ id: "step", label: "Step" }, { id: "linear", label: "Linear" }, { id: "smooth", label: "Smooth" }]} value={interpolation} onChange={setInterpolation} /></FieldRow></div>}
          rules={["More than five choices: use a select field.", "Segments are short nouns in title case."]} />
      </Section>

      <Section title="Sliders">
        <ElementSpec summary="Set a value within a range by dragging; the value and unit show beside the track."
          standard={<div style={{ width: 280 }}><Slider ariaLabel="Environment intensity" min={0} max={200} step={5} unit="%" value={environmentIntensity} onChange={setEnvironmentIntensity} /></div>}
          variants={[
            { label: "Without value label", node: <div style={{ width: 200 }}><Slider ariaLabel="Opacity" defaultValue={60} showValue={false} /></div> },
            { label: "Disabled", node: <div style={{ width: 200 }}><Slider ariaLabel="Exposure" defaultValue={30} disabled /></div> },
          ]}
          configuration={<div style={{ width: 320 }}><FieldRow label="Cue intensity"><Slider ariaLabel="Cue intensity" min={0} max={100} unit="%" value={cueIntensity} onChange={setCueIntensity} /></FieldRow></div>} />
      </Section>

      <Section title="Color fields">
        <ElementSpec summary="Pick a color with a swatch and a hex value."
          standard={<ColorField ariaLabel="Body color" value={bodyColor} onChange={setBodyColor} />}
          variants={[{ label: "Disabled", node: <ColorField ariaLabel="Locked color" defaultValue="#94a3b8" disabled /> }]}
          configuration={<div style={{ width: 300 }}><FieldRow label="Cue color"><ColorField ariaLabel="Cue color" value={cueColor} onChange={setCueColor} /></FieldRow></div>} />
      </Section>

      <Section title="File fields">
        <ElementSpec summary="Choose local files; nothing uploads until the person asks."
          standard={<div style={{ width: 320 }}><FileField label="Model sources" accept=".step,.stp,.iges,.igs" multiple files={modelFiles} onFilesChange={setModelFiles} /></div>}
          variants={[
            { label: "With help", node: <div style={{ width: 260 }}><FileField label="Cue sources" accept="audio/*,.csv" multiple files={cueFiles} onFilesChange={setCueFiles} help="Audio and channel maps." /></div> },
            { label: "Disabled", node: <div style={{ width: 260 }}><FileField label="Archive" disabled /></div> },
          ]} />
      </Section>

      <Section title="Tabs">
        <ElementSpec summary="Switch between views of the same content. The active tab carries the accent."
          standard={<Tabs tabs={[{ id: "assets", label: "Assets" }, { id: "modeling", label: "3D Modeling" }, { id: "animate", label: "Animate" }]} activeID={activeTab} onSelect={setActiveTab} />}
          variants={[{ label: "Disabled tab", node: <Tabs tabs={[{ id: "design", label: "Design" }, { id: "render", label: "Render", disabled: true }]} activeID="design" onSelect={() => {}} /> }]}
          rules={["Tab labels are short and in title case.", "For document tabs, see Overlays › Navigation bars › Document tabs."]} />
      </Section>

      <Section title="Breadcrumbs">
        <ElementSpec summary="Show where you are in a hierarchy and step back up it."
          standard={<Breadcrumbs ariaLabel="Assembly path" items={[{ id: "atlas", label: "Atlas" }, { id: "head", label: "Head Assembly" }, { id: "jaw", label: "Jaw Bracket" }]} onNavigate={(id) => setStateMessage(`Navigate to ${id}`)} />}
          variants={[{ label: "Collapsed middle", note: "Long paths keep the first and last levels.", node: <Breadcrumbs ariaLabel="Linked component path" maxVisible={3}
            items={[{ id: "workspace", label: "Atlas" }, { id: "robot", label: "Robot" }, { id: "head", label: "Head" }, { id: "jaw", label: "Jaw" }, { id: "bracket", label: "Bracket" }]} onNavigate={(id) => setStateMessage(`Navigate to ${id}`)} /> }]} />
      </Section>

      <Section title="Tooltips">
        <ElementSpec states={false} summary="A short explanation on hover or focus, with the shortcut when there is one."
          standard={<Tooltip content="Measure between selected geometric entities." shortcut="M"><Button>Measure</Button></Tooltip>}
          variants={[{ label: "Disabled reason", node: <Tooltip content="Export the model." disabledReason="Save the part first."><Button disabled>Export</Button></Tooltip> }]} />
      </Section>

      <Section title="Status indicators">
        <ElementSpec states={false} summary="A coloured dot beside a word: the state at a glance, never color alone."
          standard={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><StatusDot kind="ok" />Connected</span>}
          variants={(["ok", "busy", "warn", "error"] as const).map((kind) => ({ label: kind[0].toUpperCase() + kind.slice(1), node: <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><StatusDot kind={kind} />{kind}</span> }))} />
      </Section>

      <Section title="Empty + error states">
        <ElementSpec states={false} summary="What to show when there is nothing yet, or something failed — with the next step."
          standard={<div style={{ width: 300 }}><EmptyState compact title={stateMessage} description="Insert a component or open a linked definition." icon={<AetherIcon name="keyframe" />}
            primaryAction={<Button primary onClick={() => setStateMessage("Component insertion requested")}>Insert component</Button>} /></div>}
          variants={[{ label: "Error", node: <div style={{ width: 280 }}><ErrorState compact title="Rebuild failed" description="The selected profile is missing." detail="Extrude 3 · profile reference unavailable"
            retryAction={<Button onClick={() => setStateMessage("Rebuild retry requested")}>Retry</Button>} /></div> }]} />
      </Section>

      <Section title="Progress overlay"><ProgressWindowSpecimen /></Section>

      {/* Widgets › Forms & inspectors: the elements above, composed. */}
      <Section title="Property forms — fields, toggles and pickers in context">
        <Variant label="Transform properties · display, location, rotation, scale and construction planes">
          <div style={{ width: 320, maxWidth: "100%" }}><SidebarProperties /></div>
        </Variant>
        <div style={{ display: "grid", gap: 10, width: 250, padding: 12 }}>
          <strong style={{ fontSize: 11 }}>Feature dimensions</strong>
          <FieldRow label="Width" htmlFor="gallery-width" help="Expressions commit on Enter or blur.">
            <NumberField id="gallery-width" defaultValue={60} min={0.001} step={1} unit="mm" scrubLabel="Width" />
          </FieldRow>
          <FieldRow label="Draft angle" htmlFor="gallery-angle" modified={draftAngle !== 0} onReset={() => setDraftAngle(0)}>
            <NumberField id="gallery-angle" value={draftAngle} onCommit={setDraftAngle} min={-89} max={89} step={0.5} unit="deg" />
          </FieldRow>
        </div>
        <div style={{ display: "grid", flex: "0 0 330px", gap: 12, width: 330, maxWidth: "100%", padding: 12 }}>
          <strong style={{ fontSize: 11 }}>Model and drawing properties</strong>
          <RadioGroup label="Projection standard" orientation="horizontal" options={[{ id: "first", label: "First angle" }, { id: "third", label: "Third angle", description: "ASME default" }]} value={projectionStandard} onChange={setProjectionStandard} />
          <FieldRow label="Display style"><SegmentedControl ariaLabel="Display style" options={[{ id: "shaded", label: "Shaded" }, { id: "edges", label: "Edges" }, { id: "wire", label: "Wire" }]} value={displayStyle} onChange={setDisplayStyle} /></FieldRow>
          <FieldRow label="Environment intensity"><Slider ariaLabel="Environment intensity" min={0} max={200} step={5} unit="%" value={environmentIntensity} onChange={setEnvironmentIntensity} /></FieldRow>
          <FieldRow label="Body color"><ColorField ariaLabel="Body color" value={bodyColor} onChange={setBodyColor} /></FieldRow>
          <FileField label="Model sources" accept=".step,.stp,.iges,.igs" multiple files={modelFiles} onFilesChange={setModelFiles} help="Exact CAD sources remain local until import is requested." />
        </div>
        <GradientControlsDemo />
        <ParameterRowDemo />
      </Section>

      <Section title="Overlay containers — standards"><OverlayContainerOverview /></Section>

      <Section title="Floating toolbars">
        <FloatingToolbarDemo />
        <Variant label="Bottom dock · collapsible tabs" wide>
          <BottomDockSpecimen />
        </Variant>
      </Section>

      <Section title="Top tool bars">
        <WorkspaceRibbonVariant />
        <KitToolbarVariants />
        <TintedToolbarVariants />
      </Section>

      <Section title="Side tool bars">
        <SideToolbarVariants />
      </Section>

      <Section title="Center tray tool bar">
        <CenterTrayVariant />
      </Section>

      <Section title="Tool rails">
        <SelectionRailVariant />
      </Section>

      <Section title="Trees + hierarchies — every variant side by side">
        <Variant label="@aether/ui FeatureTree · CAD feature history"><FeatureTreeDemo /></Variant>
        <Variant label="@aether/ui TreePanel · item hierarchy">
        <TreePanelDemo />
        </Variant>
        <Variant label="@aether/ui Tree · 1,000+ rows virtualised">
        <div style={{ width: 300 }}>
          <Tree
            ariaLabel="Large assembly"
            nodes={largeAssemblyTree}
            selectedIDs={selection}
            onSelect={(ids) => setSelection(new Set(ids))}
            virtualizeThreshold={1000}
            height={150}
          />
        </div>
        </Variant>
        <KitTreeVariant />
      </Section>

      <Section title="Tables">
        <div style={{ display: "grid", gap: 8, width: 440 }}>
          <TextField placeholder="Filter bill of materials" value={bomFilter} onChange={(event) => setBomFilter(event.target.value)} />
          <DataTable
            ariaLabel="Bill of materials"
            rows={bomRows}
            rowID={(row) => row.id}
            columns={bomColumns}
            selectedIDs={bomSelection}
            onSelect={(ids) => setBomSelection(new Set(ids))}
            sort={bomSort}
            onSortChange={setBomSort}
            filter={bomFilter}
            filterText={(row) => `${row.item} ${row.material}`}
            onEdit={(id, column, value) => {
              if (column === "item") setBomRows((current) => current.map((row) => row.id === id ? { ...row, item: value } : row));
            }}
            onColumnReorder={(source, target) => setStateMessage(`Column move requested: ${source} before ${target}`)}
            rowActions={() => [{ id: "open", label: "Open component", icon: <AetherIcon name="open-external" /> }]}
            onRowAction={(id) => setStateMessage(`Open requested: ${id}`)}
            virtualizeThreshold={100}
            height={210}
          />
        </div>
        <div style={{ width: 360 }}>
          <DataTable
            ariaLabel="Problems"
            rows={problemRows}
            rowID={(row) => row.id}
            columns={problemColumns}
            selectedIDs={problemSelection}
            onSelect={(ids) => setProblemSelection(new Set(ids))}
            rowActions={() => [{ id: "reveal", label: "Reveal source", icon: <AetherIcon name="fit" /> }]}
            onRowAction={(id) => setStateMessage(`Reveal requested: ${id}`)}
          />
        </div>
      </Section>

      <Section title="Lists + collections">
        <div style={{ width: 300, height: 230, overflow: "auto" }}>
          <ListBox
            ariaLabel="Material library"
            items={sampleMaterials}
            selectedIDs={materialSelection}
            onSelect={(ids, mode) =>
              setMaterialSelection((current) => {
                if (mode !== "toggle") return new Set(ids);
                const next = new Set(current);
                for (const id of ids) next.has(id) ? next.delete(id) : next.add(id);
                return next;
              })
            }
            selectionMode="multiple"
          />
        </div>
        <div style={{ width: 300 }}>
          <ListBox
            ariaLabel="Sketch constraints"
            items={sampleConstraints}
            selectedIDs={constraintSelection}
            onSelect={(ids) => setConstraintSelection(new Set(ids))}
            onAction={(itemID, actionID) => console.log("constraint action", itemID, actionID)}
          />
        </div>
      </Section>

      <Section title="Inspectors + property panels — every variant side by side">
        <div className="gallery-variant"><small>StylePropertiesPanel · flat sections · live preview in Windows › Widgets in context</small><StylePropertiesWidget/></div>
        <div style={{ display: "grid", gap: 8, width: 300, overflow: "hidden" }}>
          <div style={{ display: "grid", gap: 6, padding: 8 }}>
            <TextField placeholder="Filter properties" value={propertyFilter} onChange={(event) => setPropertyFilter(event.target.value)} />
            <Checkbox label="Modified only" checked={modifiedOnly} onChange={(event) => setModifiedOnly(event.target.checked)} />
          </div>
          <PropertyGrid
            ariaLabel="Body inspector"
            filter={propertyFilter}
            modifiedOnly={modifiedOnly}
            sections={[
              {
                id: "dimensions",
                label: "Dimensions",
                badge: "3",
                properties: [
                  { id: "width", label: "Width", editor: <NumberField value={60} unit="mm" />, modified: true, onReset: () => {} },
                  { id: "height", label: "Height", editor: <NumberField value={40} unit="mm" /> },
                  { id: "depth", label: "Depth", editor: <NumberField value={20} unit="mm" />, help: "Normal to sketch plane" },
                ],
              },
              {
                id: "appearance",
                label: "Appearance",
                properties: [
                  { id: "material", label: "Material", editor: <SelectField defaultValue="al" options={[{ value: "al", label: "Aluminum 6061" }]} disabled />, readOnly: true },
                ],
              },
            ]}
          />
        </div>
        <div style={{ width: 300, overflow: "hidden" }}>
          <PropertyGrid
            ariaLabel="Multi-selection inspector"
            sections={[
              {
                id: "selection",
                label: "2 selected components",
                properties: [
                  { id: "visibility", label: "Visible", editor: <Checkbox label="" indeterminate />, mixed: true },
                  { id: "material", label: "Material", editor: <SelectField placeholder="Multiple values" options={[]} />, mixed: true },
                  { id: "source", label: "Source", editor: "Linked definition", readOnly: true },
                ],
              },
            ]}
          />
        </div>
      </Section>

      <Section title="Appearance, materials + visualization — every variant side by side" />

      <Section title="Command palettes">
        <div style={{ display: "grid", gap: 8, width: 280, padding: 12 }}>
          <strong style={{ fontSize: 11 }}>Modeling commands</strong>
          <span style={{ color: "var(--aether-color-text-faint)", fontSize: 10 }}>Recents, categories, shortcuts, disabled reasons, and rename follow-up.</span>
          <Button onClick={() => setModelPaletteOpen(true)}>Open model commands…</Button>
        </div>
        <div style={{ display: "grid", gap: 8, width: 280, padding: 12 }}>
          <strong style={{ fontSize: 11 }}>Animation commands</strong>
          <span style={{ color: "var(--aether-color-text-faint)", fontSize: 10 }}>A separate product dataset using the identical command surface.</span>
          <Button onClick={() => setAnimationPaletteOpen(true)}>Open animation commands…</Button>
        </div>
        <span style={{ alignSelf: "center", color: "var(--aether-color-text-dim)", fontSize: 10 }}>{paletteResult}</span>
        <CommandPalette
          open={modelPaletteOpen}
          commands={modelCommands}
          onClose={() => setModelPaletteOpen(false)}
          onSelect={(id, argument) => setPaletteResult(`Model command: ${id}${argument ? ` · ${argument}` : ""}`)}
          title="Model commands"
          placeholder="Search model commands"
        />
        <CommandPalette
          open={animationPaletteOpen}
          commands={animationCommands}
          onClose={() => setAnimationPaletteOpen(false)}
          onSelect={(id, argument) => setPaletteResult(`Animation command: ${id}${argument ? ` · ${argument}` : ""}`)}
          title="Animation commands"
          placeholder="Search animation commands"
        />
      </Section>

      <Section title="Timelines — every variant side by side">
        <Variant label="@aether/ui Timeline">
        <TimelineDemo />
        </Variant>
        <KitTimelineVariant />
      </Section>

      <Section title="Node graphs" />
      <Section title="CAD document list"><CADDocumentListDemo /></Section>
      <Section title="Dimensioned sketches"><DimensionedSketchDemo /></Section>
      <Section title="Flow diagrams"><FlowDiagramDemo /></Section>

      <Section title="Hardware + safety" />

      <Section title="Panels + cards">
        <Variant label="@aether/ui ApplicationWelcome · welcome and updates cards" wide>
          <ApplicationWelcome id="gallery-welcome" name="Aether Vector" description="Precise paths and expressive shapes."
            artwork={<AppIcon app="vector" size={320} />} badge="Coming soon" />
        </Variant>
        <Variant label="@aether/ui SplitPane · resize, collapse and restore" wide>
          <div style={{ width: 600, maxWidth: "100%", height: 220 }}><SplitPaneSpecimen /></div>
        </Variant>
        <Variant label="@aether/ui BottomPanel · tabs, actions and collapse" wide>
          <div style={{ width: 600, maxWidth: "100%" }}><BottomPanelSpecimen /></div>
        </Variant>
      </Section>

      <Section title="Revision trees + branches"><PDMRevisionTreeDemo /></Section>
      <Section title="Document history + collaboration"><DocumentServicesDemo /></Section>
      <Section title="Electronics + instruments"><ElectronicsWidgetsDemo /></Section>
      <Section title="Dashboards + analytics"><DashboardSpecimens /></Section>
      <Section title="Media preview"><MediaPreviewSpecimen /></Section>
      <Section title="Material swatches"><MaterialSwatchSpecimen /></Section>
      <Section title="Analytics charts + rankings"><AnalyticsSpecimens /></Section>
      <Section title="Top app navigation"><AppNavigationBarSpecimen /></Section>
      <Section title="Dashboard navigation"><DashboardNavigationSpecimen /></Section>

      <Section title="Assistant + agent panels" />

      <Section title="Menus">
        <PanelPlacementMenu
          label="Inspector"
          placement={panelPlacement}
          onChange={(placement) => {
            setPanelPlacement(placement);
            setStateMessage(`Inspector placement: ${placement}`);
          }}
        />
        <MenuButton
          label="Object actions"
          items={[
            { id: "open", label: "Open", icon: <AetherIcon name="open-external" />, shortcut: "↩" },
            { id: "rename", label: "Rename", icon: <AetherIcon name="pencil" />, shortcut: "F2" },
            { id: "locked", label: "Delete", icon: "×", disabled: true, disabledReason: "The object is locked." },
            {
              id: "export",
              label: "Export",
              icon: <AetherIcon name="export" />,
              separatorBefore: true,
              children: [
                { id: "step", label: "STEP" },
                { id: "mesh", label: "Mesh" },
              ],
            },
          ]}
          onSelect={(id) => console.log("object command", id)}
        >
          Object •••
        </MenuButton>
        <MenuButton
          label="Viewport display"
          items={[
            { id: "edges", label: "Show edges", kind: "checkbox", checked: true },
            { id: "grid", label: "Show grid", kind: "checkbox", checked: false },
            { id: "reset", label: "Reset display", danger: true, separatorBefore: true },
          ]}
          onSelect={(id) => console.log("view command", id)}
        >
          View •••
        </MenuButton>
      </Section>



      <Section title="Settings window — universal per-app settings (macOS anatomy)">
        <SettingsWindowDemo />
      </Section>



      <Section title="CAD feature editors">
        <FeatureEditorVariants />
      </Section>

      <Section title="Dialogs + alerts"><DialogWindowSpecimens /></Section>

      <Section title="Popovers"><PopoverWindowSpecimen /></Section>

      <Section title="Toasts + notification history">
        <div style={{ display: "grid", gap: 8, width: 430, maxWidth: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><strong style={{ fontSize: 11 }}>CAD activity</strong><Button onClick={() => setToastItems(initialCadNotifications)}>Show CAD toasts</Button></div>
          <NotificationCenter
            items={cadNotifications}
            ariaLabel="CAD notification history"
            onAction={(id) => setStateMessage(`Notification action: ${id}`)}
            onMarkRead={(id) => setCadNotifications((current) => current.map((item) => item.id === id ? { ...item, read: true } : item))}
            onDismiss={(id) => setCadNotifications((current) => current.filter((item) => item.id !== id))}
            onClear={() => setCadNotifications([])}
          />
        </div>
        <div style={{ display: "grid", gap: 8, width: 430, maxWidth: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><strong style={{ fontSize: 11 }}>Animation activity</strong><Button onClick={() => setToastItems(initialAnimationNotifications)}>Show animation toasts</Button></div>
          <NotificationCenter
            items={animationNotifications}
            ariaLabel="Animation notification history"
            onAction={(id) => setStateMessage(`Notification action: ${id}`)}
            onMarkRead={(id) => setAnimationNotifications((current) => current.map((item) => item.id === id ? { ...item, read: true } : item))}
            onDismiss={(id) => setAnimationNotifications((current) => current.filter((item) => item.id !== id))}
            onClear={() => setAnimationNotifications([])}
          />
        </div>
        <ToastStack
          items={toastItems}
          onAction={(id) => setStateMessage(`Toast action: ${id}`)}
          onDismiss={(id) => setToastItems((current) => current.filter((item) => item.id !== id))}
        />
      </Section>

      <Section title="Floating + detached windows"><OverlayWindowSpecimens /></Section>

      <Section title="App header bars"><HeaderBarSpecimens /></Section>
      <Section title="Concept app header"><ConceptHeaderBar /></Section>
      <Section title="Collapsible navigation header"><HorizontalNavigationHeader /></Section>

      <Section title="Header chrome — studio mode, workspace windows, appearance">
        <div className="aui-studio-chrome-group" style={{ padding: 8, border: "1px solid var(--aether-color-border)", borderRadius: 8 }}>
          <StudioModeButton preset="docked" onChange={() => {}} />
          <WorkspaceWindowMenu />
          <AppearanceToggle />
        </div>
      </Section>

      <Section title="Workspace navigator + walkthrough" />

      <Section title="Rail + Dock panel + Tree">
        <div
          style={{
            display: "flex",
            height: 280,
            border: "1px solid var(--aether-color-border)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <Rail>
            {[
              { id: "tree", glyph: <AetherIcon name="list-tree" /> },
              { id: "layers", glyph: <AetherIcon name="layers" /> },
            ].map((item) => (
              <RailButton
                key={item.id}
                label={item.id}
                active={activeRail === item.id}
                onClick={() => setActiveRail(item.id)}
              >
                {item.glyph}
              </RailButton>
            ))}
          </Rail>
          <DockPanel title="Items" width={230}>
            <div style={{ padding: "8px 10px" }}>
              <TextField
                placeholder="Filter"
                value={treeFilter}
                onChange={(event) => setTreeFilter(event.target.value)}
              />
            </div>
            <Tree
              nodes={galleryTreeNodes}
              selectedIDs={selection}
              filter={treeFilter}
              onSelect={(ids, mode) =>
                setSelection((current) => {
                  if (mode === "single") return new Set(ids);
                  if (mode === "range") return new Set(ids);
                  const next = new Set(current);
                  for (const id of ids) {
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                  }
                  return next;
                })
              }
              renamingID={renamingTreeID}
              onRename={(id, label) => {
                setGalleryTreeNodes((current) => renameTreeNode(current, id, label));
                setRenamingTreeID(null);
              }}
              onCancelRename={() => setRenamingTreeID(null)}
              onAction={(node, action) => {
                if (action === "rename") setRenamingTreeID(node);
              }}
              onMove={(source, target, position) =>
                setStateMessage(`Move requested: ${source} ${position} ${target}`)
              }
              onRetryChildren={(id) => setStateMessage(`Retry requested: ${id}`)}
              onActivate={(id) => console.log("activate", id)}
              onContextMenu={(id, x, y) => console.log("context", id, x, y)}
              emptyState="no matches"
            />
          </DockPanel>
          <div style={{ flex: 1, background: "var(--aether-color-bg-shell)" }}>
            <PanelHeading>Viewport placeholder</PanelHeading>
          </div>
        </div>
      </Section>

      <Section title="Document tabs">
        <DocumentTabsSpecimens />
        <div style={{ display: "grid", gap: 8, width: 760, maxWidth: "100%" }}>
          <strong style={{ fontSize: 11 }}>CAD documents</strong>
          <DocumentTabs
            tabs={cadTabs}
            activeID={cadActiveTab}
            onSelect={setCadActiveTab}
            onClose={(id) => setStateMessage(`Close requested: ${id}`)}
            onPinToggle={(id, pinned) => setCadTabs((current) => current.map((tab) => tab.id === id ? { ...tab, pinned } : tab))}
            onReorder={(source, target) => setCadTabs((current) => reorderDocuments(current, source, target))}
            onSplit={(id, direction) => setStateMessage(`Split requested: ${id} ${direction}`)}
          />
        </div>
        <div style={{ display: "grid", gap: 8, width: 520, maxWidth: "100%" }}>
          <strong style={{ fontSize: 11 }}>Animation documents with overflow</strong>
          <DocumentTabs
            tabs={animationTabs}
            activeID={animationActiveTab}
            maxVisible={3}
            onSelect={setAnimationActiveTab}
            onClose={(id) => setStateMessage(`Close requested: ${id}`)}
            onReorder={(source, target) => setAnimationTabs((current) => reorderDocuments(current, source, target))}
            onSplit={(id, direction) => setStateMessage(`Split requested: ${id} ${direction}`)}
          />
        </div>
      </Section>

      <Section title="Navigation sidebars — in use, and the reference configurations">
        <NavBarsDemo />
      </Section>



      <Section title="Viewports — transform gizmo, navigation cube, camera chrome, imperative canvas">
        <Variant label="ViewportNavigationCube">
        <div
          style={{
            position: "relative",
            width: 420,
            height: 190,
            maxWidth: "100%",
            borderRadius: 8,
            overflow: "hidden",
            background: "var(--aether-color-bg-shell)",
          }}
        >
          <ViewportNavigationCube
            orientation={[0.12, 0.34, 0.04, 0.93]}
            onSelectView={(view) => setStateMessage(`Standard view: ${view}`)}
            onFit={() => setStateMessage("Fit isometric view")}
            onNudge={(horizontal, vertical) =>
              setStateMessage(`Nudge view: ${horizontal}, ${vertical}`)
            }
            onRoll={(quarterTurns) =>
              setStateMessage(`Roll view: ${quarterTurns} quarter turn`)
            }
          />
        </div>
        </Variant>
        <Variant label="ViewportCanvas (imperative mount)">
        <ViewportCanvas
          style={{ width: 420, height: 140 }}
          onMount={(canvas) => {
            const context = canvas.getContext("2d");
            let frame = 0;
            let running = true;
            const draw = () => {
              if (!running || !context) return;
              const { width, height } = canvas.getBoundingClientRect();
              canvas.width = width;
              canvas.height = height;
              context.fillStyle = "#14181e";
              context.fillRect(0, 0, width, height);
              context.strokeStyle = "#3abaf3";
              context.beginPath();
              for (let x = 0; x < width; x++) {
                const y =
                  height / 2 + Math.sin(x / 24 + frame / 20) * height * 0.3;
                x === 0 ? context.moveTo(x, y) : context.lineTo(x, y);
              }
              context.stroke();
              frame += 1;
              requestAnimationFrame(draw);
            };
            draw();
            return () => {
              running = false;
            };
          }}
        />
        </Variant>
      </Section>

      <Section title="Status bar — every variant side by side">
        <Variant label="ApplicationStatusBar · standard window footer">
          <div style={{ width: 760, maxWidth: "100%" }}>
            <ApplicationStatusBar appName="Aether CAD" companyName="Jenkins Robotics" connection="connected" connectionLabel="Connected · Local Studio" />
            <ApplicationStatusBar appName="Aether Map" companyName="Jenkins Robotics" connection="offline" />
            <ApplicationStatusBar appName="Aether Sketch" connection="local" />
          </div>
        </Variant>
        <Variant label="@aether/ui StatusBar">
        <div style={{ width: 420 }}>
          <StatusBar>
            <StatusDot kind="ok" />
            Engine ready · 26 parts · 0 mates
          </StatusBar>
        </div>
        </Variant>
        <KitStatusBarVariant />
      </Section>



      <Section title="Window layouts"><StandardWindowLayouts /></Section>

      <Section title="Workspaces — launchable concepts">
        <WorkspaceDemoDirectory />
      </Section>



      <Section title="Concept applications — launchable demos">
        <ConceptAppDirectory title="Choose a demo" />
      </Section>

      <Section title="System icons — one glyph pack for every Aether Studio app">
        <SystemIconBrowser />
      </Section>

      <Section title="App tool packs — illustrated tool icons, switchable per app">
        <ToolPackBrowser />
      </Section>

      <Section title="Application icons — core/assets/branding">
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {(["studio", "cad", "animation", "ui", "map", "sketch", "vector", "io", "drive"] as const).map((app) => (
            <div key={app} style={{ display: "grid", gap: 6, justifyItems: "center", font: "11px var(--aether-font-family)", color: "var(--aether-color-text-dim)" }}>
              <AppIcon app={app} size={44} />
              {app}
            </div>
          ))}
        </div>
        <FileIconsDemo />
      </Section>

      <Section title="Application header logos"><AppWordmarkSpecimens /></Section>

      <Section title="Themes — the theme pack">
        <ThemePackBrowser />
      </Section>
      </ShowcaseSections>
    </main>
  );
}

function GalleryApplication() {
  return <ShowcaseBrowser><Gallery /></ShowcaseBrowser>;
}

/** The native UI Dev browser, whole, as a launchable tool rather than a board nested in every tab. */
function NativeLibraryPage() {
  const applications = useSuiteApps();
  return <div className="gallery-application">
    <DocumentBar application={{ id: "ui", name: "Aether UI", apps: applications }} leading={<span>UI Dev browser</span>} viewControls={<WorkspaceWindowMenu />} />
    <div className="gallery-native-library"><NativeLibrary /></div>
  </div>;
}


function WorkspaceConceptWindow({ id }: { id: WorkspaceDemoID }) {
  return <WorkspaceDemoWindow id={id}>
    {id === "general" ? <GeneralWindowLayout />
      : id === "app-wireframe" ? <ThreeColumnWireframe />
      : id === "application" ? <ApplicationWindowLayout />
      : id === "sidebars" ? <TabbedSidebarDemo fullScreen />
      : id === "bottom-dock" ? <WorkspaceBottomDockDemo fullScreen />
      : id === "cad" ? <RibbonWorkspaceDemo fullScreen />
      : id === "properties" ? <PropertiesPanelSpecimen />
      : id === "resizable" ? <ResizableWorkspaceDemo />
      : id === "docking" ? <DockingWorkspaceDemo />
      : id === "home" ? <ComingSoonHome navigation="sidebar" id="gallery-vector-sidebar" name="Aether Vector" description="Precise paths and expressive shapes." icon={<AppIcon app="vector" size={36} />} artwork={<AppIcon app="vector" size={320} />} homeUrl="?demo=workspace&workspace=home" suiteUrl="/" suiteName="Aether Studio" />
      : <WorkspaceDemo />}
  </WorkspaceDemoWindow>;
}

const launchParams = new URLSearchParams(window.location.search);
const oldShowcase = legacyShowcaseLocation(window.location.search, window.location.pathname);
if (oldShowcase) history.replaceState(null, "", oldShowcase);
const requestedDemo = oldShowcase ? null : launchParams.get("demo");
if (requestedDemo) document.getElementById("root")!.dataset.demo = requestedDemo;
const workspaceDemo = WORKSPACE_DEMOS.find(item => item.id === launchParams.get("workspace"));
const inWorkspaceWindow = launchParams.get("presentation") === "window";
const returnToDemoApps = () => {
  if (inWorkspaceWindow) window.close();
  else window.location.href = demoAppsURL();
};
if (inWorkspaceWindow) {
  const app = conceptApps.find(item => new URL(item.url, location.href).searchParams.get("demo") === requestedDemo);
  if (app) document.title = `${app.name} · Aether UI`;
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {requestedDemo === "workspace" && workspaceDemo
      ? <WorkspaceConceptWindow id={workspaceDemo.id} />
      : requestedDemo === "application-splash"
      ? <SplashDemo />
      : requestedDemo === "properties-studio"
      ? <PropertiesPanelDemo onExit={returnToDemoApps} />
      : requestedDemo === "material-studio"
      ? <MaterialStudioDemo onExit={returnToDemoApps} />
      : requestedDemo === "wheel-navigation"
        ? <WheelReferenceDemo navigation onExit={returnToDemoApps} />
      : requestedDemo === "wheel-reference"
        ? <WheelReferenceDemo onExit={returnToDemoApps} />
      : requestedDemo === "wheel-studio"
        ? <WheelStudioDemo onExit={returnToDemoApps} />
      : requestedDemo === "spotlight-studio"
        ? <SpotlightStudioDemo onExit={returnToDemoApps} />
      : requestedDemo === "plasticity-studio"
      ? <PlasticityStudioDemo onExit={returnToDemoApps} />
      : requestedDemo === "sketch-studio" || requestedDemo === "map-studio" || requestedDemo === "io-studio"
      ? <ModelStudioAppDemo app={requestedDemo === "sketch-studio" ? "sketch" : requestedDemo === "map-studio" ? "map" : "io"} onExit={returnToDemoApps} />
      : requestedDemo === "avatar-studio"
      ? <AvatarStudioDemo onExit={returnToDemoApps} />
      : requestedDemo === "analytics-dashboard"
      ? <AnalyticsDemo onExit={returnToDemoApps} />
      : requestedDemo === "commerce-dashboard"
      ? <DashboardDemo onExit={returnToDemoApps} />
      : requestedDemo === "animation-studio"
      ? <AnimationStudioDemo onExit={returnToDemoApps} />
      : requestedDemo === "animation-mockup"
        ? <AnimationMockupApp onExit={returnToDemoApps} />
      : requestedDemo === "atlas-demo"
        ? <AtlasDemoApp onExit={returnToDemoApps} />
        : requestedDemo === "cad-workspace"
          ? <RibbonWorkspaceDemo fullScreen />
        : requestedDemo === "ui-dev"
          ? <NativeLibraryPage />
          : <GalleryApplication />}
  </StrictMode>
);
