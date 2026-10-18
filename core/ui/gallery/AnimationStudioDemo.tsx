import { useDemoSidebarDesign } from "./useDemoSidebarDesign";
import { SidebarDesignMenu } from "../src/SidebarDesignMenu";
import { StudioHardwareWorkspace, type PreviewMapping } from "./StudioHardwareWorkspace";
import { StudioRelationPreview } from "./StudioRelationPreview";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  AetherIcon,
  AppearanceToggle,
  Button,
  DataTable,
  Dialog,
  DocumentBar,
  FieldRow,
  IconButton,
  NumberField,
  PropertyGrid,
  SearchField,
  SegmentedControl,
  SelectField,
  StatusBar,
  StatusDot,
  StudioModeButton,
  Tree,
  WorkspaceShell,
  standardWorkspacePanels,
  WorkspaceWindowMenu,
  type DataTableColumn,
  type DataTableSort,
  type LayoutPreset,
  type WorkspacePanel,
  useScopedAetherTheme,
} from "../src/index";
import {
  defaultPanelLayouts,
  defaultRibbonSections,
  workspaces,
  type CenterView,
  type PartRow,
  type WorkspaceID,
} from "./AnimationStudioCatalog";
import { SuiteLauncher } from "./suite-apps";
import {
  StudioAnimateWorkspace,
  adjacentKeyframe,
  studioTimelineDurationS,
  type AnimateCenterView,
} from "./StudioAnimateWorkspace";
import { StudioNodeWorkspace, StudioShowWorkspace } from "./StudioShowWorkspace";
import { StudioCanvas2DWorkspace, StudioDesignWorkspace, StudioVRWorkspace, StudioDesignBrowser, StudioDesignInspector, type StudioDesignState } from "./StudioAdditionalWorkspaces";
import { UIDevToolRibbon } from "./UIDevToolRibbon";
import { AnimationStudioSettings } from "./AnimationStudioSettings";
import { useStudioMedia } from "./StudioMediaLibrary";
import { StudioMateInspector } from "./StudioMateInspector";
import { useStudioDemoDocument } from "./StudioDemoDocument";
import { useAnimationStudioPreference } from "./AnimationStudioPreferences";
import { AppearanceInspector, type AppearanceValue } from "../src/ConceptWidgets";
import { StudioModelPreview, createStudioCameraStore } from "./StudioModelPreview";
import { StudioViewPanel, StudioEnvironmentPanel, StudioPerformancePanel, StudioCollectionPanel } from "./StudioReferencePanels";
import "./AnimationStudioDemo.css";
import "./AnimationStudioChrome.css";

const LAYOUT_STORAGE_KEY = "aether.animation-studio.default-layout";
const PANELS_OUTER_EDGE_STORAGE_KEY = "aether.animation-studio.panels-on-outer-edge";

function savedLayoutPreset(): LayoutPreset {
  const value = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
  return value === "docked" || value === "canvas" || value === "floating" ? value : "floating";
}

function savedPanelsOnOuterEdge() {
  return window.localStorage.getItem(PANELS_OUTER_EDGE_STORAGE_KEY) === "true";
}

function updateSelection(current: ReadonlySet<string>, ids: readonly string[], mode: "single" | "toggle" | "range") {
  if (mode === "toggle") {
    const next = new Set(current);
    for (const id of ids) next.has(id) ? next.delete(id) : next.add(id);
    return next;
  }
  return new Set(ids);
}

type CharacterType = "3d" | "2d" | "vr";

function StageTabs({ active, characterType, onCharacterType, onSelect }: {
  active: WorkspaceID;
  characterType: CharacterType;
  onCharacterType: (type: CharacterType) => void;
  onSelect: (id: WorkspaceID) => void;
}) {
  const authorWorkspace: WorkspaceID = characterType === "3d" ? "modeling" : characterType === "2d" ? "canvas2d" : "vr";
  const [showNodes] = useAnimationStudioPreference("nodes-tab",false);
  const [showDesign] = useAnimationStudioPreference("design-tab",false);
  const primaryIDs: readonly WorkspaceID[] = ["assets", authorWorkspace, "animate", "show", "hardware", ...(showNodes ? ["nodes" as const] : []), ...(showDesign ? ["design" as const] : [])];
  const primary = primaryIDs.map((id) => workspaces.find((workspace) => workspace.id === id)!);
  return <div className="animation-stage-navigation" aria-label="Aether Animation Studio workspaces">
    <label className="animation-character-type">
      <AetherIcon name={characterType === "3d" ? "cube" : characterType === "2d" ? "layers" : "view"} />
      <select aria-label="Character type" value={characterType} onChange={(event) => { const type = event.target.value as CharacterType; onCharacterType(type); onSelect(type === "3d" ? "modeling" : type === "2d" ? "canvas2d" : "vr"); }}>
        <option value="3d">3D</option><option value="2d">2D</option><option value="vr">VR</option>
      </select>
    </label>
    <div className="animation-stage-tabs" role="tablist" aria-label="Authoring stages">
      {primary.map((workspace) => <button
        key={workspace.id}
        type="button"
        role="tab"
        aria-selected={active === workspace.id}
        title={workspace.purpose}
        className={active === workspace.id ? "animation-stage-tab animation-stage-tab--active" : "animation-stage-tab"}
        onClick={() => onSelect(workspace.id)}
      >
        <AetherIcon name={workspace.icon} />
        <span>{workspace.label}</span>
      </button>)}
    </div>
    <label className="animation-all-workspaces">
      <AetherIcon name="apps" />
      <select aria-label="All Aether workspaces" value={active} onChange={(event) => onSelect(event.target.value as WorkspaceID)}>
        <optgroup label="Product workspaces">
          {workspaces.filter((workspace) => workspace.id !== "ui-dev").map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.label}</option>)}
        </optgroup>
      </select>
    </label>
  </div>;
}

