import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from "react";
import { AetherIcon, Button, Dialog, DockPanel, FloatingToolbar, FloatingToolbarMenu, IconButton, Menu, PanelResizeHandle, TabbedSidebar, useScopedAetherTheme, type MenuItem } from "../../src";
import { useDemoDocument } from "../demo-document/useDemoDocument";
import { validateModelParts } from "./model-file";
import { PlasticityViewport, type CameraView, type Plane, type Tool } from "./PlasticityViewport";
import { ModelBrowser, ModelMaterials, ModelProperties, ModelViews, applyTransform } from "./PlasticityWidgets";
import { CREATE_TOOLS, freshHistory, identity, sceneReducer, type ModelPart, type Shape, type Vector } from "./state";
import { ModelChatPanel } from "./ModelWorkspacePanels";
import { ModelPartsFooter } from "./ModelPartsFooter";
import { ModelCommentsPanel, ModelVersionControlPanel } from "./ModelReviewPanels";
import { ModelViewTools, type SectionSettings } from "./ModelViewTools";
import { ModelMeasurePopup } from "./ModelMeasurePopup";
import { ModelStudioHeader } from "./ModelStudioHeader";
import { ModelPositionReadout } from "./ModelPositionReadout";
import { DEFAULT_RENDER_SETTINGS, MODEL_WORKSPACES, ModelWorkspaceControls, type ModelWorkspace } from "./ModelWorkspaceControls";
import { modelStudioFeatureSample } from "../../src/model-studio-assets";
import { modelFeatures, previewParts } from "./feature-model";
import "./plasticity-studio.css";

