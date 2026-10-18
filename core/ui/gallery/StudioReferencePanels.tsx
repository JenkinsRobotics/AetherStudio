import { useState } from "react";
import { AetherIcon, Button, Checkbox, NumberField, TextField, SegmentedControl, TreePanel } from "../src/index";
import { MaterialBrowser, type AppearanceValue, type MaterialOption } from "../src/ConceptWidgets";
import type { MaterialEnvironmentOption } from "../src/MaterialBrowser";
import { PreferenceRow } from "./AnimationStudioSettings";
import { studioSettings, useAnimationStudioPreference, type StudioSetting } from "./AnimationStudioPreferences";
import "./StudioReferencePanels.css";

const choice = (id:string,label:string,options:string[],initial=options[0]): StudioSetting => ({id,label,options,initial});
const toggle = (id:string,label:string,initial=true): StudioSetting => ({id,label,initial});
const fields = (items: readonly StudioSetting[]) => items.map(setting => <PreferenceRow key={setting.id} setting={setting}/>);

/** Source: ConsolidatedViewportSidebarPanel. State is local presentation only. */
export function StudioViewPanel({ onCamera, onSettings, canFrame }: {onCamera:(command:string)=>void; onSettings:()=>void; canFrame:boolean}) {
  const [projection] = useAnimationStudioPreference<string>("projection","Perspective");
  const [navigation,setNavigation] = useAnimationStudioPreference<string>("camera-navigation","Orbit");
  const [profile] = useAnimationStudioPreference<string>("navigation-profile","Default");
  const [name,setName] = useState("View 1");
  const [views,setViews] = useState<string[]>([]);
  return <div className="studio-reference-panel">
    <section><h3>CAMERA</h3>{fields([choice("projection","Projection",["Perspective","Orthographic"])])}
      <fieldset disabled={projection === "Orthographic"}>{fields([choice("field-of-view","Field of view",["30","45","60","75","90"],"45")])}</fieldset>
      <div className="studio-reference-actions"><Button disabled={!canFrame} onClick={()=>onCamera("frame-selection")}>Frame selection</Button><Button onClick={()=>onCamera("previous")}>Previous view</Button></div>
      <details><summary>Named views</summary><label>View name<TextField aria-label="View name" value={name} onChange={event=>setName(event.target.value)}/></label><Button disabled={!name.trim()} onClick={()=>{const title=name.trim();onCamera(`save:${title}`);setViews(current=>[...new Set([...current,title])]);setName(`View ${views.length+2}`);}}>Save Current View</Button>
        {views.map(view=><div className="studio-reference-actions" key={view}><Button onClick={()=>onCamera(`restore:${view}`)}>{view}</Button><Button aria-label={`Delete view ${view}`} onClick={()=>{onCamera(`delete:${view}`);setViews(current=>current.filter(item=>item!==view));}}><AetherIcon name="delete"/></Button></div>)}
      </details>
    </section>
    <section><h3>DISPLAY</h3>{fields([
      studioSettings.renderer.find(item=>item.id==="render-style")!,
      choice("edge-display","Edges",["Feature edges","All edges","Hidden"]),toggle("floor-grid","Grid"),toggle("section-enabled","Section view",false),toggle("high-quality","High quality",false),toggle("origin","Origin"),
    ])}</section>
    <section><h3>CAMERA NAVIGATION</h3><SegmentedControl ariaLabel="Camera navigation" value={navigation} onChange={setNavigation} options={["Orbit","Pan","Zoom"].map(label=>({id:label,label}))}/>
      {fields(studioSettings.navigation.filter(item=>item.id==="navigation-profile" || item.id.endsWith("-speed") || item.id==="reverse-zoom" || (profile==="Custom" && item.id.endsWith("-drag"))))}
      <Button onClick={onSettings}>Mouse Settings…</Button>
      <details><summary>Camera Help</summary><p>Drag to {navigation.toLowerCase()}. Right drag pans; scroll or pinch zooms. Click geometry to select. Use the ViewCube for standard views.</p></details>
    </section>
  </div>;
}

