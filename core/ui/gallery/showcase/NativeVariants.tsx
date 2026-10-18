import { useState } from "react";
import { AetherIcon, Button, Tree, Ribbon, RibbonGroup, RibbonTool } from "../../src/index";
import { AppearanceInspector, AssistantPanel, SequenceEditor, SpecimenBoard } from "../../src/ConceptWidgets";
import { StudioMateInspector } from "../StudioMateInspector";
import { nativeVariants } from "./NativeVariantCatalog";
import { ProductionChromeSpecimen, FloatingRibbonSpecimen, InspectorSpecimen, HardwareMonitorSpecimen, DialogSpecimen, GraphicsPopoverSpecimen, ComponentMenuSpecimen, EmptyWorkspaceSpecimen } from "./UIDevSpecimens";

const families = [
  ["workspaceChrome","Workspace Chrome"], ["sidePanels","Docked Panels"], ["inspectors","Inspector Variants"], ["timelines","Timeline Variants"], ["toolbars","Toolbars & Tool Rails"], ["dialogsAndMenus","Dialogs, Popovers & Menus"], ["statusAndFeedback","Status & Feedback"],
] as const;
const tracks = [{id:"head",label:"Head Yaw",color:"#4c9dff",keyframes:[{timeS:0,value:0},{timeS:2,value:.7},{timeS:5,value:-.5},{timeS:8,value:0}]}];

export function StateVariantView({id}: {id: typeof nativeVariants[number]["id"]}) {
  const [selected,setSelected] = useState("Select");
  const [cancelled,setCancelled] = useState(false);
  const [tree,setTree] = useState<ReadonlySet<string>>(new Set(["head"]));
  switch(id) {
    case "documentChrome": return <ProductionChromeSpecimen/>;
    case "workspaceRibbon": return <><ProductionChromeSpecimen/><FloatingRibbonSpecimen/></>;
    case "compactWorkspaceChrome": return <><ProductionChromeSpecimen/><Button onClick={()=>setSelected(selected === "Select" ? "Expand" : "Select")}>{selected === "Select" ? "More tools…" : "Hide tools"}</Button>{selected === "Expand" ? <FloatingRibbonSpecimen/> : null}</>;
    case "navigatorEmpty": return <EmptyWorkspaceSpecimen/>;
    case "navigatorHierarchy": return <Tree ariaLabel="Populated navigator" nodes={[{id:"assembly",label:"Head Assembly",children:[{id:"head",label:"Head"},{id:"torso",label:"Torso"}]},{id:"mates",label:"Mates",children:[{id:"yaw",label:"Head Yaw"}]}]} selectedIDs={tree} onSelect={(ids)=>setTree(new Set(ids))}/>;
    case "agentDocked": return <AssistantPanel title="Aether Agent" messages={[{id:"welcome",role:"assistant",text:"UI prototype · agent service is not connected"}]} suggestions={["Review the rig","Explain this tool"]}/>;
    case "componentInspector": return <InspectorSpecimen kind="component"/>;
    case "mateInspector": return <StudioMateInspector/>;
    case "appearanceInspector": return <AppearanceInspector/>;
    case "hardwareInspector": return <HardwareMonitorSpecimen/>;
    case "dopeSheetTimeline": return <SequenceEditor initialTracks={tracks}/>;
    case "motionCurveTimeline": return <SequenceEditor initialTracks={tracks} initialMode="curves"/>;
    case "showControlTimeline": return <SequenceEditor initialTracks={[...tracks,{id:"audio",label:"Audio",kind:"audio",keyframes:[]},{id:"video",label:"Video",keyframes:[{timeS:2}]},{id:"events",label:"Events",kind:"event",keyframes:[{timeS:3}]}]}/>;
    case "emptyTimeline": return <SequenceEditor initialTracks={[]}/>;
    case "commandToolbar": case "selectionToolbar": case "disabledToolbar": return <Ribbon><RibbonGroup label="Tools">{(["Select","Move","Rotate","Scale"] as const).map((label)=><RibbonTool key={label} label={label} icon={<AetherIcon name={label === "Select" ? "mouse" : label === "Rotate" ? "redo" : "fit"}/>} active={id === "selectionToolbar" && selected === label} disabled={id === "disabledToolbar"} title={id === "disabledToolbar" ? "Planned tool" : label} onClick={()=>setSelected(label)}/>)}</RibbonGroup></Ribbon>;
    case "verticalToolRail": return <div style={{display:"grid",width:48,gap:8}}>{(["view","lighting","palette","settings"] as const).map((name)=><Button key={name} aria-label={name} aria-pressed={selected===name} onClick={()=>setSelected(name)}><AetherIcon name={name}/></Button>)}</div>;
    case "informationDialog": return <DialogSpecimen/>;
    case "confirmationDialog": return <DialogSpecimen confirmation/>;
    case "graphicsPopover": return <GraphicsPopoverSpecimen/>;
    case "componentContextMenu": return <ComponentMenuSpecimen/>;
    case "emptyWorkspace": return <EmptyWorkspaceSpecimen/>;
    case "processingStatus": return <div className="uidev-status-stack"><div><AetherIcon name="history"/><span>{cancelled ? "Operation cancelled" : "Reading model hierarchy…"}</span></div>{!cancelled ? <><progress/><Button onClick={()=>setCancelled(true)}>Cancel</Button></> : <Button onClick={()=>setCancelled(false)}>Retry</Button>}</div>;
    case "connectedStatus": return <div className="uidev-status-stack"><div className="success"><AetherIcon name="status-incomplete"/>Hardware connected · sample device</div><div>Heartbeat received · Ready</div></div>;
    case "emergencyStatus": return <div className="uidev-status-stack"><div className="warning"><AetherIcon name="status-error"/>{cancelled ? "Fault acknowledged · Output disarmed" : "EMERGENCY STOP · Output disarmed"}</div><Button onClick={()=>setCancelled(true)} disabled={cancelled}>Acknowledge</Button></div>;
  }
}

