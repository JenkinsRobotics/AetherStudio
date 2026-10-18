import { UIDevToolRibbon } from "../UIDevToolRibbon";
import { LayoutStyleControls } from "../../src/LayoutStyleControls";
import { aetherThemes } from "../../src/themes";
import { AppearanceInspector, CompactActionPanel, SequenceEditor } from "../../src/ConceptWidgets";
import { StudioModelPreview } from "../StudioModelPreview";
import { StudioMateInspector } from "../StudioMateInspector";
import { useState, type ReactNode } from "react";
import {
  AetherIcon,
  Button,
  Checkbox,
  NumberField,
  SearchField,
  SegmentedControl,
  SelectField,
} from "../../src/index";
import "./UIDevSpecimens.css";

export function ProductionChromeSpecimen() {
  return <div className="uidev-production-chrome">
    <div className="uidev-production-chrome__document"><AetherIcon name="home" /><strong>est</strong><b>SAVED</b><i /><AetherIcon name="settings" /><AetherIcon name="document" /><AetherIcon name="save" /><AetherIcon name="undo" /></div>
    <nav><button><AetherIcon name="cube" />3D <AetherIcon name="chevron-down" /></button>{["Assets", "3D Modeling", "Animate", "Show", "Hardware", "UI Dev"].map((item, index) => <button className={index === 0 ? "is-active" : ""} key={item}>{item}</button>)}</nav>
    <div className="uidev-production-chrome__status"><span><AetherIcon name="circle-filled" /> Engine · est <AetherIcon name="chevron-down" /></span><button><AetherIcon name="play" /> Preview</button><AetherIcon name="windows" /><AetherIcon name="layout" /><AetherIcon name="appearance" /><AetherIcon name="help" /></div>
  </div>;
}

export function WorkspaceLayoutsSpecimen({ active }: { active: "floating" | "docked" | "canvas" }) {
  const layouts = [
    { id: "floating", label: "Floating", detail: "Tools hover above the canvas" },
    { id: "docked", label: "Docked", detail: "Browser and inspector stay attached" },
    { id: "canvas", label: "Canvas Hidden", detail: "Presentation-first workspace" },
  ] as const;
  return <div className="uidev-layout-modes">{layouts.map((layout) => <div className={active === layout.id ? "is-active" : ""} key={layout.id}><div className={`uidev-layout-diagram uidev-layout-diagram--${layout.id}`}><i/><i/><i/></div><strong>{layout.label}</strong><span>{layout.detail}</span></div>)}</div>;
}

export function RecentProjectsSpecimen() {
  return <div className="uidev-recent"><header><div><small>RECENT PROJECTS</small><strong>Continue where you left off</strong></div><b>2 RECENT</b></header>{[
    ["Atlas Head Rig", "Edited 12 minutes ago", "V14"], ["Arcade Character", "Edited yesterday", "V8"],
  ].map(([name, detail, version], index) => <button key={name}><span className={index ? "violet" : "blue"}><AetherIcon name="file-character" /></span><div><strong>{name}</strong><small>{detail}</small></div><b>{version}</b><AetherIcon name="more-circle" /></button>)}</div>;
}

const previewParts = [{id:"sample-body",part:"Head Assembly",source:"UI fixture",version:"V1",parent:"Origin",state:"Ready" as const}];
const previewAppearance = {color:"#39bed0",opacity:100,tessellation:"auto" as const};
export function Workspace3DSpecimen({triad=false}: {triad?:boolean}) {
  return <div className="uidev-model-host"><StudioModelPreview parts={previewParts} appearance={previewAppearance} manipulator={triad}/></div>;
}

export function InspectorSpecimen({ kind }: { kind: "component" | "appearance" | "mate" }) {
  if (kind === "appearance") return <AppearanceInspectorSpecimen />;
  if (kind === "mate") return <StudioMateInspector />;
  return <div className="uidev-inspector"><header><AetherIcon name="settings"/><strong>COMPONENT</strong><small>Inspector</small></header><label>Name<input defaultValue="Head Assembly"/></label><label>Proxy Shape<input disabled defaultValue="Imported Model"/></label><small>TRANSFORM</small>{["Position X","Position Y","Position Z"].map((label,index)=><label key={label}>{label}<NumberField defaultValue={index===1?1.45:0} unit="m"/></label>)}<div className="uidev-field-row"><span>Rotation</span><b>0°, 0°, 0°</b></div><Checkbox defaultChecked label="Visible"/><Button disabled>Frame Selection</Button></div>;
}