// Transcribed from VisualizationMaterialCatalog, including all eleven native presets.
export const studioMaterials: readonly (MaterialOption & {opacity:number})[] = [
  {id:"abs-glossy",name:"ABS",category:"Plastic",finish:"Glossy",color:"#D52C35",opacity:100},
  {id:"abs-matte",name:"ABS",category:"Plastic",finish:"Matte",color:"#BE2630",opacity:100},
  {id:"engineering",name:"Engineering Plastic",category:"Plastic",finish:"Satin",color:"#E7E9EC",opacity:100},
  {id:"utility",name:"Utility Plastic",category:"Plastic",finish:"Matte",color:"#24272B",opacity:100},
  {id:"aluminum",name:"Aluminum",category:"Metal",finish:"Brushed",color:"#AEB5BB",opacity:100},
  {id:"steel",name:"Steel",category:"Metal",finish:"Polished",color:"#727A82",opacity:100},
  {id:"anodized",name:"Anodized Aluminum",category:"Metal",finish:"Satin",color:"#356F9F",opacity:100},
  {id:"brass",name:"Brass",category:"Metal",finish:"Polished",color:"#B79445",opacity:100},
  {id:"clear",name:"Clear Glass - Thin",category:"Glass",finish:"Glossy",color:"#F5FAFF",opacity:18},
  {id:"smoked",name:"Smoked Glass",category:"Glass",finish:"Glossy",color:"#56616C",opacity:38},
  {id:"frosted",name:"Frosted Glass",category:"Glass",finish:"Matte",color:"#C7D3DC",opacity:58},
];
export const studioEnvironments: readonly MaterialEnvironmentOption[] = [
  {id:"default",name:"Default",color:"#343941"}, {id:"transparent",name:"Transparent",color:"#e8eaee",transparent:true},
  {id:"colored",name:"Colored Mood",color:"#00a7ff"}, {id:"gradient",name:"Gradient Mood",color:"#f2f2f2",secondaryColor:"#adb5bf"},
  {id:"stage",name:"Black and White Stage",color:"#f0f0f0",secondaryColor:"#0e0f12"},
];
export function StudioEnvironmentPanel({appearance,onAppearance,assignmentLabel="sample rig",initialTab="environment"}: {appearance:AppearanceValue;onAppearance:(value:AppearanceValue)=>void;assignmentLabel?:string;initialTab?:"material"|"environment"}) {
  const [selected,setSelected]=useState<string>();
  const [used,setUsed]=useState<string[]>([]);
  const [environment,setEnvironment]=useAnimationStudioPreference<string>("environment-preset","default");
  const [,setBackground]=useAnimationStudioPreference<string>("background","#e8eaee");
  const [,setSecondary]=useAnimationStudioPreference<string>("background-secondary","#adb5bf");
  const [,setMode]=useAnimationStudioPreference<string>("background-mode","Solid");
  const [,setRoughness]=useAnimationStudioPreference<number>("roughness",.48);
  const [,setMetallic]=useAnimationStudioPreference<number>("metallic",.02);
  return <div className="studio-reference-panel"><MaterialBrowser materials={studioMaterials} selectedID={selected} usedIDs={used} assignmentLabel={assignmentLabel} initialTab={initialTab}
    onSelect={id=>{const material=studioMaterials.find(item=>item.id===id)!;setSelected(id);setUsed(current=>[...new Set([...current,id])]);onAppearance({...appearance,color:material.color,opacity:material.opacity});setRoughness(material.finish==="Matte"?.85:material.finish==="Glossy"?.15:.45);setMetallic(material.category==="Metal"?.85:0);}}
    environments={studioEnvironments} environmentID={environment} onEnvironmentSelect={id=>{const item=studioEnvironments.find(entry=>entry.id===id)!;setEnvironment(id);setBackground(item.color);setSecondary(item.secondaryColor??item.color);setMode(item.transparent?"Transparent":item.secondaryColor?"Gradient":"Solid");}}
    environmentControls={<>
      <section><h3>BACKGROUND</h3>{fields([choice("background-mode","Mode",["Solid","Gradient","Transparent"]),{id:"background",label:"Color",initial:"#e8eaee",color:true},{id:"background-secondary",label:"Second Color",initial:"#adb5bf",color:true}])}</section>
      <section><h3>STUDIO ENVIRONMENT</h3>{fields(studioSettings.appearance.filter(item=>["environment","environment-rotation","reflections"].includes(item.id)))}{fields(studioSettings.lighting)}</section>
      <section><h3>SECTION VIEW</h3>{fields([toggle("section-enabled","Enable clip plane",false),choice("section-axis","Plane Normal",["X","Y","Z"]),{id:"section-position",label:"Plane position (m)",initial:0,min:-3,max:3,step:.01}])}</section>
    </>}/></div>;
}
export function StudioPerformancePanel() {
  return <div className="studio-reference-panel"><section><h3>VIEWPORT HUD</h3>{fields([toggle("telemetry","Show engine frame status",false),toggle("cad-metrics","Show detailed CAD metrics",false)])}<p>The runtime card remains clear of the center-view switcher.</p></section><section><h3>LIVE STATUS</h3><dl><dt>Engine</dt><dd>Not connected</dd><dt>Evaluated frame</dt><dd>Waiting</dd><dt>Renderer</dt><dd>Local WebGL preview</dd><dt>Hardware output</dt><dd>Disarmed</dd></dl></section></div>;
}

