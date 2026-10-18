import { useState } from "react";
import { Inspector, InspectorSection, InspectorActions } from "./Inspector";
import { FieldRow } from "./FieldRow";
import { TextField } from "./TextField";
import { Checkbox } from "./Checkbox";
import { NumberField } from "./NumberField";
import { SelectField } from "./SelectField";
import { Button } from "./Button";
import "./ConceptInspectors.css";

export interface ConfigurationKind { id: string; label: string; detail?: string; offset?: boolean; rotation?: boolean; limits?: boolean }
export interface ConfigurationValue { name: string; kind: string; connector?: string; offset: boolean; limits: boolean; simulation: boolean; x: number; y: number; z: number; angle: number; min: number; max: number }
export interface ConfigurationInspectorProps {
  kinds: readonly ConfigurationKind[];
  value?: ConfigurationValue;
  initialValue?: ConfigurationValue;
  connectors?: readonly {value:string;label:string}[];
  offsetUnit?: string;
  rotationUnit?: string;
  onChange?: (value: ConfigurationValue) => void;
  onApply?: (value: ConfigurationValue) => void;
  onCancel?: () => void;
  title?: string;
}
/** Presentation only. Kind capabilities and units are supplied by the owner. */
export function ConfigurationInspector({ kinds, value, initialValue, connectors = [], offsetUnit, rotationUnit, onChange, onApply, onCancel, title = "Configuration" }: ConfigurationInspectorProps) {
  const [local, setLocal] = useState<ConfigurationValue>(initialValue ?? {name:"Configuration",kind:kinds[0]?.id ?? "",offset:true,limits:true,simulation:false,x:0,y:0,z:0,angle:0,min:-70,max:70});
  const [applied, setApplied] = useState(false);
  const [checkpoint, setCheckpoint] = useState(value ?? local);
  const current = value ?? local;
  const kind = kinds.find((entry) => entry.id === current.kind) ?? kinds[0];
  const update = (patch: Partial<ConfigurationValue>) => { const next = {...current,...patch}; setLocal(next); setApplied(false); onChange?.(next); };
  return <Inspector><section aria-label={title}><InspectorSection title={title}>
    <InspectorActions label="Configuration actions"><Button aria-label="Accept configuration" onClick={() => { setApplied(true); setCheckpoint(current); onApply?.(current); }}>✓</Button><Button aria-label="Cancel configuration" onClick={() => { setLocal(checkpoint); onChange?.(checkpoint); onCancel?.(); setApplied(false); }}>×</Button></InspectorActions>
    <FieldRow label="Name"><TextField aria-label="Name" value={current.name} onChange={(e) => update({name:e.target.value})}/></FieldRow>
    <FieldRow label="Type"><SelectField aria-label="Type" value={current.kind} onChange={(e) => update({kind:e.target.value})} options={kinds.map((entry) => ({value:entry.id,label:entry.label}))}/></FieldRow>
    {connectors.length ? <FieldRow label="Connectors"><SelectField aria-label="Connectors" value={current.connector ?? connectors[0]?.value} options={connectors} onChange={(event)=>update({connector:event.target.value})}/></FieldRow> : null}
    <small>{kind?.detail}</small>
    <Checkbox label="Offset" checked={current.offset} disabled={!kind?.offset} onChange={(e) => update({offset:e.target.checked})}/>
    {current.offset && kind?.offset ? <>{(["x","y","z"] as const).map((axis) => <FieldRow key={axis} label={axis.toUpperCase()}><NumberField aria-label={`Offset ${axis.toUpperCase()}`} value={current[axis]} unit={offsetUnit} onValueChange={(n) => update({[axis]:n ?? 0})}/></FieldRow>)}{kind.rotation ? <FieldRow label="Rotation"><NumberField aria-label="Offset rotation" value={current.angle} unit={rotationUnit} onValueChange={(n) => update({angle:n ?? 0})}/></FieldRow> : null}</> : null}
    <Checkbox label="Limits" checked={current.limits} disabled={!kind?.limits} onChange={(e) => update({limits:e.target.checked})}/>
    {current.limits && kind?.limits ? <div><FieldRow label="Minimum"><NumberField aria-label="Minimum" value={current.min} unit={kind.rotation ? rotationUnit : offsetUnit} onValueChange={(n) => update({min:n ?? 0})}/></FieldRow><FieldRow label="Maximum"><NumberField aria-label="Maximum" value={current.max} unit={kind.rotation ? rotationUnit : offsetUnit} onValueChange={(n) => update({max:n ?? 0})}/></FieldRow></div> : null}
    <Checkbox label="Simulation connection" checked={current.simulation} onChange={(e) => update({simulation:e.target.checked})}/>
    <output aria-live="polite">{applied ? "Configuration applied" : "Editing configuration"}</output>
  </InspectorSection></section></Inspector>;
}