function AppearanceInspectorSpecimen() { return <AppearanceInspector />; }

export function CreationPaletteSpecimen() {
  const groups = [
    ["STRUCTURES", [["box","Box"],["cube","Cylinder"],["surface","Sphere"],["plus","Point"]]],
    ["MATES", [["fastened","Fastened"],["slider","Slider"],["revolute","Revolute"],["ball","Ball"]]],
    ["MOTORS", [["hardware","Servo"],["settings","Stepper"]]],
    ["MEDIA", [["show","Video"],["file-part","3D Model"]]],
  ] as const;
  return <div className="uidev-creation-palette">{groups.map(([label,items],groupIndex)=><section className={groupIndex>1?"is-disabled":""} key={label}><small>{label}</small><div>{items.map(([icon,title])=><button disabled={groupIndex>1} key={title}><AetherIcon name={icon}/><span>{title}</span></button>)}</div></section>)}</div>;
}

const layerRows = [
  [0,"layers","Root Layer","NS"],[0,"collection-folder","container",""],[1,"surface","halo-tint-shape","LK"],[1,"surface","halo2-tint-shape","CA"],[1,"image","CATintedImage",""],[1,"window","NSWindow content layer","SL"],[2,"appearance","active",""],[3,"connector","Elements",""],[3,"cube","scale","A"],[3,"palette","opacity","M"],[3,"appearance","filters.gaussianBlur.inputRadius","M"],[3,"animate","animation-1","R"],[2,"layers","tmp-dark",""],[2,"commands","click",""],
] as const;
export function LayeredIconListSpecimen() {
  const [selected,setSelected]=useState("NSWindow content layer");
  return <div className="uidev-layer-list"><header><div><AetherIcon name="layers"/><span><strong>Layer Stack</strong><small>Hierarchy · tags · states</small></span></div><AetherIcon name="search"/></header>{layerRows.map(([depth,icon,label,tag])=><button className={selected===label?"is-active":""} onClick={()=>setSelected(label)} style={{paddingLeft:8+depth*17}} key={label}>{label!=="Root Layer"&&depth<3?<AetherIcon name="chevron"/>:<i/>}<AetherIcon name={icon}/><span>{label}</span>{tag?<b>{tag}</b>:null}<AetherIcon name="visible"/></button>)}</div>;
}

export function HardwareMonitorSpecimen() {
  return <div className="uidev-hardware"><header><AetherIcon name="hardware"/><div><strong>HARDWARE</strong><span>Output monitor</span></div><b>OFFLINE</b></header>{[["Connection","Offline"],["Master Live","Disarmed"],["Driver","No Driver"],["Device","None"],["Channels","0"],["Heartbeat","—"]].map(([label,value])=><div key={label}><span>{label}</span><b>{value}</b></div>)}<Button disabled>Connect Device</Button><button className="uidev-danger">Emergency Stop</button></div>;
}

export function DetachedToolSpecimen() {
  return <div className="uidev-detached"><header><span className="uidev-window-dots"><i /><i /><i /></span><strong>Viewport Tools</strong><AetherIcon name="close"/></header><div className="uidev-detached__tools"><button className="is-active"><AetherIcon name="mouse"/>Select</button><button><AetherIcon name="planes-axes"/>Move</button><button><AetherIcon name="redo"/>Rotate</button><button><AetherIcon name="fit"/>Scale</button></div><small>DETACHED UTILITY</small><p>Keep temporary tools close to the work without duplicating the full workspace.</p><Button primary>Return to workspace</Button></div>;
}

export function FloatingRibbonSpecimen() {
  const [tool,setTool]=useState<string|null>(null);const [section,setSection]=useState("Create");
  return <UIDevToolRibbon workspace="assets" activeSection={section} activeTool={tool} onSection={setSection} onCommand={id=>setTool(id)}/>;
}

export function DialogSpecimen({ confirmation = false }: { confirmation?: boolean }) {
  return <div className="uidev-dialog"><AetherIcon name={confirmation?"delete":"status-error"}/><strong>{confirmation?"Remove Head Yaw?":"Model Could Not Be Imported"}</strong><p>{confirmation?"This removes the mate and connected animation tracks. This action cannot be undone.":"The selected file is not a supported USD-family, STL, or OBJ model."}</p><footer>{confirmation?<Button>Cancel</Button>:null}<Button primary={!confirmation} className={confirmation?"uidev-danger":""}>{confirmation?"Remove Mate":"OK"}</Button></footer></div>;
}