export function StudioCollectionPanel({kind,onOpen}: {kind:"Assemblies"|"Scripts"|"Animations";onOpen?:()=>void}) {
  const [items,setItems]=useState(()=> (kind==="Assemblies"?["Character Assembly"]:kind==="Animations"?["Performance Take 01","Idle loop","Jaw test"]:[]).map((name,index)=>({id:String(index),name,loop:true,duration:8,source:"// Local authoring preview"})));
  const [selected,setSelected]=useState<ReadonlySet<string>>(new Set());
  const item=items.find(entry=>selected.has(entry.id));
  const update=(patch:Partial<(typeof items)[number]>)=>setItems(current=>current.map(entry=>selected.has(entry.id)?{...entry,...patch}:entry));
  return <div className="studio-reference-panel"><TreePanel ariaLabel={kind} nodes={items.map(entry=>({id:entry.id,label:entry.name,icon:<AetherIcon name={kind==="Animations"?"file-clip":kind==="Scripts"?"document":"assembly"}/>}))} selectedIDs={selected} onSelect={ids=>setSelected(new Set(ids))}/>
    <div className="studio-reference-actions"><Button onClick={()=>{const id=crypto.randomUUID();setItems(current=>[...current,{id,name:`New ${kind==="Animations"?"clip":kind==="Scripts"?"script":"assembly"} ${current.length+1}`,loop:true,duration:8,source:"// Local authoring preview"}]);setSelected(new Set([id]));}}>New</Button><Button disabled={!selected.size} onClick={()=>{setItems(current=>current.filter(entry=>!selected.has(entry.id)));setSelected(new Set());}}>Delete</Button></div>
    {item && <section><h3>DETAILS</h3><label>Name<TextField aria-label={`${kind} name`} value={item.name} onChange={event=>update({name:event.target.value})}/></label>{kind==="Animations"?<><label>Duration<NumberField aria-label="Clip duration" value={item.duration} min={.1} unit="s" onValueChange={value=>{if(value!==null)update({duration:value});}}/></label><Checkbox label="Loop clip" checked={item.loop} onChange={event=>update({loop:event.target.checked})}/><Button onClick={onOpen}>Open in Animate</Button></>:kind==="Scripts"?<label>Source<textarea aria-label="Script source" value={item.source} onChange={event=>update({source:event.target.value})}/></label>:<p>Local character hierarchy collection</p>}</section>}
  </div>;
}
