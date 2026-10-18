import { Checkbox, ColorField, Inspector, InspectorSection, MaterialSwatch, NumberField, SelectField, Slider, TextField, FeatureTree } from "../../src";
import { finishes, type WheelDisplay, type WheelStudy } from "./state";
export function WheelBrowser({ wheel, selected, onSelect, onVisibility, assembly }: { wheel: WheelStudy; selected: string; onSelect(id: string): void; onVisibility(): void; assembly: boolean }) {
  return <FeatureTree ariaLabel="Wheel features" partsLabel="Wheel parts" selectedIDs={new Set([selected])} onSelect={ids=>onSelect(ids[0])}
    features={[
      {id:"profile",label:"Wheel profile",type:"sketch",kind:"feature"},
      {id:"revolve",label:"Revolve · 360°",type:"revolve",kind:"feature"},
      {id:"tread",label:"Tread width",type:"extrude",kind:"feature"},
      {id:"flange",label:"Outer flange",type:"chamfer",kind:"feature"},
      {id:"bore",label:"Axle bore",type:"hole",kind:"feature"},
      {id:"rounding",label:"Edge rounding",type:"fillet",kind:"feature"},
      {id:"appearance",label:"Steel finish",type:"appearance",kind:"feature"},
    ]} parts={[{id:"wheel",label:assembly?"Wheel pair":wheel.name||"Wheel",type:"part",kind:"part",hidden:!wheel.visible},...(assembly?[{id:"axle",label:"Axle",type:"part",kind:"part" as const}]:[])]}
    availableCommands={["visibility","edit"]} canCommand={request=>request.command === "visibility"?request.ids.every(id=>id === "wheel") || "Visibility is controlled by the rendered wheel.":!request.ids.some(id=>["origin","top","front","right","axle"].includes(id))}
    onCommand={request=>{if(request.command === "visibility")onVisibility();else if(request.command === "edit")onSelect(request.ids[0]);}}/>;
}
export function WheelDimensions({ wheel, onChange, rounding = false }: { wheel: WheelStudy; onChange(patch: Partial<WheelStudy>): void; rounding?: boolean }) {
  return <Inspector><InspectorSection title={rounding ? "Edge rounding" : "Revolved wheel profile"}>
    {!rounding && ([['diameter', 'Tread diameter', 180, 700], ['width', 'Width', 50, wheel.diameter * .5], ['bore', 'Axle bore', 12, wheel.diameter * .22], ['flange', 'Flange height', 8, wheel.diameter * .12]] as const).map(([id, label, min, max]) => <label className="ws-field" key={id}><span>{label}</span><NumberField aria-label={label} value={wheel[id]} min={min} max={max} unit="mm" onCommit={value => onChange({ [id]: value })}/></label>)}
    <label className="ws-field"><span>Edge radius</span><NumberField aria-label="Edge radius" value={wheel.rounding} min={.2} max={Math.min(wheel.width * .06, wheel.flange * .4)} step={.2} unit="mm" onCommit={rounding => onChange({ rounding })}/></label>
    <p className="ws-hint">A continuous 360° profile with a recessed web, tread, flange and through bore.</p>
  </InspectorSection></Inspector>;
}
export function WheelProperties({ wheel, onChange, display, onDisplay, assembly }: { wheel: WheelStudy; onChange(patch: Partial<WheelStudy>): void; display: WheelDisplay; onDisplay(value: WheelDisplay): void; assembly: boolean }) {
  const finish = finishes.find(f => f.color === wheel.color);
  return <Inspector>
    <InspectorSection title="Details" defaultOpen><label className="ws-field"><span>Name</span><TextField aria-label="Part name" value={wheel.name} onChange={event => onChange({ name: event.target.value })}/></label><dl className="ws-details"><dt>Type</dt><dd>{assembly ? "Wheelset assembly" : "Part Studio"}</dd><dt>Document</dt><dd>Train Cart Wheel</dd><dt>Workspace</dt><dd>Main · local concept</dd><dt>Model units</dt><dd>Millimeters (mm)</dd></dl></InspectorSection>
    <InspectorSection title="Display" defaultOpen><label className="ws-field"><span>Material</span><SelectField aria-label="Material" value={finish?.name ?? "custom"} options={[...finishes.map(f => ({ value: f.name, label: f.name })), ...(!finish ? [{ value: "custom", label: "Custom" }] : [])]} onChange={event => { const f = finishes.find(f => f.name === event.target.value); if (f) onChange({ color: f.color, roughness: f.roughness, metalness: f.metalness }); }}/></label><label className="ws-range">Opacity<Slider ariaLabel="Opacity" min={10} max={100} value={Math.round(wheel.opacity * 100)} unit="%" onChange={value => onChange({ opacity: value / 100 })}/></label></InspectorSection>
    <InspectorSection title="Analysis" defaultOpen>{([['edges', 'Show edges'], ['grid', 'Ground grid'], ['section', 'Cutaway view'], ['bounds', 'Bounding box']] as const).map(([key, label]) => <Checkbox key={key} label={label} checked={display[key]} onChange={event => onDisplay({ ...display, [key]: event.target.checked })}/>)}{display.section && <p className="ws-hint">Open clipping view through the axle. Cut surfaces are not capped.</p>}</InspectorSection>
    <InspectorSection title="Dimensions" defaultOpen={false}><dl className="ws-details"><dt>Overall diameter</dt><dd>{wheel.diameter + wheel.flange * 2} mm</dd><dt>Width</dt><dd>{wheel.width} mm</dd><dt>Bore</dt><dd>Ø {wheel.bore} mm</dd></dl></InspectorSection>
  </Inspector>;
}
export function WheelAppearance({ wheel, onChange }: { wheel: WheelStudy; onChange(patch: Partial<WheelStudy>): void }) {
  return <Inspector><InspectorSection title="Surface finish"><div className="ws-finishes">{finishes.map(finish => <button key={finish.name} type="button" aria-label={`Apply ${finish.name}`} aria-pressed={wheel.color === finish.color} onClick={() => onChange({ color: finish.color, metalness: finish.metalness, roughness: finish.roughness })}><MaterialSwatch color={finish.color} roughness={finish.roughness} size="large"/><span>{finish.name}</span></button>)}</div><ColorField ariaLabel="Wheel color" value={wheel.color} onChange={color => onChange({ color })}/><label className="ws-range">Roughness<Slider ariaLabel="Roughness" min={.08} max={1} step={.01} value={wheel.roughness} onChange={roughness => onChange({ roughness })}/></label><label className="ws-range">Metalness<Slider ariaLabel="Metalness" min={0} max={1} step={.01} value={wheel.metalness} onChange={metalness => onChange({ metalness })}/></label></InspectorSection></Inspector>;
}