export function GraphicsPopoverSpecimen() {
  return <div className="uidev-popover"><header><strong>Graphics Options</strong><small>Viewport display</small></header><Checkbox defaultChecked label="Shaded with edges"/><Checkbox label="Hidden edges"/><Checkbox defaultChecked label="Tangent edges"/><label>Lighting<SelectField defaultValue="balanced" options={[{value:"balanced",label:"Balanced"},{value:"studio",label:"Studio"},{value:"flat",label:"Flat"}]}/></label><Button>Graphics Preferences…</Button></div>;
}

export function ComponentMenuSpecimen() {
  const groups=[["Properties","Appearance…"],["Hide Component","Isolate","Make Transparent"],["Frame Selection","View Normal To"],["Lock Component","Move to Group"],["Delete Component"]];
  return <div className="uidev-context-menu">{groups.map((group,index)=><section key={index}>{group.map(item=><button className={item.startsWith("Delete")?"is-danger":""} key={item}><span>{item}</span>{item.endsWith("…")?<small>⌘I</small>:null}</button>)}</section>)}</div>;
}

export function ActionButtonsSpecimen() {
  return <div className="uidev-actions"><Button primary><AetherIcon name="plus" /> Create Mate</Button><Button disabled><AetherIcon name="play" /> Preview Motion</Button><div><Button>Quiet</Button><Button className="uidev-danger">Remove</Button></div><div><button className="is-selected">✓</button><button>☷</button><Button disabled>Unavailable</Button></div></div>;
}

export function FieldsSpecimen() {
  const [angleDeg,setAngleDeg]=useState(42);const [unit,setUnit]=useState("degrees");
  return <div className="uidev-fields"><label>Display Name<input defaultValue="Head Pan"/></label><label>Angle<NumberField aria-label="Specimen angle" value={unit==="degrees"?angleDeg:angleDeg*Math.PI/180} unit={unit==="degrees"?"deg":"rad"} onValueChange={value=>{if(value!==null)setAngleDeg(unit==="degrees"?value:value*180/Math.PI);}}/></label><SearchField ariaLabel="Filter components specimen" placeholder="Filter components"/><label>Units<SegmentedControl ariaLabel="Units" value={unit} onChange={setUnit} options={[{id:"degrees",label:"Degrees"},{id:"radians",label:"Radians"}]}/></label><Checkbox defaultChecked label="Show reference planes"/><div className="uidev-readout"><span>Evaluated Angle</span><b>{(angleDeg*Math.PI/180).toFixed(3)} rad</b></div></div>;
}

export function LayoutControlsSpecimen() { return <LayoutStyleControls/>; }

export function CompactActionPanelSpecimen() { return <CompactActionPanel />; }

export function EmptyWorkspaceSpecimen() {
  return <div className="uidev-empty"><AetherIcon name="cube"/><strong>Build the semantic rig</strong><p>Add a component or import a model to begin defining movable structure.</p><Button primary><AetherIcon name="plus" /> Add Components</Button></div>;
}

export function ProgressStatusSpecimen() {
  return <div className="uidev-status-stack"><div className="success"><AetherIcon name="status-incomplete"/><span>Design profile applied</span></div><div className="loading"><i/><span>Reading model hierarchy…</span><i/></div><div className="warning"><AetherIcon name="hardware"/><span>Hardware output unavailable</span></div><div className="info"><AetherIcon name="help"/><span>Project saving requires the document layer</span></div></div>;
}

