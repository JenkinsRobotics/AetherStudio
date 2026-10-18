import type { StudioSpecimenKind } from "../showcase/studio-specimen-sections";
import { useState } from "react";
import { Button, Checkbox } from "../../src";
import { AvatarControls, AvatarPicker, AvatarScene, MarkupControls, OutputControls, ScenePicker } from "./AvatarControls";
import { Annotations } from "./Annotations";
import { INITIAL, OUTPUTS, type SceneState } from "./data";
import "./avatar-studio.css";
export function AvatarStudioSpecimens({ kind }: { kind: StudioSpecimenKind }) {
  const [state,setState]=useState<SceneState>(INITIAL),[brush,setBrush]=useState(4);
  const patch=(value:Partial<SceneState>)=>setState(current=>({...current,...value}));
  return <div className="avatar-widget-grid">
    {kind === "appearance" && <div><small className="showcase-studio-source">Avatar Studio</small><ScenePicker value={state.scene} onChange={scene=>patch({scene})}/></div>}
    {kind === "appearance" && <div><small className="showcase-studio-source">Avatar Studio</small><AvatarPicker value={state.look} onChange={look=>patch({look})}/></div>}
    {kind === "viewports" && <div><small className="showcase-studio-source">Avatar Studio</small><h3>Avatar framing</h3><AvatarControls state={state} patch={patch}/></div>}
    {kind === "inspectors" && <div><small className="showcase-studio-source">Avatar Studio</small><h3>Output settings</h3><OutputControls state={state} patch={patch}/></div>}
    {kind === "inspectors" && <div><small className="showcase-studio-source">Avatar Studio</small><h3>Annotation settings</h3><MarkupControls caption={state.caption} color={state.captionColor} width={brush} onCaption={caption=>patch({caption})} onColor={captionColor=>patch({captionColor})} onWidth={setBrush} onClear={()=>patch({caption:"",strokes:[]})}/></div>}
  </div>;
}
export function MediaPreviewSpecimen() {
  const [state,setState]=useState<SceneState>({...INITIAL,caption:"Hello, world!"}),[drawing,setDrawing]=useState(false);
  const output=OUTPUTS.find(item=>item.id===state.output)!;
  return <div className="avatar-preview-specimen"><AvatarScene state={state}><Annotations strokes={state.strokes} caption={state.caption} color={state.captionColor} brushWidth={4} aspect={output.width/output.height} drawing={drawing} onStroke={stroke=>setState(current=>({...current,strokes:[...current.strokes,stroke]}))}/></AvatarScene>
    <div className="avatar-specimen-actions" style={{marginTop:12}}><Checkbox label="Draw on preview" checked={drawing} onChange={e=>setDrawing(e.target.checked)}/><Button onClick={()=>setState(INITIAL)}>Clear annotations</Button></div>
  </div>;
}
