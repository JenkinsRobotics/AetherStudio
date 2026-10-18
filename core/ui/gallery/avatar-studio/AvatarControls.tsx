import { AetherIcon, Button, Checkbox, ColorField, FieldRow, Inspector, InspectorSection, MediaPreview, SelectField, Slider, TextField, ThumbnailPicker } from "../../src";
import { LOOKS, OUTPUTS, SCENES, presenter, type SceneState } from "./data";
export function ScenePicker({value,onChange}:{value:string;onChange:(id:string)=>void}) {
  return <ThumbnailPicker label="Scenes" value={value} onChange={onChange} items={SCENES.map(scene=>({ ...scene, preview:<div style={{background:scene.background}}>{scene.image && <img src={scene.image} alt="" style={{width:"100%",height:"100%",objectFit:"cover",filter:scene.filter}}/>}</div> }))}/>;
}
export function AvatarPicker({value,onChange}:{value:string;onChange:(id:string)=>void}) {
  return <ThumbnailPicker label="Avatar looks" value={value} onChange={onChange} items={LOOKS.map(look=>({...look,preview:<img src={presenter} alt="" style={{objectFit:"cover",objectPosition:"top",filter:look.filter}}/>}))}/>;
}
export function AvatarControls({state,patch}:{state:SceneState;patch:(value:Partial<SceneState>)=>void}) {
  return <Inspector><InspectorSection title="Framing"><FieldRow label="Size"><Slider ariaLabel="Avatar size" min={60} max={150} unit="%" value={state.zoom} onChange={zoom=>patch({zoom})}/></FieldRow><FieldRow label="Position"><Slider ariaLabel="Horizontal position" min={-35} max={35} value={state.offset} onChange={offset=>patch({offset})}/></FieldRow><Checkbox checked={state.mirrored} onChange={event=>patch({mirrored:event.target.checked})} label="Mirror avatar"/><Button appearance="link" onClick={()=>patch({zoom:100,offset:0,mirrored:false})}>Reset framing</Button></InspectorSection></Inspector>;
}
export function OutputControls({state,patch}:{state:SceneState;patch:(value:Partial<SceneState>)=>void}) {
  return <Inspector><InspectorSection title="Output"><FieldRow label="Resolution"><SelectField aria-label="Output resolution" value={state.output} onChange={e=>patch({output:e.target.value})} options={OUTPUTS.map(item=>({value:item.id,label:item.label}))}/></FieldRow><p className="avatar-hint">The white frame shows the exported image. Portrait and square formats crop the scene to fit.</p></InspectorSection></Inspector>;
}
export function MarkupControls({caption,color,width,onCaption,onColor,onWidth,onClear}:{caption:string;color:string;width:number;onCaption:(text:string)=>void;onColor:(hex:string)=>void;onWidth:(value:number)=>void;onClear:()=>void}) {
  return <Inspector><InspectorSection title="Annotations"><FieldRow label="Text"><TextField aria-label="Overlay text" placeholder="Say hello…" value={caption} maxLength={80} onChange={e=>onCaption(e.target.value)}/></FieldRow><FieldRow label="Color"><ColorField ariaLabel="Annotation color" value={color} onChange={onColor}/></FieldRow><FieldRow label="Brush"><Slider ariaLabel="Brush width" min={2} max={14} unit="px" value={width} onChange={onWidth}/></FieldRow><Button onClick={onClear}><AetherIcon name="delete"/>Clear annotations</Button></InspectorSection></Inspector>;
}
export function AvatarScene({state,playing=false,children}:{state:SceneState;playing?:boolean;children?:React.ReactNode}) {
  const scene=SCENES.find(item=>item.id===state.scene)!; const look=LOOKS.find(item=>item.id===state.look)!;const output=OUTPUTS.find(item=>item.id===state.output)!;
  return <MediaPreview label="Scene preview" width={output.width} height={output.height} background={scene.background} backgroundImage={scene.image} backgroundFilter={scene.filter} foreground={{src:presenter,alt:"Silver-haired illustrated presenter",scale:state.zoom,offset:state.offset,mirrored:state.mirrored,filter:look.filter}} playing={playing}>{children}</MediaPreview>;
}
