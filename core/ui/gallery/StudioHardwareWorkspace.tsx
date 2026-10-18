import { useState } from "react";
import { AetherIcon, Button, DataTable, Dialog, FieldRow, NumberField, SelectField, type DataTableColumn } from "../src/index";
import "./StudioHardwareWorkspace.css";
export interface PreviewMapping { id:string; channel:number; target:string; zero:number; one:number; }
const targets=[{value:"pan.rotation",label:"Head Pan"},{value:"tilt.rotation",label:"Head Tilt"},{value:"jaw.rotation",label:"Jaw"}];
export function StudioHardwareWorkspace({mappings,onChange,editorOpen,onEditorClose,onAdd}: {
  mappings:readonly PreviewMapping[];onChange:(mappings:PreviewMapping[])=>void;editorOpen:boolean;onEditorClose:()=>void;onAdd:()=>void;
}) {
  const [editing,setEditing]=useState<PreviewMapping|null>(null);
  const [removing,setRemoving]=useState<PreviewMapping|null>(null);
  const [selected,setSelected]=useState<ReadonlySet<string>>(new Set());
  const columns:DataTableColumn<PreviewMapping>[]=[
    {id:"channel",header:"CHANNEL",width:95,cell:row=>row.channel},
    {id:"target",header:"TARGET",width:300,cell:row=><span>{targets.find(target=>target.value===row.target)?.label}<small>{row.target}</small></span>},
    {id:"range",header:"0% → 100%",width:190,cell:row=>`${row.zero} → ${row.one} deg`},
    {id:"direction",header:"DIRECTION",width:130,cell:row=>row.zero>row.one?"Reverse":"Forward"},
    {id:"actions",header:"",width:155,cell:row=><><Button aria-label={`Edit channel ${row.channel}`} onClick={()=>setEditing(row)}>Edit</Button><Button aria-label={`Remove channel ${row.channel}`} onClick={()=>setRemoving(row)}><AetherIcon name="delete"/></Button></>},
  ];
  return <div className="animation-workspace-card studio-hardware-workspace"><div className="studio-hardware-cards">
    <section><h3><AetherIcon name="hardware"/>Driver Connection</h3><dl><dt>Authoring</dt><dd>{mappings.length?"Mappings ready":"No mappings"}</dd><dt>Live transport</dt><dd>Offline</dd><dt>Drivers</dt><dd>0 connected</dd></dl><Button disabled>Connect Driver</Button></section>
    <section><h3><AetherIcon name="lock"/>Safety</h3><dl><dt>Master Live</dt><dd>Disarmed</dd><dt>Failsafe</dt><dd>No active session</dd><dt>Heartbeat</dt><dd>Not running</dd></dl><p>Editing mappings never arms or moves outputs.</p></section>
    <section><h3><AetherIcon name="connector"/>Output Mapping</h3><dl><dt>Mappings</dt><dd>{mappings.length}</dd><dt>Channels</dt><dd>{new Set(mappings.map(row=>row.channel)).size}</dd><dt>Reversed</dt><dd>{mappings.filter(row=>row.zero>row.one).length}</dd></dl><Button onClick={onAdd}>Add Mapping</Button></section>
  </div>
  <section><header><h3>Output Mappings</h3><span>Local authoring preview</span><Button onClick={onAdd}>Add</Button></header><DataTable ariaLabel="Output mappings" rows={mappings} rowID={row=>row.id} columns={columns} selectedIDs={selected} onSelect={ids=>setSelected(new Set(ids))} emptyState="No Output Mappings — add a mapping for a normalized 0–1 channel."/></section>
  <section><header><h3>Driver Log</h3><span>Offline</span></header><div className="studio-hardware-empty"><AetherIcon name="document"/><strong>No Driver Session</strong><p>Live transport is not connected in this UI demonstration.</p></div></section>
  {(editorOpen||editing) && <MappingEditor key={editing?.id??"new"} mappings={mappings} mapping={editing??undefined} onCancel={()=>{setEditing(null);onEditorClose();}} onSave={mapping=>{onChange(editing?mappings.map(row=>row.id===editing.id?mapping:row):[...mappings,mapping]);setEditing(null);onEditorClose();}}/>}
  <Dialog open={!!removing} title="Remove Output Mapping?" onClose={()=>setRemoving(null)} actions={<><Button onClick={()=>setRemoving(null)}>Cancel</Button><Button onClick={()=>{onChange(mappings.filter(row=>row.id!==removing?.id));setRemoving(null);}}>Remove Mapping</Button></>}><p>Remove channel {removing?.channel} from {removing?.target}? This does not connect to or move hardware.</p></Dialog>
  </div>;
}
function MappingEditor({mapping,mappings,onCancel,onSave}:{mapping?:PreviewMapping;mappings:readonly PreviewMapping[];onCancel:()=>void;onSave:(mapping:PreviewMapping)=>void}) {
  const [draft,setDraft]=useState<PreviewMapping>(()=>{let channel=0;while(mappings.some(row=>row.channel===channel))channel++;return mapping??{id:crypto.randomUUID(),channel,target:"pan.rotation",zero:-90,one:90};});
  const invalid=!Number.isInteger(draft.channel)||draft.channel<0||draft.channel>65535?"Channel must be an integer from 0 to 65535.":mappings.some(row=>row.id!==draft.id && row.channel===draft.channel)?"This channel already has a mapping.":!Number.isFinite(draft.zero)||!Number.isFinite(draft.one)||draft.zero===draft.one?"Endpoints must be finite and different.":null;
  return <Dialog open title={mapping?"Edit Output Mapping":"Add Output Mapping"} onClose={onCancel} actions={<><Button onClick={onCancel}>Cancel</Button><Button primary disabled={!!invalid} onClick={()=>onSave(draft)}>Save Mapping</Button></>}>
    <div className="studio-reference-panel"><FieldRow label="Target"><SelectField aria-label="Mapping target" value={draft.target} onChange={event=>setDraft({...draft,target:event.target.value})} options={targets}/></FieldRow>
      <FieldRow label="Channel"><NumberField aria-label="Output channel" value={draft.channel} min={0} max={65535} onValueChange={value=>setDraft({...draft,channel:value??NaN})}/></FieldRow><h3>NORMALIZED CHANNEL RANGE</h3>
      <FieldRow label="0%"><NumberField aria-label="Value at zero" value={draft.zero} unit="deg" onValueChange={value=>setDraft({...draft,zero:value??NaN})}/></FieldRow>
      <FieldRow label="100%"><NumberField aria-label="Value at one" value={draft.one} unit="deg" onValueChange={value=>setDraft({...draft,one:value??NaN})}/></FieldRow><Button onClick={()=>setDraft({...draft,zero:draft.one,one:draft.zero})}>Reverse Endpoints</Button>
      {invalid?<p role="alert">{invalid}</p>:<p>Authoring preview · endpoints describe the target's range at normalized channel values 0 and 1.</p>}
    </div>
  </Dialog>;
}