export function NativeVariants() {
  const [search,setSearch] = useState("");
  const [family,setFamily] = useState("");
  const [zoom,setZoom] = useState(65);
  const [selected,setSelected] = useState<string | null>(null);
  const shown = nativeVariants.filter((variant) => (!family || variant.family === family) && `${variant.title} ${variant.detail} ${variant.state}`.toLowerCase().includes(search.toLowerCase()));
  const width=250*zoom/65;
  return <div className="animation-variant-board" aria-label="UI Dev window variant comparison board">
    <header><strong>VARIANT BOARD</strong><input type="search" aria-label="Search windows and states" placeholder="Search windows and states" value={search} onChange={(event)=>setSearch(event.target.value)}/><select aria-label="Variant family" value={family} onChange={(event)=>setFamily(event.target.value)}><option value="">All Families</option>{families.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><Button aria-label="Reduce specimen size" disabled={zoom<=50} onClick={()=>setZoom(Math.max(50,zoom-15))}>−</Button><output>{zoom}%</output><Button aria-label="Increase specimen size" disabled={zoom>=110} onClick={()=>setZoom(Math.min(110,zoom+15))}>+</Button></header>
    <div className="animation-variant-board-scroll"><SpecimenBoard title="Window & Widget Variants" detail="Compare the production states of the same reusable UI families." eyebrow="ANIMA STUDIO · VARIANT BOARD" stats={["26 VARIANTS","7 FAMILIES"]} sections={families.filter(([id])=>shown.some(v=>v.family===id)).map(([family,title])=>({id:family,title,detail:"",minimumWidth:width,maximumWidth:width,specimens:shown.filter((v)=>v.family===family).map((v)=>({id:v.id,title:v.title,detail:`${v.state} · ${v.detail}`,idealSize:`${v.width} × ${v.height}`,icon:"window" as const,previewHeight:Math.min(Math.max(width*v.height/v.width,118),390),content:<div className={selected === v.id ? "animation-variant-preview is-selected" : "animation-variant-preview"}><Button className="animation-variant-select" aria-pressed={selected===v.id} onClick={()=>setSelected(selected===v.id?null:v.id)}>Inspect {v.title}</Button><StateVariantView id={v.id}/></div>}))}))}/></div>
    <footer>{shown.length} of 26 variants · {selected ? nativeVariants.find(v=>v.id===selected)?.title : "Select a variant to inspect"}</footer>
  </div>;
}

/** One native state variant as a flat, captioned specimen at its design width. */
export function StateVariant({ id }: { id: string }) {
  const variant = nativeVariants.find((entry) => entry.id === id);
  if (!variant) return null;
  return <div className="gallery-variant" data-state-variant={id} data-wide={variant.width >= 900 || undefined}>
    <small>{variant.title} · {variant.state} · native variant · {variant.width} × {variant.height}</small>
    <div className="gallery-native-template" style={{ width: variant.width, maxWidth: "100%" }}><StateVariantView id={variant.id}/></div>
  </div>;
}