const concepts=[
  ["organize","Organize Rig Components","Start with grouped components, mates, and named control regions.","Add Groups","assembly"],
  ["ai","Generate a Node Flow","Draft an editable STT, LLM, TTS, and behavior graph from a goal.","Generate","sketch-nodes"],
  ["tools","Add Tools and Resources","Bring in notes, media, reusable actions, plugins, and references.","Add","hammer"],
  ["import","Import an Assembly","Preserve the useful CAD or DCC hierarchy while staging a character.","Choose Model","import"],
  ["motion","Build a Motion Sequence","Create tracks for key poses, audio, timing, and show events.","Create Sequence","animate"],
  ["output","Configure Character Outputs","Connect screens, LEDs, audio, and hardware destinations.","Add Output","hardware"],
] as const;
export function ConceptTemplateCardsSpecimen() {
  const [selected,setSelected]=useState("ai");
  const title=concepts.find(item=>item[0]===selected)?.[1] ?? "Generate a Node Flow";
  return <div className="uidev-concepts"><header><div><small>STARTING POINTS</small><strong>Choose a workspace template</strong><span>Reusable cards for onboarding, empty workspaces, and add-content flows.</span></div><b>✓ {title} selected</b></header><div>{concepts.map(([id,name,detail,action,icon])=><button className={selected===id?"is-active":undefined} onClick={()=>setSelected(id)} key={id}><figure><div><AetherIcon name={icon}/><i/><AetherIcon name={id==="ai"?"show":"layers"}/></div><small>CONCEPT</small></figure><section><strong>{name}</strong>{selected===id?<b>✓</b>:null}<p>{detail}</p><span>{action}</span></section></button>)}</div></div>;
}

export function IconThemeSelectorSpecimen() {
  const [theme,setTheme]=useState("graphite"); const [selected,setSelected]=useState("Nodes"); const [pinned,setPinned]=useState(false); const [custom,setCustom]=useState(false); const [opened,setOpened]=useState(false); const [icons,setIcons]=useState<Record<string,string>>({});
  const themes=aetherThemes.map((entry)=>({id:entry.id,label:entry.name.replace("Aether ","")}));
  return <div className={`uidev-theme-lab aether-theme-${theme}`}><header><div><small>ICON SELECTOR &middot; THEME LAB</small><span>Compare the complete widget treatment before app-wide adoption.</span></div><SegmentedControl ariaLabel="Preview theme" value={theme} onChange={setTheme} options={themes}/></header><main><div className="uidev-theme-stage"><nav>{[["assembly","Rig"],["sketch-nodes","Nodes"],["cube","3D View"],["show","Show"]].map(([icon,label])=><button className={selected===label?"is-active":undefined} onClick={()=>setSelected(label!)} key={label}><AetherIcon name={icons[label!]??icon as Parameters<typeof AetherIcon>[0]["name"]}/><span>{label}</span></button>)}</nav><section><strong>{selected}</strong><button onClick={()=>setOpened(!opened)}>{opened?"Close Workspace":"Open Workspace"}</button><button aria-pressed={pinned} onClick={()=>setPinned(!pinned)}>{pinned?"Unpin from dock":"Pin to dock"}</button><button aria-pressed={custom} onClick={()=>setCustom(!custom)}>Customize icon…</button>{custom&&<SelectField aria-label="Workspace icon" value={icons[selected]??"sketch-nodes"} onChange={event=>setIcons(current=>({...current,[selected]:event.target.value}))} options={[{value:"sketch-nodes",label:"Nodes"},{value:"cube",label:"Cube"},{value:"show",label:"Show"}]}/>}<hr/><button disabled={!pinned} onClick={()=>setPinned(false)}>Remove from dock</button></section>{opened&&<div className="uidev-theme-workspace" role="region" aria-label={`${selected} preview`}><AetherIcon name={icons[selected]??"sketch-nodes"}/><strong>{selected} workspace</strong><span>Local interface preview</span></div>}</div><aside>{["Canvas","Dock","Tile","Menu","Accent","Foreground","Muted","Border"].map((token,index)=><div key={token}><i style={{background:`var(${["--aether-color-bg-app","--aether-color-bg-panel","--aether-color-bg-inset","--aether-color-bg-panel","--aether-color-accent","--aether-color-text","--aether-color-text-dim","--aether-color-border"][index]})`}}/><span>{token}</span></div>)}</aside></main><footer><AetherIcon name="sketch" /> {selected} selected · {theme[0]!.toUpperCase()+theme.slice(1)} theme</footer></div>;
}

export function TimelineDesignBSpecimen({ children: _children }: { children?: ReactNode }) {
  return <SequenceEditor initialTracks={[
    {id:"yaw",label:"Head Yaw",color:"#4c9dff",keyframes:[{timeS:0,value:0},{timeS:2,value:.8},{timeS:5,value:-.2}]},
    {id:"tilt",label:"Head Tilt",color:"#af83ed",keyframes:[{timeS:1,value:.2},{timeS:3,value:-.5},{timeS:6,value:.6}]},
  ]}/>;
}
