import { useDemoSidebarDesign } from "./useDemoSidebarDesign";
import { SidebarDesignMenu } from "../src/SidebarDesignMenu";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AetherIcon, AppMark, AppearanceToggle, Button, FieldRow, NumberField, RibbonWorkspaceShell,
  StatusBar, StatusDot, StudioModeButton, ToolIcon, Tree, WorkspaceWindowMenu, openFeatureWindow,
  type FeatureWindow, type LayoutPreset, type ToolIconName, type WorkspaceRibbonCommand,
  type WorkspaceRibbonGroup, type WorkspaceRibbonTab,
} from "../src/index";
import { RibbonWorkspaceDemoViewport } from "./RibbonWorkspaceDemoViewport";
import { SuiteLauncher } from "./suite-apps";
import "./RibbonWorkspaceDemo.css";

const DEMO_ONLY = "Layout preview. Open Aether CAD to use this modeling tool.";
function tool(id: ToolIconName, label: string, enabled = false): WorkspaceRibbonCommand {
  return { id, label, icon: <ToolIcon name={id} width={30} height={30} />, disabled: !enabled, disabledReason: enabled ? undefined : DEMO_ONLY };
}
const group = (id: string, label: string, tools: WorkspaceRibbonCommand[]): WorkspaceRibbonGroup => ({ id, label, tools });
const viewTools = group("view", "View", [tool("fit", "Fit", true), tool("home", "Home view", true)]);
const modeling = group("modeling", "Modeling", [tool("sketch", "Sketch"), tool("inspect", "Section"), tool("extrude", "Extrude", true), tool("cut", "Cut"), tool("hole", "Hole")]);
const designTabs: WorkspaceRibbonTab[] = [
  { id: "home", label: "Home", groups: [viewTools, modeling] },
  { id: "solid", label: "Solid", groups: [modeling,
    group("editing", "Solid Editing", [tool("fillet", "Fillet"), tool("shell", "Shell"), tool("split", "Split"), tool("push-pull", "Push/Pull")]),
    group("reference", "Reference", [tool("plane", "Plane"), tool("axis", "Axis"), tool("point", "Point"), tool("curve", "Curve")]),
    group("shape", "Advanced Shape", [tool("draft", "Draft"), tool("thicken", "Thicken"), tool("pattern", "Pattern")]),
    group("transform", "Transform", [tool("move", "Move"), tool("mirror", "Mirror")]) ] },
  { id: "surface", label: "Surface", groups: [group("surfaces", "Surface", [tool("loft", "Loft"), tool("sweep", "Sweep"), tool("thicken", "Thicken")]), viewTools] },
  { id: "mesh", label: "Mesh", groups: [group("mesh", "Mesh", [tool("import", "Import mesh"), tool("move", "Move")]), viewTools] },
  { id: "sheet", label: "Sheet Metal", groups: [group("sheet", "Sheet Metal", [tool("thicken", "Thicken"), tool("cut", "Cut")])] },
  { id: "framing", label: "Framing", groups: [group("framing", "Framing", [tool("frame", "Frame"), tool("trim", "Trim")])] },
  { id: "plastic", label: "Plastic", groups: [group("plastic", "Plastic", [tool("shell", "Shell"), tool("draft", "Draft")])] },
  { id: "manage", label: "Manage", groups: [viewTools] },
  { id: "output", label: "Output", groups: [group("output", "Output", [tool("export", "Export")]), viewTools] },
];
const assemblyTabs: WorkspaceRibbonTab[] = [
  { id: "assembly", label: "Assembly", groups: [group("assembly", "Assembly", [tool("insert", "Insert"), tool("connector", "Mate"), tool("move", "Move")]), viewTools] },
  designTabs[8],
];

