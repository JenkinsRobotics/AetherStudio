import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { AetherIcon, Button, SegmentedControl, SelectField, NumberField, TextField, Checkbox, TreePanel } from "../src/index";

function ParameterSlider(props: { label: string; value: number; min?: number; max?: number; onChange: (value: number) => void }) {
  return <label className="animation-live-parameter">
    <span>{props.label}</span>
    <input type="range" min={props.min ?? 0} max={props.max ?? 1} step="0.01" value={props.value} onChange={(event) => props.onChange(Number(event.target.value))} />
    <output>{props.value.toFixed(2)}</output>
  </label>;
}

function FacePreview({ mouth, smile, blink, yaw = 0 }: { mouth: number; smile: number; blink: number; yaw?: number }) {
  return <div className="animation-face-preview" style={{ transform: `translateX(${yaw * 12}px)` }} aria-label="Procedural face preview">
    <i className="animation-face-eye animation-face-eye--left" style={{ transform: `scaleY(${Math.max(.08, 1 - blink)})` }} />
    <i className="animation-face-eye animation-face-eye--right" style={{ transform: `scaleY(${Math.max(.08, 1 - blink)})` }} />
    <i className="animation-face-mouth" style={{ height: 8 + mouth * 38, borderRadius: `${Math.max(8, 26 - smile * 12)}px ${Math.max(8, 26 - smile * 12)}px ${12 + smile * 18}px ${12 + smile * 18}px` }} />
  </div>;
}

export function StudioCanvas2DWorkspace() {
  const [subject, setSubject] = useState("face");
  const [mouth, setMouth] = useState(.15);
  const [smile, setSmile] = useState(.4);
  const [eye, setEye] = useState(1);
  const [time, setTime] = useState(1);
  return <div className="animation-character-workspace">
    <SegmentedControl ariaLabel="2D character" value={subject} onChange={setSubject} options={[{ id: "face", label: "Face" }, { id: "pixel", label: "Pixel Pet" }, { id: "dino", label: "Dino GIF" }]} />
    <section className="animation-character-preview-card">
      <h2>2D Preview</h2><p>Local UI preview · Aether Core is not connected</p>
      <div className={`animation-character-render animation-character-render--${subject}`}>
        {subject === "dino" ? <img alt="Dino running" src={new URL("./fixtures/gifs/DinoRun2.gif", import.meta.url).href}/> : <>
          {subject === "pixel" ? <img alt="Pixel Pet color wheel" src={new URL("./fixtures/png/colorwheel.png", import.meta.url).href}/> : null}
          <div className="animation-face-breath" style={{transform:`scale(${1 + Math.sin(time * 2) * .025})`}}><FacePreview mouth={mouth} smile={smile} blink={Math.max(1-eye, Math.pow(Math.max(0,Math.cos(time*3)),20))}/></div>
        </>}
      </div>
    </section>
    <section className="animation-character-controls">
      <ParameterSlider label="Mouth open" value={mouth} onChange={setMouth} />
      <ParameterSlider label="Smile ↔ Frown" min={-1} value={smile} onChange={setSmile} />
      <ParameterSlider label="Eye open" value={eye} onChange={setEye} />
      <ParameterSlider label="Time (blink · breathe)" max={8} value={time} onChange={setTime} />
    </section>
    <div className="animation-capability-row">{[["surface", "Surfaces"], ["image", "Media"], ["file-character", "Faces"], ["apps", "Output"]].map(([icon, label]) => <span key={label}><AetherIcon name={icon as "surface"} />{label}</span>)}</div>
  </div>;
}

export function StudioVRWorkspace() {
  const [jaw, setJaw] = useState(.1);
  const [smile, setSmile] = useState(.3);
  const [blink, setBlink] = useState(0);
  const [yaw, setYaw] = useState(0);
  return <div className="animation-character-workspace">
    <section className="animation-character-preview-card">
      <h2>VR Avatar</h2><p>Local blendshape preview · Aether Core is not connected</p>
      <div className="animation-character-render animation-character-render--vr"><FacePreview mouth={jaw} smile={smile} blink={blink} yaw={yaw} /></div>
    </section>
    <section className="animation-tracking-card"><AetherIcon name="webcam" /><span>Face tracking is unavailable in this concept; use the preview sliders.</span><Button disabled>Start camera</Button></section>
    <section className="animation-character-controls">
      <ParameterSlider label="Jaw open" value={jaw} onChange={setJaw} />
      <ParameterSlider label="Smile" value={smile} onChange={setSmile} />
      <ParameterSlider label="Blink" value={blink} onChange={setBlink} />
      <ParameterSlider label="Head turn" min={-1} value={yaw} onChange={setYaw} />
    </section>
  </div>;
}