function PartState({ state }: { state: PartRow["state"] }) {
  return <span className={state === "Ready" ? "animation-part-state animation-part-state--ready" : "animation-part-state animation-part-state--warning"}>
    <span aria-hidden><AetherIcon name={state === "Ready" ? "circle-filled" : "circle-dashed"} /></span>{state}
  </span>;
}

function PartsTable({ parts, filter, selected, sort, onSelect, onSortChange, onActivate }: {
  parts: readonly PartRow[];
  filter: string;
  selected: ReadonlySet<string>;
  sort: DataTableSort | null;
  onSelect: (ids: readonly string[], mode: "single" | "toggle" | "range") => void;
  onSortChange: (sort: DataTableSort | null) => void;
  onActivate: (id: string) => void;
}) {
  const columns: readonly DataTableColumn<PartRow>[] = [
    { id: "part", header: "PART", width: 720, minWidth: 280, sortable: true, resizable: true, pinned: true,
      sortValue: (row) => row.part, cell: (row) => <span className="animation-part-name"><span className="animation-part-icon"><AetherIcon name="cube" /></span>{row.part}</span> },
    { id: "source", header: "SOURCE", width: 240, minWidth: 160, sortable: true, resizable: true,
      sortValue: (row) => row.source, cell: (row) => <span className={row.state === "Disconnected" ? "animation-source-warning" : undefined}>{row.source}</span> },
    { id: "version", header: "VERSION", width: 80, sortable: true, sortValue: (row) => row.version,
      cell: (row) => <span className="animation-version">{row.version}</span> },
    { id: "parent", header: "PARENT", width: 160, sortable: true, resizable: true,
      sortValue: (row) => row.parent, cell: (row) => row.parent },
    { id: "state", header: "STATE", width: 130, sortable: true, sortValue: (row) => row.state,
      cell: (row) => <PartState state={row.state} /> },
  ];
  return <DataTable
    ariaLabel="Character parts"
    className="animation-parts-table"
    rows={parts}
    rowID={(row) => row.id}
    columns={columns}
    selectedIDs={selected}
    onSelect={onSelect}
    sort={sort}
    onSortChange={onSortChange}
    filter={filter}
    filterText={(row) => `${row.part} ${row.source} ${row.state}`}
    onActivate={onActivate}
    virtualizeThreshold={100}
  />;
}