export function RibbonWorkspaceDemo({ fullScreen = false }: { fullScreen?: boolean }) {
  const [preset, setPreset] = useState<LayoutPreset>("docked");
  const [sidebarDesign, setSidebarDesign] = useDemoSidebarDesign("cad-workspace");
  const [workspace, setWorkspace] = useState("design");
  const [activeTabs, setActiveTabs] = useState({ design: "solid", assembly: "assembly" });
  const [selected, setSelected] = useState("extrude");
  const [depth, setDepth] = useState(18);
  const [draft, setDraft] = useState<number | null>(18);
  const [editorOpen, setEditorOpen] = useState(false);
  const [featureWindow, setFeatureWindow] = useState<FeatureWindow | null>(null);
  const [fitRequest, setFitRequest] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const draftRef = useRef(draft); draftRef.current = draft;
  useEffect(() => {
    if (!editorOpen || !viewport.current) return;
    const window = openFeatureWindow({ viewport: viewport.current, className: "ribbon-demo-feature-window",
      title: "Extrude", acceptLabel: "Accept sample extrude", discardLabel: "Discard sample extrude",
      onAccept: () => { if (draftRef.current !== null) { setDepth(draftRef.current); setEditorOpen(false); } },
      onDiscard: () => setEditorOpen(false),
    });
    setFeatureWindow(window);
    return () => { window.close(); setFeatureWindow(null); };
  }, [editorOpen]);
  useEffect(() => { featureWindow?.setError(draft === null ? "Enter a depth between 1 and 60 mm." : null); }, [draft, featureWindow]);
  const editExtrude = () => { setSelected("extrude"); setDraft(depth); setEditorOpen(true); };
  return <div className={fullScreen ? "ribbon-demo ribbon-demo--fullscreen" : "ribbon-demo"}>
    {!fullScreen ? <p className="ribbon-demo-description">CAD layout: workspace selector, tabbed tools, and a persistent viewport. Try Solid → Extrude, the view cube, or the header’s layout control.</p> : null}
    <RibbonWorkspaceShell className="ribbon-demo-frame" preset={preset} sidebarVariant={sidebarDesign}
      documentBar={{ windowChrome: false,
        leading: <><SuiteLauncher currentID="cad" /><AppMark app="cad" size={36} /><AetherIcon name="menu" /><strong>Part 1</strong><span className="ribbon-demo-muted">Main</span>
          <span className="ribbon-demo-divider" /><div className="aui-studio-chrome-group"><StudioModeButton preset={preset} onChange={setPreset} /><SidebarDesignMenu value={sidebarDesign} onChange={setSidebarDesign} /><WorkspaceWindowMenu /><AppearanceToggle /></div></>,
        trailing: <span className="ribbon-demo-muted">Layout preview</span>,
      }}
      ribbon={{ workspaceID: workspace, workspaces: [{ id: "design", label: "Design" }, { id: "assembly", label: "Assembly" }],
        onWorkspaceSelect: setWorkspace, tabs: workspace === "design" ? designTabs : assemblyTabs,
        activeTabID: activeTabs[workspace as keyof typeof activeTabs],
        onTabSelect: (id) => setActiveTabs((current) => ({ ...current, [workspace]: id })),
        onCommand: (id) => { if (id === "extrude") editExtrude(); else setFitRequest((value) => value + 1); },
      }}
      defaultOpenLeft={["features"]} defaultOpenRight={[]}
      leftPanels={[{ id: "features", title: "Features", icon: <AetherIcon name="items" />, content: <>
        <Tree ariaLabel="Sample feature tree" nodes={[
          { id: "origin", label: "Origin", icon: <ToolIcon name="axis" width={18} height={18} />, children: [
            { id: "top", label: "Top", icon: <ToolIcon name="plane" width={18} height={18} /> },
            { id: "front", label: "Front", icon: <ToolIcon name="plane" width={18} height={18} /> },
            { id: "right", label: "Right", icon: <ToolIcon name="plane" width={18} height={18} /> },
          ] },
          { id: "sketch", label: "Sketch 1", icon: <ToolIcon name="sketch" width={18} height={18} /> },
          { id: "extrude", label: "Extrude 1", icon: <ToolIcon name="extrude" width={18} height={18} /> },
          { id: "bodies", label: "Bodies", icon: <AetherIcon name="folder" />, children: [{ id: "part", label: "Part 1", icon: <ToolIcon name="part" width={18} height={18} /> }] },
        ]} selectedIDs={new Set([selected])} onSelect={(ids) => setSelected(ids[0] ?? "")}
          onActivate={(id) => { if (id === "extrude") editExtrude(); }} />
      </> }]}
      rightPanels={[{ id: "properties", title: "Properties", icon: <AetherIcon name="settings" />, content:
        <div className="ribbon-demo-properties"><strong>Part 1</strong><span>Extrude depth: {depth} mm</span>
          <Button onClick={editExtrude}>Edit extrude</Button><p className="ribbon-demo-muted">Sample geometry for exploring the workspace controls.</p></div>,
      }]}
      statusBar={<StatusBar leading={<><StatusDot kind="ok" /><span>Sample part</span></>} center="Drag to orbit · scroll to zoom" trailing={<span>mm · {preset}</span>} />}
    >
      <div ref={viewport} className="ribbon-demo-viewport">
        <RibbonWorkspaceDemoViewport depth={editorOpen ? draft ?? depth : depth} fitRequest={fitRequest} />
        {featureWindow && createPortal(<>
          <div className="aui-feature-entities"><span className="aui-feature-entities-caption">Profile</span><span>Sketch 1</span></div>
          <FieldRow label="Depth" htmlFor="ribbon-demo-depth"><NumberField id="ribbon-demo-depth" value={draft} min={1} max={60} unit="mm" onValueChange={setDraft} /></FieldRow>
          <p className="ribbon-demo-muted">Adjust the sample part to preview a feature window.</p>
        </>, featureWindow.body)}
      </div>
    </RibbonWorkspaceShell>
  </div>;
}
