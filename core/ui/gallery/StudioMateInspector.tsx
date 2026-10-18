import { useState } from "react";
import { Checkbox, SelectField } from "../src/index";
import { ConfigurationInspector, type ConfigurationKind, type ConfigurationValue } from "../src/ConceptWidgets";

// Archived presentation catalog; no solver or animation semantics live here.
export const studioMateKinds: readonly ConfigurationKind[] = [
  {id:"fastened",label:"Fastened",detail:"Locks both connectors together.",offset:true},
  {id:"parallel",label:"Parallel",detail:"XYZ translation · Z rotation",offset:true,rotation:true,limits:true},
  {id:"slider",label:"Slider",detail:"Z translation",offset:true,limits:true},
  {id:"revolute",label:"Revolute",detail:"Z rotation",offset:true,rotation:true,limits:true},
  {id:"cylindrical",label:"Cylindrical",detail:"Z translation · Z rotation",offset:true,rotation:true,limits:true},
  {id:"pin-slot",label:"Pin Slot",detail:"X translation · Z rotation",offset:true,rotation:true,limits:true},
  {id:"planar",label:"Planar",detail:"XY translation · Z rotation",offset:true,rotation:true,limits:true},
  {id:"ball",label:"Ball",detail:"XYZ rotation",offset:true,rotation:true,limits:true},
  {id:"width",label:"Width",detail:"Centered between two geometry references"},
  {id:"tangent",label:"Tangent",detail:"Surface contact"},
];

export function StudioMateInspector({kind="slider",onApply,onCancel}: {kind?:string;onApply?:()=>void;onCancel?:()=>void}) {
  return <ConfigurationInspector title="Mate Editor" kinds={studioMateKinds} onApply={onApply} onCancel={onCancel} offsetUnit="mm" rotationUnit="deg" connectors={[{value:"torso-head",label:"Torso → Head"},{value:"base-torso",label:"Base → Torso"}]} initialValue={{name:"Head Yaw",kind,offset:true,limits:true,simulation:false,x:0,y:0,z:0,angle:0,min:-70,max:70}}/>;
}

/** The native UI Dev lab keeps its tuning controls alongside the live panel. */
export function MateEditorLabSpecimen() {
  const [value,setValue]=useState<ConfigurationValue>({name:"Head Yaw",kind:"slider",offset:true,limits:true,simulation:false,x:0,y:0,z:0,angle:0,min:-70,max:70});
  const kind=studioMateKinds.find((entry)=>entry.id===value.kind)!;
  const patch=(next:Partial<ConfigurationValue>)=>setValue((current)=>({...current,...next}));
  return <div className="animation-mate-lab">
    <section><header><strong>Live Mate panel</strong><p>Switch type and Offset to compare the compact and expanded states.</p></header>
      <ConfigurationInspector title="Mate Editor" kinds={studioMateKinds} value={value} onChange={setValue} offsetUnit="mm" rotationUnit="deg" connectors={[{value:"torso-head",label:"Torso → Head"},{value:"base-torso",label:"Base → Torso"}]}/>
    </section>
    <section><header><strong>Lab controls</strong><p>Tune state and density here before binding the panel to mate data.</p></header>
      <label>Mate Type<SelectField value={value.kind} options={studioMateKinds.map((entry)=>({value:entry.id,label:entry.label}))} onChange={(event)=>patch({kind:event.target.value})}/></label>
      <Checkbox label="Show Offset controls" checked={value.offset} disabled={!kind.offset} onChange={(event)=>patch({offset:event.target.checked})}/>
      <Checkbox label="Show Limits controls" checked={value.limits} disabled={!kind.limits} onChange={(event)=>patch({limits:event.target.checked})}/>
      <Checkbox label="Simulation connection" checked={value.simulation} onChange={(event)=>patch({simulation:event.target.checked})}/>
      <small>Degrees of Freedom</small><output>{kind.detail}</output>
    </section>
    <section><header><strong>Interaction rules</strong><p>The panel stays dense without hiding state or units.</p></header>
      {[["One primary decision row","Accept and Cancel remain fixed in the header."],["Progressive disclosure","Offset fields exist only while Offset is enabled."],["Type-owned motion","Capabilities follow the selected mate type."],["Connector first","Choose the geometry references before applying."],["Explicit units","Distance uses mm and rotation uses degrees in the operator UI."]].map(([title,detail])=><div key={title}><strong>{title}</strong><p>{detail}</p></div>)}
    </section>
  </div>;
}