function AssetsSurface({ parts, filter, selected, sort, view, onFilter, onSelect, onSortChange, onView, onImport, onActivate }: {
  parts: readonly PartRow[];
  filter: string;
  selected: ReadonlySet<string>;
  sort: DataTableSort | null;
  view: CenterView;
  onFilter: (value: string) => void;
  onSelect: (ids: readonly string[], mode: "single" | "toggle" | "range") => void;
  onSortChange: (sort: DataTableSort | null) => void;
  onView: (view: CenterView) => void;
  onImport: () => void;
  onActivate: (id: string) => void;
}) {
  return <div className="animation-assets-stage" data-assets-view={view}>
    <section className="animation-assets-panel" aria-label="Active character parts">
      <header className="animation-collection-header">
        <div><span>ACTIVE CHARACTER</span><strong>Parts</strong></div>
        <div className="animation-collection-actions">
          <SearchField ariaLabel="Filter parts" value={filter} onQueryChange={onFilter} placeholder="Filter" />
          <Button onClick={onImport}><AetherIcon name="plus" /> Import</Button>
        </div>
      </header>
      <div className="animation-collection-body">
        {view === "table" ? <PartsTable parts={parts} filter={filter} selected={selected} sort={sort}
          onSelect={onSelect} onSortChange={onSortChange} onActivate={onActivate} /> : null}
        {view === "gallery" ? <div className="animation-part-gallery">
          {parts.filter((part) => `${part.part} ${part.source}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase())).map((part) =>
            <button key={part.id} type="button" className={selected.has(part.id) ? "animation-part-card animation-part-card--selected" : "animation-part-card"}
              onClick={() => onSelect([part.id], "single")} onDoubleClick={() => onActivate(part.id)}>
              <span className="animation-part-card-preview"><AetherIcon name="cube" /></span>
              <strong>{part.part}</strong><small>{part.source}</small><PartState state={part.state} />
            </button>)}
        </div> : null}
        {view === "three-d" ? <div className="animation-asset-preview">
          <div className="animation-preview-grid" aria-hidden />
          <div className="animation-preview-object"><AetherIcon name="assembly" /></div>
          <strong>Character assembly preview</strong>
          <span>{selected.size || parts.length} {selected.size === 1 ? "part selected" : "parts"}</span>
        </div> : null}
      </div>
    </section>
    <div className="animation-center-switcher">
      <SegmentedControl ariaLabel="Assets center view" value={view} onChange={(id) => onView(id as CenterView)}
        options={[
          { id: "three-d", label: "3D" },
          { id: "gallery", label: "Gallery" },
          { id: "table", label: "Table" },
        ]} />
    </div>
  </div>;
}

function NavigatorPanel({ workspace, parts, selectedPartID, onSelectPart }: { workspace: WorkspaceID; parts: readonly PartRow[]; selectedPartID?: string; onSelectPart: (id: string) => void }) {
  const nodes = workspace === "assets"
    ? [{ id: "character", label: "arcada001", icon: <AetherIcon name="file-character" />, children: [
      { id: "parts", label: "Parts", badge: String(parts.length), icon: <AetherIcon name="cube" />, children: parts.map((part) => ({id:part.id,label:part.part,icon:<AetherIcon name="cube"/>})) },
      { id: "sources", label: "Source Assets", badge: String(parts.length), icon: <AetherIcon name="import" /> },
      { id: "renders", label: "Renders", badge: "0", icon: <AetherIcon name="image" /> },
      { id: "assemblies", label: "Assemblies", badge: "1", icon: <AetherIcon name="assembly" /> },
      { id: "scripts", label: "Scripts", badge: "0", icon: <AetherIcon name="document" /> },
      { id: "animations", label: "Animations", badge: "3", icon: <AetherIcon name="animate" /> },
    ] }]
    : [{ id: "assembly", label: "Character Assembly", icon: <AetherIcon name="assembly" />, children: [
      ...parts.map((part) => ({id:part.id,label:part.part,icon:<AetherIcon name="cube"/>})),
      { id: "mates", label: "Mates", badge: "3", icon: <AetherIcon name="mate" />, children: [
        { id: "mate-pan", label: "Pan · revolute", icon: <AetherIcon name="revolute" /> },
        { id: "mate-tilt", label: "Tilt · revolute", icon: <AetherIcon name="revolute" /> },
      ] },
    ] }];
  return <div className="animation-panel-content"><div className="animation-panel-title">Navigator</div>
    <Tree ariaLabel="Studio navigator" nodes={nodes} selectedIDs={selectedPartID ? new Set([selectedPartID]) : new Set()}
      onSelect={(ids) => { if (ids[0]) onSelectPart(ids[0]); }} />
  </div>;
}

function InspectorPanel({ part, onPosition }: { part?: PartRow; onPosition: (axis: number, value: number) => void }) {
  return <div className="animation-panel-content animation-inspector">
    <div className="animation-panel-title">Inspector</div>
    <PropertyGrid ariaLabel="Studio inspector" sections={[
      { id: "identity", label: "Identity", properties: [
        { id: "name", label: "Name", editor: part?.part ?? "Nothing selected", readOnly: true },
        { id: "source", label: "Source", editor: part?.source ?? "—", readOnly: true },
      ] },
      { id: "transform", label: "Transform", properties: [
        { id: "x", label: "Position X", editor: <NumberField aria-label="Part position X" value={part?.positionMM?.[0] ?? 0} disabled={!part} unit="mm" onValueChange={(value)=>onPosition(0,value ?? 0)} /> },
        { id: "y", label: "Position Y", editor: <NumberField aria-label="Part position Y" value={part?.positionMM?.[1] ?? 0} disabled={!part} unit="mm" onValueChange={(value)=>onPosition(1,value ?? 0)} /> },
        { id: "z", label: "Position Z", editor: <NumberField aria-label="Part position Z" value={part?.positionMM?.[2] ?? 0} disabled={!part} unit="mm" onValueChange={(value)=>onPosition(2,value ?? 0)} /> },
      ] },
      { id: "appearance", label: "Appearance", properties: [
        { id: "material", label: "Material", editor: <SelectField defaultValue="source" options={[{ value: "source", label: "From source" }, { value: "override", label: "Override" }]} /> },
      ] },
    ]} />
  </div>;
}

export function AnimationStudioDemo({ onExit }: { onExit?: () => void }) {
  useEffect(() => {
    globalThis.document.documentElement.classList.add("aether-animation-studio-active");
    return () => globalThis.document.documentElement.classList.remove("aether-animation-studio-active");
  }, []);
  const [designPreset] = useAnimationStudioPreference<string>("design-preset","Standard");
  const [accentColor] = useAnimationStudioPreference("accent-color","#4c9dff");
  // The session presents in the pack's Aether Studio theme (Midnight for High Contrast); the custom accent rides on top.
  useScopedAetherTheme(designPreset === "High Contrast" ? "midnight" : "aether-studio");
  useEffect(()=>{
    const root=globalThis.document.documentElement;
    const accent=["--aether-color-accent","--aether-color-accent-strong","--aether-color-accent-icon","--aether-color-bg-selected","--aether-color-border-focus","--aether-color-selection-edge"];
    for(const name of accent)root.style.setProperty(name,accentColor);
    root.dataset.animationDesignPreset=designPreset;
    return ()=>{for(const name of accent)root.style.removeProperty(name);delete root.dataset.animationDesignPreset;};
  },[accentColor,designPreset]);
  const [preset, setPreset] = useState<LayoutPreset>(savedLayoutPreset);
  const [sidebarDesign, setSidebarDesign] = useDemoSidebarDesign("animation-studio");
  const [panelsOnOuterEdge, setPanelsOnOuterEdge] = useState(savedPanelsOnOuterEdge);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPane, setSettingsPane] = useState<string>();
  const cameraStore=useRef(createStudioCameraStore());
  const [cameraRequest,setCameraRequest] = useState<{command:string;serial:number}>();
  const [panelLayouts, setPanelLayouts] = useState(defaultPanelLayouts);
  const [workspace, setWorkspace] = useState<WorkspaceID>("assets");
  const [characterType, setCharacterType] = useState<CharacterType>("3d");
  const [ribbonSections, setRibbonSections] = useState(defaultRibbonSections);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const document = useStudioDemoDocument();
  const {parts, update:setParts} = document;
  const [partColor,setPartColor] = useAnimationStudioPreference<string>("neutral-color","#9dcfed");
  const [partOpacity,setPartOpacity] = useAnimationStudioPreference<number>("part-opacity",100);
  const [partTessellation,setPartTessellation] = useAnimationStudioPreference<"auto"|"high">("part-tessellation","auto");
  const appearance=useMemo<AppearanceValue>(()=>({color:partColor,opacity:partOpacity,tessellation:partTessellation}),[partColor,partOpacity,partTessellation]);
  const setAppearance=(next:AppearanceValue)=>{setPartColor(next.color);setPartOpacity(next.opacity);setPartTessellation(next.tessellation);};
  const [modelView, setModelView] = useState("three-d");
  const [designState,setDesignState]=useState<StudioDesignState>({shapes:[],selected:null});
  const [fileOpen,setFileOpen] = useState(false);
  const [guideOpen,setGuideOpen] = useState(false);
  const [newCharacter,setNewCharacter] = useState<CharacterType | null>(null);
  const [characterName,setCharacterName] = useState("New Character");
  const [projectName,setProjectName] = useAnimationStudioPreference<string>("concept-name","est");
  const [mappingOpen,setMappingOpen] = useState(false);
  const [mateOpen,setMateOpen] = useState(false);
  const [showGrid,setShowGrid] = useAnimationStudioPreference<boolean>("floor-grid",true);
  const [showTimeline,setShowTimeline] = useState(true);
  const media=useStudioMedia();
  const [showStatusBar] = useAnimationStudioPreference("status-bar",true);
  const [showSafeArea] = useAnimationStudioPreference("safe-area",false);
  const [partFilter, setPartFilter] = useState("");
  const [partSelection, setPartSelection] = useState<ReadonlySet<string>>(new Set());
  const [mappings,setMappings]=useState<PreviewMapping[]>([]);
  const [relationKind,setRelationKind]=useState<string|null>(null);
  const [partSort, setPartSort] = useState<DataTableSort | null>(null);
  const [centerView, setCenterView] = useState<CenterView>("table");
  const [importOpen, setImportOpen] = useState(false);
  const [importName, setImportName] = useState("new_part.step");
  const [status, setStatus] = useState("Ready");
  const [animateTimeS, setAnimateTimeS] = useState(0);
  const [showTimeS, setShowTimeS] = useState(8);
  const [playing, setPlaying] = useState(false);
  const [looping, setLooping] = useState(true);
  const [timelineFramesPerSecond, setTimelineFramesPerSecond] = useAnimationStudioPreference<number>("default-fps",30);
  const [animateCenterView, setAnimateCenterView] = useState<AnimateCenterView>("dope-sheet");
  const [selectedKey, setSelectedKey] = useState<{ trackID: string; index: number } | null>(null);

  useEffect(() => {
    if (!playing || (workspace !== "animate" && workspace !== "show" && workspace !== "nodes")) return;
    const interval = window.setInterval(() => {
      if (workspace === "animate") {
        setAnimateTimeS((current) => {
          const next = current + 1 / timelineFramesPerSecond;
          if (next < studioTimelineDurationS) return next;
          if (looping) return 0;
          setPlaying(false);
          return studioTimelineDurationS;
        });
      } else {
        setShowTimeS((current) => current + 1 / timelineFramesPerSecond >= 30 ? 0 : current + 1 / timelineFramesPerSecond);
      }
    }, 1000 / timelineFramesPerSecond);
    return () => window.clearInterval(interval);
  }, [looping, playing, timelineFramesPerSecond, workspace]);

  const selectedPart = parts.find((part) => partSelection.has(part.id));
  const changePreset = (next: LayoutPreset) => {
    setPreset(next);
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, next);
    setStatus(`${next[0].toUpperCase()}${next.slice(1)} Studio layout`);
  };
  const changePanelsOnOuterEdge = (enabled: boolean) => {
    setPanelsOnOuterEdge(enabled);
    window.localStorage.setItem(PANELS_OUTER_EDGE_STORAGE_KEY, String(enabled));
  };
  const selectWorkspace = (id: WorkspaceID) => {
    setWorkspace(id);
    if (id === "modeling") setCharacterType("3d");
    if (id === "canvas2d") setCharacterType("2d");
    if (id === "vr") setCharacterType("vr");
    setActiveTool(null);
    setStatus(`${workspaces.find((entry) => entry.id === id)?.label} workspace`);
  };
  const runCommand = (id: string, label: string) => {
    if (id.startsWith("character-")) {setNewCharacter(id.slice(10) as CharacterType);return;}
    if (workspace === "assets" && ["image","audio","video"].includes(id)) {media.choose(id);setPanelLayouts((current)=>({...current,[preset]:{...current[preset],media:{placement:preset === "docked" ? "docked" : "floating"}}}));return;}
    if (workspace === "hardware" && ["map-dof","range","reverse"].includes(id)) {setMappingOpen(true);return;}
    if (workspace === "modeling" && ["gear","rack","screw","linear"].includes(id)) {setRelationKind(id);return;}
    if (workspace === "modeling" && ["fastened","parallel","revolute","slider","cylindrical","pin-slot","planar","ball","width","tangent"].includes(id)) {setActiveTool(id);setMateOpen(true);return;}
    if (workspace === "modeling" && ["box","sphere","cylinder","empty-point","locator"].includes(id)) { const partID=crypto.randomUUID();setParts((current)=>[...current,{id:partID,part:label,source:"Local sample primitive",version:"V1",parent:"Character origin",state:"Ready",primitive:id}]);setPartSelection(new Set([partID]));return; }
    if (id === "grid" || id === "show-grid") {setShowGrid(!showGrid);return;}
    if (id === "timeline" || id === "show-timeline") {setShowTimeline(!showTimeline);return;}
    if (id === "frame") {setAnimateCenterView("three-d");setStatus("Frame sample rig");return;}
    if (workspace === "assets" && (id === "model" || id === "character")) {
      setImportOpen(true);
      return;
    }
    if (id === "stop" || id === "show-stop") {
      setPlaying(false);
      (workspace === "show" || workspace === "nodes") ? setShowTimeS(0) : setAnimateTimeS(0);
    } else if (id === "play" || id === "preview" || id === "show-play") {
      setPlaying((current) => !current);
    } else if (id === "loop") {
      setLooping((current) => !current);
    } else if (id === "previous-key") {
      workspace === "show"
        ? setShowTimeS((current) => Math.max(0, current - 1))
        : setAnimateTimeS((current) => adjacentKeyframe(current, -1));
    } else if (id === "next-key") {
      workspace === "show"
        ? setShowTimeS((current) => Math.min(30, current + 1))
        : setAnimateTimeS((current) => adjacentKeyframe(current, 1));
    }
    setActiveTool((current) => current === id ? null : id);
    setStatus(`${label} · local concept`);
  };
  const addPart = () => {
    const filename = importName.trim() || "untitled.step";
    const stem = filename.replace(/\.[^.]+$/, "");
    const id = `part-${Date.now()}`;
    setParts((current) => [...current, {
      id, part: stem, source: filename, version: "V1", parent: "Character origin", state: "Ready",
    }]);
    setPartSelection(new Set([id]));
    setPartFilter("");
    setImportOpen(false);
    setStatus(`Imported ${filename}`);
  };

  const leftPanels: readonly WorkspacePanel[] = useMemo(() => workspace==="design" ? ["Documents","Features","Bodies","Mates"].map((title,index)=>({id:["navigator","collections","assemblies","clips"][index],title,icon:<AetherIcon name={index===3?"mate":"cube"}/>,content:<StudioDesignBrowser title={title} value={designState} onChange={setDesignState}/>})) : [
    { id: "navigator", title: "Characters", icon: <AetherIcon name="file-character" />,
      content: <NavigatorPanel parts={parts} workspace={workspace} selectedPartID={selectedPart?.id} onSelectPart={(id) => setPartSelection(new Set([id]))} /> },
    { id: "collections", title: "Parts", icon: <AetherIcon name="cube" />, content: <NavigatorPanel parts={parts} workspace={workspace} selectedPartID={selectedPart?.id} onSelectPart={(id) => setPartSelection(new Set([id]))} /> },
    { id: "media", title: "Media", icon: <AetherIcon name="image" />, content: media.content },
    { id: "assemblies", title: "Assemblies", icon: <AetherIcon name="assembly" />, content: <StudioCollectionPanel kind="Assemblies"/> },
    { id: "scripts", title: "Scripts", icon: <AetherIcon name="document" />, content: <StudioCollectionPanel kind="Scripts"/> },
    { id: "clips", title: "Animations", icon: <AetherIcon name="animate" />, content: <StudioCollectionPanel kind="Animations" onOpen={()=>selectWorkspace("animate")}/> },
  ], [selectedPart?.id, workspace, parts, media.content, designState]);
  const rightPanels: readonly WorkspacePanel[] = useMemo(() => [
    { id: "view", title: "View", icon: <AetherIcon name="view" />, content: <StudioViewPanel canFrame={!!selectedPart} onCamera={command=>{setModelView("three-d");selectWorkspace("modeling");setCameraRequest({command,serial:Date.now()});}} onSettings={()=>{setSettingsPane("navigation");setSettingsOpen(true);}}/> },
    { id: "environment", title: "Environment", icon: <AetherIcon name="lighting" />, content: <StudioEnvironmentPanel appearance={appearance} onAppearance={setAppearance}/> },
    { id: "appearance", title: "Appearance", icon: <AetherIcon name="palette" />, content: <AppearanceInspector value={appearance} onChange={setAppearance}/> },
    { id: "performance", title: "Performance", icon: <AetherIcon name="gauge" />, content: <StudioPerformancePanel/> },
    { id: "inspector", title: "Inspector", icon: <AetherIcon name="settings" />, content: workspace==="design" ? <StudioDesignInspector value={designState} onChange={setDesignState}/> : <InspectorPanel part={selectedPart} onPosition={(axis,value)=>setParts((current)=>current.map((part)=>{if(part.id !== selectedPart?.id)return part;const positionMM:[number,number,number]=[...(part.positionMM ?? [0,0,0])];positionMM[axis]=value;return {...part,positionMM};}))} /> },
  ], [selectedPart, appearance, workspace, designState]);

  return <div className="animation-studio" data-layout={preset} data-framed-content={workspace !== "modeling" || modelView === "table"} data-panels-outer-edge={panelsOnOuterEdge || undefined} data-safe-area={showSafeArea} data-preview-grid={showGrid} data-preview-timeline={showTimeline}>
    {media.fileInput}
    <DocumentBar
      windowChrome
      leading={<div className="animation-document-leading">
        <SuiteLauncher currentID="animation" />
        <IconButton label="Return to Aether UI gallery" onClick={onExit}><AetherIcon name="home" /></IconButton>
        <strong className="animation-project-name">{projectName}</strong>
        <span className="animation-save-state">{document.saved ? "SAVED" : "UNSAVED"}</span>
        <span className="animation-header-divider" />
        <IconButton label="Aether Animation Studio settings" onClick={() => setSettingsOpen(true)}><AetherIcon name="settings" /></IconButton>
        <IconButton label="Project file commands" onClick={() => setFileOpen(true)}><AetherIcon name="document" /></IconButton>
        <IconButton label="Save project" onClick={document.save}><AetherIcon name="save" /></IconButton>
        <IconButton label="Undo" disabled={!document.canUndo} onClick={document.undo}><AetherIcon name="undo" /></IconButton>
        <IconButton label="Redo" disabled={!document.canRedo} onClick={document.redo}><AetherIcon name="redo" /></IconButton>
      </div>}
      center={<StageTabs active={workspace} characterType={characterType}
        onCharacterType={(type) => { setCharacterType(type); setStatus(`${type.toUpperCase()} character authoring`); }}
        onSelect={selectWorkspace} />}
      trailing={<div className="animation-document-trailing">
        <button type="button" className="animation-engine-status" onClick={() => setGuideOpen(true)}><StatusDot kind="busy" /> Engine · demo <AetherIcon name="chevron-down" /></button>
        <Button className="animation-preview-button" onClick={() => { if (!["animate","show","nodes"].includes(workspace)) selectWorkspace("animate"); setPlaying((value) => !value); }}><AetherIcon name="play" />{playing ? "Pause" : "Preview"}</Button>
        <span className="animation-header-divider" />
        <StudioModeButton preset={preset} onChange={changePreset} />
        <SidebarDesignMenu value={sidebarDesign} onChange={setSidebarDesign} />
        <WorkspaceWindowMenu />
        <AppearanceToggle />
        <IconButton label="Workspace guide" onClick={() => setGuideOpen(true)}><AetherIcon name="help" /></IconButton>
      </div>}
    />
    <WorkspaceShell
      preset={preset}
      sidebarVariant={sidebarDesign}
      measureContentInsets
      panelsOnOuterEdge={panelsOnOuterEdge}
      preservePanelContent
      toolbar={<UIDevToolRibbon workspace={workspace} activeSection={ribbonSections[workspace]} activeTool={activeTool}
        onSection={(label) => setRibbonSections((current) => ({ ...current, [workspace]: label }))}
        onCommand={runCommand} />}
      leftPanels={standardWorkspacePanels(leftPanels, { features: "navigator" })}
      rightPanels={rightPanels}
      panelState={panelLayouts[preset]}
      onPanelStateChange={(state) => setPanelLayouts((current) => ({ ...current, [preset]: state }))}
      statusBar={showStatusBar ? <StatusBar
        leading={<><StatusDot kind="ok" /><strong>Aether Animation Studio</strong><span>{workspaces.find((entry) => entry.id === workspace)?.label}</span></>}
        center={status}
        trailing={<><span>Local concept preview</span><span>Studio Blue</span></>}
      /> : undefined}
      style={{ flex: 1, minHeight: 0 }}
    >
      {workspace === "assets" ? <AssetsSurface parts={parts} filter={partFilter} selected={partSelection} sort={partSort}
        view={centerView} onFilter={setPartFilter}
        onSelect={(ids, mode) => setPartSelection((current) => updateSelection(current, ids, mode))}
        onSortChange={setPartSort} onView={setCenterView} onImport={() => setImportOpen(true)}
        onActivate={(id) => setStatus(`Opened ${parts.find((part) => part.id === id)?.part ?? id}`)} /> : null}
      {workspace === "modeling" ? <div className="animation-modeling-workspace">
        {modelView === "table" ? <section className="animation-rig-table"><header className="animation-collection-header"><strong>Rig Table</strong><span>{parts.length} parts</span><SearchField ariaLabel="Filter rig parts" value={partFilter} onQueryChange={setPartFilter}/></header><PartsTable parts={parts} filter={partFilter} selected={partSelection} sort={partSort} onSelect={(ids,mode) => setPartSelection((current) => updateSelection(current,ids,mode))} onSortChange={setPartSort} onActivate={() => setModelView("three-d")}/></section> : <StudioModelPreview parts={parts} selectedID={selectedPart?.id} onSelect={(id) => setPartSelection(new Set([id]))} appearance={appearance} exploded={modelView === "exploded"} cameraRequest={cameraRequest} cameraStore={cameraStore.current}/>}
        <div className="animation-animate-switcher"><SegmentedControl ariaLabel="Modeling center view" value={modelView} onChange={setModelView} options={[{id:"three-d",label:"3D"},{id:"table",label:"Table"},{id:"exploded",label:"Exploded"}]}/></div>
      </div> : null}
      {workspace === "canvas2d" ? <StudioCanvas2DWorkspace /> : null}
      {workspace === "vr" ? <StudioVRWorkspace /> : null}
      {workspace === "animate" ? <StudioAnimateWorkspace
        mode={animateCenterView}
        timeS={animateTimeS}
        playing={playing}
        looping={looping}
        framesPerSecond={timelineFramesPerSecond}
        selectedKey={selectedKey}
        onModeChange={setAnimateCenterView}
        onSeek={setAnimateTimeS}
        onTogglePlay={() => setPlaying((current) => !current)}
        onStopPlayback={() => { setPlaying(false); setAnimateTimeS(0); }}
        onToggleLoop={() => setLooping((current) => !current)}
        onFramesPerSecondChange={setTimelineFramesPerSecond}
        onSelectKeyframe={setSelectedKey}
      /> : null}
      {workspace === "show" ? <StudioShowWorkspace timeS={showTimeS} playing={playing} onSeek={setShowTimeS} onTogglePlay={() => setPlaying((current) => !current)} /> : null}
      {workspace === "nodes" ? <StudioNodeWorkspace timeS={showTimeS} playing={playing} onSeek={setShowTimeS} onTogglePlay={() => setPlaying((current) => !current)} /> : null}
      {workspace === "hardware" ? <StudioHardwareWorkspace mappings={mappings} onChange={setMappings} editorOpen={mappingOpen} onEditorClose={()=>setMappingOpen(false)} onAdd={()=>setMappingOpen(true)}/> : null}
      {workspace === "design" ? <StudioDesignWorkspace activeTool={activeTool} value={designState} onChange={setDesignState}/> : null}
    </WorkspaceShell>
    <AnimationStudioSettings
      open={settingsOpen}
      initialPane={settingsPane}
      sidebarDesign={sidebarDesign}
      onSidebarDesignChange={setSidebarDesign}
      preset={preset}
      panelsOnOuterEdge={panelsOnOuterEdge}
      onPresetChange={changePreset}
      onPanelsOnOuterEdgeChange={changePanelsOnOuterEdge}
      onClose={() => {setSettingsOpen(false);setSettingsPane(undefined);}}
    />
    <Dialog open={newCharacter !== null} title="New character" onClose={() => setNewCharacter(null)} actions={<><Button onClick={() => setNewCharacter(null)}>Cancel</Button><Button primary disabled={!characterName.trim()} onClick={() => {setProjectName(characterName.trim());selectWorkspace(newCharacter === "2d" ? "canvas2d" : newCharacter === "vr" ? "vr" : "modeling");setNewCharacter(null);}}>Create Character</Button></>}>
      <FieldRow label="Name"><input aria-label="Character name" value={characterName} onChange={(event)=>setCharacterName(event.target.value)}/></FieldRow><p>{newCharacter?.toUpperCase()} character · local concept preview</p>
    </Dialog>
    <Dialog open={mateOpen} title="Mate configuration" onClose={()=>setMateOpen(false)}><StudioMateInspector key={activeTool} kind={activeTool ?? "slider"} onApply={()=>{setMateOpen(false);setStatus("Mate configuration preview accepted");}} onCancel={()=>setMateOpen(false)}/></Dialog>
    <Dialog open={relationKind!==null} title="Advanced relation" onClose={()=>setRelationKind(null)}>{relationKind && <StudioRelationPreview key={relationKind} kind={relationKind} onCancel={()=>setRelationKind(null)} onApply={value=>{setStatus(`${value.driver} → ${value.driven} · local relation preview accepted`);setRelationKind(null);}}/>}</Dialog>
    <Dialog open={fileOpen} title="Concept project" onClose={() => setFileOpen(false)} actions={<Button onClick={() => setFileOpen(false)}>Done</Button>}>
      <p>Parts are autosaved in this browser. Download a copy to keep outside browser storage.</p>
      <Button onClick={document.download}>Download concept project</Button>
    </Dialog>
    <Dialog open={guideOpen} title="Aether Animation Studio concept guide" onClose={() => setGuideOpen(false)} actions={<Button onClick={() => setGuideOpen(false)}>Close</Button>}>
      <p>Explore nine product workspaces using the workspace selector. UI Dev specimens now live in the Aether UI showcase. Panels support Floating, Docked, and Canvas modes; choose toolbar density and shape from its menu or Settings.</p>
      <p>This launchable UI concept uses local sample data. It is not connected to Aether Core, hardware, or a CAD importer. Tools that were planned in the native reference remain unavailable.</p>
    </Dialog>
    <Dialog open={importOpen} title="Import 3D model" onClose={() => setImportOpen(false)}
      actions={<><Button onClick={() => setImportOpen(false)}>Cancel</Button><Button primary onClick={addPart}>Import</Button></>}>
      <div className="animation-import-dialog">
        <p>Add a model to the active character. This concept keeps the interaction local to the gallery.</p>
        <FieldRow label="Source file" htmlFor="animation-import-name">
          <input id="animation-import-name" value={importName} onChange={(event) => setImportName(event.target.value)} />
        </FieldRow>
        <FieldRow label="Units">
          <SelectField defaultValue="mm" options={[{ value: "mm", label: "Millimeters" }, { value: "cm", label: "Centimeters" }, { value: "m", label: "Meters" }]} />
        </FieldRow>
      </div>
    </Dialog>
  </div>;
}