export interface DesignShape { id:string; tool:string; name:string; x:number; y:number; material:string; appearance:string; opacity:number; visible:boolean; rotation:number }
export interface StudioDesignState { shapes:DesignShape[]; selected:string|null; }
export function StudioDesignWorkspace({activeTool,value,onChange}: {activeTool:string|null;value:StudioDesignState;onChange:(value:StudioDesignState)=>void}) {
  const place=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(!activeTool?.startsWith("design-")){onChange({...value,selected:null});return;}
    const rect=event.currentTarget.getBoundingClientRect();const tool=activeTool.replace("design-","");
    const shape:DesignShape={id:crypto.randomUUID(),tool,name:`${tool[0].toUpperCase()+tool.slice(1)} ${value.shapes.filter(item=>item.tool===tool).length+1}`,x:Math.min(Math.max(event.clientX-rect.left,90),Math.max(90,rect.width-90)),y:Math.min(Math.max(event.clientY-rect.top,70),Math.max(70,rect.height-70)),material:"Not set",appearance:"Default",opacity:1,visible:true,rotation:0};
    onChange({shapes:[...value.shapes,shape],selected:shape.id});
  };
  return <div className="animation-design-workspace" onPointerDown={place}>
    <div className="animation-design-grid"/><span className="animation-design-badge"><AetherIcon name="hammer"/> DESIGN SANDBOX · PLACEHOLDER GEOMETRY</span>
    {value.shapes.map(shape=><button key={shape.id} type="button" className={value.selected===shape.id?"animation-design-shape is-selected":"animation-design-shape"} style={{left:shape.x,top:shape.y,opacity:shape.visible?shape.opacity:.25,transform:`translate(-50%, -50%) rotate(${shape.rotation}deg)`}} onPointerDown={event=>{event.stopPropagation();onChange({...value,selected:shape.id});}}>
      <AetherIcon name={shape.tool==="sketch"?"sketch":"cube"}/><strong>{shape.name}</strong><small>Sandbox feature card</small><span>X {Math.round(shape.x)} · Y {Math.round(shape.y)}</span>
    </button>)}
    {!value.shapes.length && <div className="animation-design-empty"><AetherIcon name="design"/><strong>Choose a Design tool</strong><span>Then click the grid to place a placeholder feature.</span></div>}
  </div>;
}
export function StudioDesignBrowser({title,value,onChange}: {title:string;value:StudioDesignState;onChange:(value:StudioDesignState)=>void}) {
  return <TreePanel ariaLabel={title} nodes={title==="Mates"?[]:value.shapes.map(shape=>({id:shape.id,label:shape.name,dimmed:!shape.visible,icon:<AetherIcon name="cube"/>}))} selectedIDs={new Set(value.selected?[value.selected]:[])} onSelect={ids=>onChange({...value,selected:ids[0]??null})} emptyState={`No ${title.toLowerCase()} yet — use the Design tools to create a placeholder.`} controls={[{id:"delete",label:"Delete selected feature",icon:<AetherIcon name="delete"/>,disabled:!value.selected,shortcut:"Delete",onClick:()=>onChange({shapes:value.shapes.filter(shape=>shape.id!==value.selected),selected:null})}]}/>;
}
export function StudioDesignInspector({value,onChange}: {value:StudioDesignState;onChange:(value:StudioDesignState)=>void}) {
  const shape=value.shapes.find(item=>item.id===value.selected);
  if(!shape)return <div className="studio-reference-panel"><h3>PART PROPERTIES</h3><p>Select a sandbox feature to edit its properties.</p></div>;
  const update=(patch:Partial<DesignShape>)=>onChange({...value,shapes:value.shapes.map(item=>item.id===shape.id?{...item,...patch}:item)});
  return <div className="studio-reference-panel"><section><h3>GENERAL</h3><label>Name<TextField aria-label="Feature name" value={shape.name} onChange={event=>update({name:event.target.value})}/></label>
    <label>Material<SelectField aria-label="Feature material" value={shape.material} options={["Not set","Aluminum","Steel","ABS Plastic","PLA"].map(label=>({value:label,label}))} onChange={event=>update({material:event.target.value})}/></label>
    <label>Appearance<SelectField aria-label="Feature appearance" value={shape.appearance} options={["Default","Painted","Anodized","Brushed","Matte"].map(label=>({value:label,label}))} onChange={event=>update({appearance:event.target.value})}/></label>
    <label>Opacity<input aria-label="Feature opacity" type="range" min={.1} max={1} step={.01} value={shape.opacity} onChange={event=>update({opacity:Number(event.target.value)})}/></label><Checkbox label="Visible" checked={shape.visible} onChange={event=>update({visible:event.target.checked})}/></section>
    <section><h3>TRANSFORM</h3><span>X {Math.round(shape.x)} px · Y {Math.round(shape.y)} px</span><label>Rotation<NumberField aria-label="Feature rotation" value={shape.rotation} min={-180} max={180} unit="deg" onCommit={rotation=>update({rotation})}/></label></section><Button onClick={()=>onChange({shapes:value.shapes.filter(item=>item.id!==shape.id),selected:null})}>Delete</Button>
  </div>;
}