const TRANSFORM_TOOLS = [{ id: "select", label: "Select", icon: "cursor" }, { id: "translate", label: "Move", icon: "move" }, { id: "rotate", label: "Rotate", icon: "rotate" }, { id: "scale", label: "Scale", icon: "scale" }] as const;
const DEMO_ITEMS: MenuItem[] = [
  { id: "cad-source", label: "Download CAD feature model…", icon: <AetherIcon name="export"/> },
  { id: "reset", label: "Reset robot study", icon: <AetherIcon name="undo"/> },
  { id: "about", label: "About this concept" },
  { id: "exit", label: "Back to demo apps", icon: <AetherIcon name="arrow-left"/> },
];
export function PlasticityStudioDemo({ onExit }: { onExit?: () => void }) {
  useScopedAetherTheme("aether-slate", "dark");
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Aether Model Studio";
    return () => { document.title = previousTitle; };
  }, []);
  const [history, dispatch] = useReducer(sceneReducer, undefined, freshHistory), parts = history.present;
  const [rollbackIndex,setRollbackIndex] = useState(modelFeatures.length);
  const evaluatedParts = useMemo(()=>previewParts(parts,rollbackIndex),[parts,rollbackIndex]);
  const [sourceDialog,setSourceDialog] = useState(false);
  const [selected, setSelected] = useState("vents"), [tool, setTool] = useState<Tool>("select");
  const [query, setQuery] = useState(""), [notice, setNotice] = useState("Drag to orbit · Scroll to zoom · Right-click for actions");
  const [workspace, setWorkspace] = useState<ModelWorkspace>("design"), [renderSettings, setRenderSettings] = useState({...DEFAULT_RENDER_SETTINGS});
  const [settings, setSettings] = useState({ grid: true, wireframe: false, edges: false });
  const [activeTab, setActiveTab] = useState<string | null>("properties"), [mobilePanel, setMobilePanel] = useState<"objects" | "inspector" | null>(null);
  const [view, setView] = useState<CameraView>("perspective"), [resetView, setResetView] = useState(0);
  const [plane, setPlane] = useState<Plane>({ kind: "", revision: 0 });
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null), [about, setAbout] = useState(false);
  const browserRef = useRef<HTMLDivElement>(null);
  const [browserWidth, setBrowserWidth] = useState<number | undefined>();
  const [showFooter, setShowFooter] = useState(true);
  const [leftPanel, setLeftPanel] = useState<"ai-chat" | "comments" | "revisions" | null>(null);
  const showChat = leftPanel === "ai-chat";
  const [section, setSection] = useState<SectionSettings>({ enabled: false, axis: "X", offset: 0, flipped: false });
  const [measuring, setMeasuring] = useState(false), [measurePoints, setMeasurePoints] = useState<Vector[]>([]);
  const updateSection = (value: SectionSettings) => { setSection(value); setMeasurePoints([]); };
  const appRef = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef<(() => string | undefined) | null>(null);
  const [versionSnapshot, setVersionSnapshot] = useState<string>();
  const [download, setDownload] = useState<string | null>(null);
  const counter = useRef(1), selectedPart = parts.find(part => part.id === selected);
  const edit = (next: ModelPart[]) => { dispatch({ type: "edit", parts: next }); setMeasurePoints([]); };
  const changePart = (part: ModelPart) => edit(parts.map(item => item.id === part.id ? part : item));
  const select = (id: string) => { setSelected(id); if (id) setNotice(`${parts.find(part => part.id === id)?.name ?? "Part"} selected`); };
  const documentFile = useDemoDocument({app:"model",initialName:"Scifirobot",data:parts,units:"centimeters",validate:validateModelParts,
    onOpen:values=>{dispatch({type:"open",parts:values});setRollbackIndex(modelFeatures.length);setMeasurePoints([]);setSelected(values[0]?.id??"");counter.current=Math.max(0,...values.map(value=>(Number.isSafeInteger(Number(value.id.split("-").at(-1)))?Number(value.id.split("-").at(-1)):0)))+1;setResetView(value=>value+1);setNotice("Local study opened");},
    onExport:()=>action("export"),onClose:()=>onExit?.(),demoItems:DEMO_ITEMS});
  function changeWorkspace(next: ModelWorkspace) {
    setWorkspace(next);
    if (next === "render") { setActiveTab("materials"); setMobilePanel("inspector"); }
    else if (next === "design") { setActiveTab("properties"); setMobilePanel(null); }
    else { setActiveTab(null); setMobilePanel(null); }
    setNotice(next === "simulation" ? "Simulation preview · No solver connected" : `${next === "render" ? "Render" : "Design"} workspace`);
  }
  function create(shape: Shape) {
    const id = `${shape}-${counter.current++}`, transform = identity(); transform.position = [220 + parts.filter(part=>part.shape !== "cad-body").length % 3 * 35, 0, 40];
    const name = `${shape[0].toUpperCase() + shape.slice(1)} ${counter.current - 1}`;
    edit([...parts, { id, name, shape, visible: true, color: "#b7c2c6", transform, locks: [] }]); setSelected(id); setTool("translate"); setMeasuring(false); setNotice(`${name} added · Drag a handle to position it`);
  }
  function action(id: string) {
    if (id === "revisions") setVersionSnapshot(snapshotRef.current?.());
    if (id === "cad-source") { setSourceDialog(true); return; }
    if (documentFile.run(id)) return;
    if (id.startsWith("workspace:")) { changeWorkspace(id.slice(10) as ModelWorkspace); setQuery(""); return; }
    if (TRANSFORM_TOOLS.some(item => item.id === id)) { setTool(id as Tool); setMeasuring(false); setMeasurePoints([]); setNotice(id === "select" ? "Select a part in the scene or object tree" : `${id === "translate" ? "Move" : id} · Drag a handle or edit the inspector`); }
    else if (CREATE_TOOLS.some(item => item.id === id)) create(id as Shape);
    else if (id === "undo" || id === "redo") { dispatch({ type: id }); setMeasurePoints([]); setNotice(id === "undo" ? "Undo" : "Redo"); }
    else if (id === "duplicate" && selectedPart) { const part = structuredClone(selectedPart); part.id = `copy-${counter.current++}`; part.name += " copy"; part.transform.position[0] += 60; part.locks = []; edit([...parts, part]); setSelected(part.id); setNotice(`${part.name} created`); }
    else if (id === "delete" && selectedPart) { edit(parts.filter(part => part.id !== selected)); setSelected(""); setNotice(`${selectedPart.name} removed · Undo to restore`); }
    else if (id === "visibility" && selectedPart) changePart({ ...selectedPart, visible: !selectedPart.visible });
    else if (id === "parts-footer") setShowFooter(value => !value);
    else if (id === "ai-chat" || id === "comments" || id === "revisions") setLeftPanel(value => value === id ? null : id);
    else if (id === "section") updateSection({ ...section, enabled: !section.enabled });
    else if (id === "measure") { setMeasuring(value => !value); setTool("select"); setMeasurePoints([]); }
    else if (id === "frame") { setResetView(value => value + 1); setNotice("Visible scene fitted to the workspace"); }
    else if (id === "grid" || id === "wireframe") setSettings(value => ({ ...value, [id]: !value[id] }));
    else if (id === "reset") { dispatch({ type: "reset" }); setRollbackIndex(modelFeatures.length); setMeasurePoints([]); setSelected("vents"); setTool("select"); setPlane(value => ({ kind: "", revision: value.revision + 1 })); setNotice("Original robot study restored"); }
    else if (id === "export") setDownload(URL.createObjectURL(new Blob([JSON.stringify({ format: "aether-model-studio-concept", version: 1, parts }, null, 2)], { type: "application/json" })));
    else if (id === "about") setAbout(true);
    else if (id === "exit") onExit?.();
    setQuery("");
  }
  const contextItems: MenuItem[] = [
    { id: "translate", label: "Move", shortcut: "G", icon: <AetherIcon name="move"/>, disabled: !selectedPart },
    { id: "rotate", label: "Rotate", shortcut: "R", icon: <AetherIcon name="rotate"/>, disabled: !selectedPart },
    { id: "scale", label: "Scale", shortcut: "S", icon: <AetherIcon name="scale"/>, disabled: !selectedPart },
    { id: "duplicate", label: "Duplicate", shortcut: "⇧D", separatorBefore: true, icon: <AetherIcon name="copy"/>, disabled: !selectedPart },
    { id: "visibility", label: selectedPart?.visible ? "Hide part" : "Show part", icon: <AetherIcon name="visible"/>, disabled: !selectedPart },
    { id: "delete", label: "Delete", shortcut: "⌫", icon: <AetherIcon name="delete"/>, disabled: !selectedPart },
  ];
  const currentAction = useRef(action); currentAction.current = action;
  useEffect(() => { const key = (event: KeyboardEvent) => {
    if (!(event.target instanceof HTMLElement) || event.target.closest('input,textarea,select,[contenteditable="true"],[role="dialog"],[role="menu"]')) return;
    let command = "";
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") command = event.shiftKey ? "redo" : "undo";
    else if (!event.metaKey && !event.ctrlKey && !event.altKey) command = event.key === "Escape" ? "select" : event.key === "Delete" || event.key === "Backspace" ? "delete" : event.shiftKey && event.key.toLowerCase() === "d" ? "duplicate" : ({ g: "translate", r: "rotate", s: "scale", v: "select", f: "frame" }[event.key.toLowerCase()] ?? "");
    if (command) { event.preventDefault(); currentAction.current(command); }
  }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, []);
  useEffect(() => () => { if (download) URL.revokeObjectURL(download); }, [download]);
  const commands = [...TRANSFORM_TOOLS, ...CREATE_TOOLS, { id: "parts-footer", label: "Toggle parts footer" }, { id: "ai-chat", label: "Toggle AI chat" }, { id: "duplicate", label: "Duplicate" }, { id: "frame", label: "Auto zoom" }, { id: "comments", label: "Toggle comments" }, { id: "revisions", label: "Toggle revisions" }, { id: "section", label: "Toggle section view" }, { id: "measure", label: "Toggle measure" }, { id: "undo", label: "Undo" }, { id: "redo", label: "Redo" }, { id: "delete", label: "Delete" }];
  const matches = query ? commands.filter(command => command.label.toLowerCase().includes(query.toLowerCase())) : [];
  const toggleActions = [
    { id: "comments", label: "Comments", icon: <AetherIcon name="comment"/>, pressed: leftPanel === "comments" },
    { id: "ai-chat", label: "AI chat", icon: <AetherIcon name="brain"/>, pressed: showChat },
    { id: "revisions", label: "Version control", icon: <AetherIcon name="version-control"/>, pressed: leftPanel === "revisions" },
    { id: "parts-footer", label: "Part list", icon: <AetherIcon name="mode-docked"/>, pressed: showFooter },
  ];
  const viewActions = [
    { id: "grid", label: "Ground grid", icon: <AetherIcon name="grid-3"/>, pressed: settings.grid },
    { id: "frame", label: "Auto zoom", icon: <AetherIcon name="fit"/> },
    { id: "section", label: "Section view", icon: <AetherIcon name="planes-axes"/>, pressed: section.enabled },
    { id: "measure", label: "Measure", icon: <AetherIcon name="ruler"/>, pressed: measuring },
  ];
  function closeMeasure() {
    setMeasuring(false); setMeasurePoints([]);
    requestAnimationFrame(() => appRef.current?.querySelector<HTMLButtonElement>('button[aria-label="Measure"]')?.focus());
  }
  return <div className="plasticity-studio ps-has-header aether-theme-model-studio aether-dark-theme" ref={appRef} data-chat-open={showChat}>
    <ModelStudioHeader name={documentFile.meta.name} workspaceName={documentFile.meta.workspaceName} onAction={action} commands={[
      ...MODEL_WORKSPACES.map(item => ({id:`workspace:${item.id}`,label:`Switch to ${item.label}`,category:"Workspace"})),
      ...commands.map(command => ({ id:command.id, label:command.label, category:"Modeling", disabled:(command.id === "undo" && !history.past.length) || (command.id === "redo" && !history.future.length) || (["translate","rotate","scale","duplicate","delete"].includes(command.id) && !selectedPart) })),
      ...documentFile.items.map(item => ({ id:item.id, label:item.label, category:"Document", disabled:item.disabled, disabledReason:item.disabledReason })),
    ]} />
    <aside className="ps-chat-sidebar" aria-label={showChat ? "AI chat sidebar" : leftPanel === "comments" ? "Comments sidebar" : "Version control sidebar"} hidden={!leftPanel}><div className="aui-float ps-aux-card"><DockPanel>
      <div className="ps-chat" hidden={!showChat}><ModelChatPanel parts={parts} selected={selectedPart}/></div>
      <div className="ps-review-content" hidden={leftPanel !== "comments"}><ModelCommentsPanel documentName={documentFile.meta.name} selected={selectedPart}/></div>
      <div className="ps-review-content" hidden={leftPanel !== "revisions"}><ModelVersionControlPanel activeBranch={documentFile.meta.workspaceName || "Main"} currentSnapshot={versionSnapshot} captureSnapshot={() => snapshotRef.current?.()}/></div>
    </DockPanel></div></aside>
    <div className="ps-workspace">
    <main className="ps-window" aria-label="Aether Model Studio workspace" data-mobile-panel={mobilePanel ?? "none"} style={browserWidth ? {"--ps-browser-width":`${browserWidth}px`} as CSSProperties:undefined}>
      <PlasticityViewport snapshotRef={snapshotRef} parts={evaluatedParts} selected={selected} tool={tool} settings={settings} render={renderSettings} section={section} measuring={measuring} measurePoints={measurePoints} onMeasure={point => setMeasurePoints(points => points.length === 1 ? [...points, point] : [point])} resetView={resetView} view={view} plane={plane} onSelect={select} onTransform={(id, transform) => { const part = parts.find(item => item.id === id); if (part) changePart(applyTransform(part, transform)); }} onContextMenu={(x, y) => setMenu({ x, y })}/>
      <div className="ps-left" ref={browserRef}>
        <div className="aui-float ps-browser"><DockPanel>
          <div className="ps-browser-content"><ModelBrowser parts={parts} evaluatedParts={evaluatedParts} rollbackIndex={rollbackIndex} onRollback={value=>{setRollbackIndex(value);setNotice(value === modelFeatures.length ? "Complete CAD model" : `CAD rollback preview · ${value} of ${modelFeatures.length} features`);}} onRename={(id,name)=>{const part=parts.find(item=>item.id===id);if(part)changePart({...part,name});}} selected={selected} onSelect={select} onVisibility={id => { const part = parts.find(item => item.id === id); if (part) changePart({ ...part, visible: !part.visible }); }}/></div>
        </DockPanel></div>
        <PanelResizeHandle edge="right" label="Resize feature panel" value={()=>browserRef.current?.getBoundingClientRect().width ?? 216} min={180} max={480} onChange={setBrowserWidth} onReset={()=>setBrowserWidth(undefined)} />
      </div>
      <div className="ps-document">
        <ModelWorkspaceControls workspace={workspace} onWorkspace={changeWorkspace} settings={settings} onSettings={setSettings}
          plane={plane} onPlane={kind => setPlane(value => ({kind,revision:value.revision + 1}))}
          render={renderSettings} onRender={setRenderSettings} onMaterials={() => {setActiveTab("materials");setMobilePanel("inspector");}} />
      </div>
      <div className="ps-right"><TabbedSidebar ariaLabel="Model inspector" variant="slim" attachment="detached" tabPosition="top" anchor="top" floating activeTab={activeTab} onTabChange={setActiveTab}
        tabs={[{ id: "properties", label: "Properties", icon: <AetherIcon name="sliders"/> }, { id: "scene", label: "Scene", icon: <AetherIcon name="layers"/> }, { id: "materials", label: "Materials", icon: <AetherIcon name="cube"/> }, { id: "view", label: "View", icon: <AetherIcon name="ball"/> }]}>
        {activeTab === "properties" && <ModelProperties part={selectedPart} onChange={changePart} settings={settings} onSettings={setSettings} plane={plane} onPlane={kind => setPlane(value => ({ kind, revision: value.revision + 1 }))}/>}
        {activeTab === "scene" && <ModelBrowser parts={parts} evaluatedParts={evaluatedParts} rollbackIndex={rollbackIndex} onRollback={value=>{setRollbackIndex(value);setNotice(value === modelFeatures.length ? "Complete CAD model" : `CAD rollback preview · ${value} of ${modelFeatures.length} features`);}} onRename={(id,name)=>{const part=parts.find(item=>item.id===id);if(part)changePart({...part,name});}} selected={selected} onSelect={select} onVisibility={id => { const part = parts.find(item => item.id === id); if (part) changePart({ ...part, visible: !part.visible }); }}/>}
        {activeTab === "materials" && <ModelMaterials part={selectedPart} onChange={changePart}/>}
        {activeTab === "view" && <ModelViews view={view} onView={setView} settings={settings} onSettings={setSettings}/>}
      </TabbedSidebar></div>
      <div className="ps-workspace-tools"><FloatingToolbar ariaLabel="Workspace panels" variant="document" onAction={action} groups={[{ id: "workspace", label: "Workspace", actions: toggleActions }]}/></div>
      <div className="ps-view-tools"><FloatingToolbar ariaLabel="View tools" variant="document" onAction={action} groups={[{ id: "view", label: "View", actions: viewActions }]}/></div>
      {section.enabled && <div className="ps-view-options-panel aui-float"><DockPanel><ModelViewTools section={section} onSection={updateSection}/></DockPanel></div>}
      {measuring && <ModelMeasurePopup points={measurePoints} onClear={() => setMeasurePoints([])} onClose={closeMeasure}/>}
      <div className="ps-view-menu"><FloatingToolbarMenu label="Camera view" iconOnly items={(["perspective", "front", "right", "top"] as const).map(id => ({ id, label: `${id[0].toUpperCase() + id.slice(1)} view`, kind: "radio", checked: view === id }))} onSelect={id => { setView(id as CameraView); setResetView(value => value + 1); }}><AetherIcon name="cube"/></FloatingToolbarMenu><span>{view}</span></div>
      <div className="ps-bottom">
        <ModelPositionReadout position={selectedPart?.transform.position ?? [0, 0, 0]}/>
        {query && <div className="aui-float ps-command-results" role="region" aria-label="Matching commands">{matches.length ? matches.map(command => <Button key={command.id} onClick={() => action(command.id)}>{command.label}</Button>) : <span>No commands found</span>}</div>}
        <FloatingToolbar ariaLabel="Modeling tools" onAction={action} command={{ value: query, onValueChange: setQuery, onSubmit: () => { if (matches.length === 1) action(matches[0].id); else setNotice(matches.length ? "Choose a matching command above" : "No commands found"); }, shortcuts: [{ id: "duplicate", label: "Duplicate", tone: "amber", disabled: !selectedPart }, { id: "undo", label: "Undo", tone: "blue", disabled: !history.past.length }, { id: "frame", label: "Frame", tone: "green" }] }} groups={[
          { id: "transform", label: "Transform tools", actions: TRANSFORM_TOOLS.map(item => ({ ...item, icon: <AetherIcon name={item.icon}/>, pressed: tool === item.id, disabled: item.id !== "select" && !selectedPart })) },
          { id: "primitives", label: "Add a primitive", separatorBefore: true, actions: CREATE_TOOLS.map(item => ({ ...item, icon: <AetherIcon name={item.icon}/> })) },
        ]}/>
      </div>
      <div className="ps-mobile-switches"><IconButton label="Toggle objects" aria-pressed={mobilePanel === "objects"} onClick={() => setMobilePanel(value => value === "objects" ? null : "objects")}><AetherIcon name="layers"/></IconButton><IconButton label="Toggle inspector" aria-pressed={mobilePanel === "inspector"} onClick={() => setMobilePanel(value => value === "inspector" ? null : "inspector")}><AetherIcon name="sliders"/></IconButton></div>
      <output className="ps-status" aria-live="polite">{notice}</output>
      <Menu open={!!menu} anchor={menu} ariaLabel="Model actions" items={contextItems} onSelect={action} onClose={() => setMenu(null)}/>
    </main>
    <ModelPartsFooter hidden={!showFooter} name={documentFile.meta.name} fileItems={documentFile.items} parts={parts} selected={selected} onSelect={select} onAction={action}/>
    </div>
    {documentFile.dialogs}
    <Dialog open={about} title="Aether Model Studio" onClose={() => setAbout(false)} actions={<Button onClick={() => setAbout(false)}>Done</Button>}><p>A Plasticity-inspired concept assembled from Aether’s floating toolbars, slim sidebar, tree, fields, menus and material controls.</p><p>The robot contains 120 authored CAD features and 39 individual solid bodies, rebuilt by Aether CAD’s FreeCAD engine. The standard feature tree previews its exact evaluated construction steps.</p><p>Transform and finish bodies here. Download the native Aether CAD document to edit sketches, parameters and feature order; this preview does not run a CAD kernel.</p><p>Shortcuts: V select, G move, R rotate, S scale, F auto zoom, Shift-D duplicate, Delete remove, Command/Ctrl-Z undo.</p></Dialog>
    <Dialog open={sourceDialog} title="Scifirobot CAD feature model" onClose={()=>setSourceDialog(false)} actions={<Button onClick={()=>setSourceDialog(false)}>Done</Button>}><p>120 editable construction features · 39 solid bodies. Open the native document in Aether CAD to edit sketches and feature parameters.</p><p><a className="aui-button aui-button--primary" href={modelStudioFeatureSample.url} download="Scifirobot.acpart">Download Aether CAD document</a></p><p><a className="aui-button" href={modelStudioFeatureSample.stepURL} download="Scifirobot.step">Download STEP solids</a></p><p>These are the original authored model files. Local preview transforms and surface changes are saved separately through Save.</p></Dialog>
    <Dialog open={!!download} title="Export scene settings" onClose={() => setDownload(null)} actions={<Button onClick={() => setDownload(null)}>Done</Button>}><p>Download the parts, transforms and surface colors from this concept.</p>{download && <a className="aui-button aui-button--primary" href={download} download="scifirobot-study.json">Download scene JSON</a>}</Dialog>
  </div>;
}
