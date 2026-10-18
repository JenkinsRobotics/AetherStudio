import { useState } from "react";
import { Inspector, InspectorSection } from "./Inspector";
import { FieldRow } from "./FieldRow";
import { TextField } from "./TextField";
import { Slider } from "./Slider";
import { SegmentedControl } from "./SegmentedControl";
import "./ConceptInspectors.css";

export interface AppearanceValue { color: string; opacity: number; tessellation: "auto" | "high" }
export interface AppearanceInspectorProps { value?: AppearanceValue; onChange?: (value: AppearanceValue) => void; showTessellation?: boolean }
export function AppearanceInspector({ value, onChange, showTessellation = true }: AppearanceInspectorProps) {
  const [local, setLocal] = useState<AppearanceValue>({ color: "#9dcfed", opacity: 100, tessellation: "auto" });
  const [mode, setMode] = useState("palette");
  const [draft, setDraft] = useState<string | null>(null);
  const current = value ?? local;
  const update = (patch: Partial<AppearanceValue>) => { const next = { ...current, ...patch }; setLocal(next); onChange?.(next); };
  const colors = ["#000000", "#009dff", "#ff3045", "#ffffff", "#999999", "#ff9634", "#ffca00", "#c52dd9", "#55565b", "#447db2", "#51ad94", "#9dcfed", "#c85d36", "#e89b22", "#6659d4", "#b156a6"];
  const rgb = /^#[\da-f]{6}$/i.test(current.color) ? [1,3,5].map((n) => parseInt(current.color.slice(n,n+2),16)) : [0,0,0];
  return <Inspector><section aria-label="Appearance inspector"><InspectorSection title="Appearance">

    <FieldRow label="Mode"><SegmentedControl ariaLabel="Appearance mode" value={mode} onChange={setMode} options={[{id:"palette",label:"Palette"},{id:"mixer",label:"Mixer"}]}/></FieldRow>
    {mode === "palette" ? <div className="aui-appearance-swatches">{colors.map((color) => <button type="button" key={color} aria-label={`Use color ${color}`} aria-pressed={current.color === color} style={{ background: color }} onClick={() => { setDraft(null); update({color}); }}>{current.color === color ? "✓" : null}</button>)}</div> : <FieldRow label="Color"><input aria-label="Appearance color" type="color" value={current.color} onChange={(e) => { setDraft(null); update({color:e.target.value}); }}/></FieldRow>}
    <FieldRow label="Hex"><TextField aria-label="Hex" value={draft ?? current.color.toUpperCase()} aria-invalid={draft !== null && !/^#[\da-f]{6}$/i.test(draft)} onChange={(e) => { setDraft(e.target.value); if (/^#[\da-f]{6}$/i.test(e.target.value)) update({color:e.target.value.toLowerCase()}); }} onBlur={() => setDraft(null)}/></FieldRow>
    <FieldRow label="RGB"><output>{rgb.join(" · ")}</output></FieldRow>
    <FieldRow label="Opacity"><Slider ariaLabel="Appearance opacity" min={0} max={100} value={current.opacity} unit="%" onChange={opacity => update({opacity})}/></FieldRow>
    {showTessellation && <FieldRow label="Tessellation"><SegmentedControl ariaLabel="Tessellation" value={current.tessellation} onChange={(id) => update({tessellation:id as AppearanceValue["tessellation"]})} options={[{id:"auto",label:"Auto"},{id:"high",label:"High"}]}/></FieldRow>}
  </InspectorSection></section></Inspector>;
}
