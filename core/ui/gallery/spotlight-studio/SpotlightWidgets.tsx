import { Checkbox, ColorField, MaterialSwatch, NumberField, SegmentedControl, Slider, FeatureTree } from "../../src";
import { LIGHT_PRESETS, maxRadius, type Lighting, type Study } from "./state";

export type Inspector = "shape" | "rounding" | "surface" | "lighting";
export function StudyBrowser({ study, selected, onSelect, onVisibility }: { study: Study; selected: string; onSelect: (id: string) => void; onVisibility: (id: "body" | "lid") => void }) {
  return <FeatureTree ariaLabel="Study features" partsLabel="Study parts" selectedIDs={new Set([selected])} onSelect={ids=>onSelect(ids[0])}
    features={[
      {id:"shape",label:"Enclosure dimensions",kind:"feature",type:"extrude"},
      {id:"rounding",label:"Edge rounding",kind:"feature",type:"fillet"},
      {id:"surface",label:"Surface finish",kind:"feature",type:"appearance"},
      {id:"lighting",label:"Studio lighting",kind:"feature",type:"lighting"},
    ]} parts={(["body","lid"] as const).map(id=>({id,label:id === "body"?"Body":"Lid",kind:"part",type:"part",hidden:!study[id]}))}
    availableCommands={["visibility","edit"]} canCommand={request=>request.command === "visibility"?request.ids.every(id=>id === "body" || id === "lid") || "Only rendered parts have visibility in this study.":request.ids.every(id=>["shape","rounding","surface","lighting"].includes(id))}
    onCommand={request=>{if(request.command === "visibility")request.ids.forEach(id=>onVisibility(id as "body"|"lid"));else if(request.command === "edit")onSelect(request.ids[0]);}}/>;
}
export function StudyGeometry({ study, onChange, rounding = false }: { study: Study; onChange: (patch: Partial<Study>) => void; rounding?: boolean }) {
  return <div className="ss-controls">
    <p className="ss-eyebrow">{rounding ? "CONTINUOUS ROUNDED EDGES" : "ENCLOSURE STUDY"}</p>
    {!rounding && ([['length', 'Length', 40, 240], ['width', 'Width', 25, 140], ['height', 'Height', 10, 80]] as const).map(([id, label, min, max]) => <label className="ss-field" key={id}><span>{label}</span><NumberField aria-label={label} value={study[id]} min={min} max={max} unit="mm" onCommit={value => onChange({ [id]: value })}/></label>)}
    <label className="ss-field"><span>Radius</span><NumberField aria-label="Edge radius" value={study.radius} min={.25} max={maxRadius(study)} step={.25} unit="mm" onCommit={radius => onChange({ radius })}/></label>
    <Slider ariaLabel="Edge radius preview" value={study.radius} min={.25} max={maxRadius(study)} step={.25} unit=" mm" onChange={radius => onChange({ radius })}/>
    <div className="ss-divider"/>
    <Checkbox label="Separate lid" checked={study.exploded} onChange={event => onChange({ exploded: event.target.checked })}/>
    <p className="ss-hint">Changes update the live model. Select either part in the viewport to inspect it.</p>
  </div>;
}
const finishes = [
  { name: "Titanium", color: "#8c9aa9", metalness: .9, roughness: .3 },
  { name: "Graphite", color: "#363d47", metalness: .75, roughness: .35 },
  { name: "Champagne", color: "#b19b74", metalness: .85, roughness: .28 },
  { name: "Ceramic", color: "#b8c5ce", metalness: .05, roughness: .24 },
];
export function StudySurface({ study, onChange }: { study: Study; onChange: (patch: Partial<Study>) => void }) {
  return <div className="ss-controls"><p className="ss-eyebrow">PHYSICAL MATERIAL</p><div className="ss-finishes">{finishes.map(finish => <button type="button" key={finish.name} aria-label={`Apply ${finish.name}`} aria-pressed={study.color === finish.color} onClick={() => onChange({ color: finish.color, metalness: finish.metalness, roughness: finish.roughness })}><MaterialSwatch color={finish.color} roughness={finish.roughness} size="large"/><span>{finish.name}</span></button>)}</div>
    <ColorField ariaLabel="Finish color" value={study.color} onChange={color => onChange({ color })}/>
    <label>Roughness<Slider ariaLabel="Roughness" value={study.roughness} min={.08} max={1} step={.01} onChange={roughness => onChange({ roughness })}/></label>
    <label>Metalness<Slider ariaLabel="Metalness" value={study.metalness} min={0} max={1} step={.01} onChange={metalness => onChange({ metalness })}/></label>
  </div>;
}
export function StudioLighting({ lighting, onChange }: { lighting: Lighting; onChange: (value: Lighting) => void }) {
  const preset = LIGHT_PRESETS.find(item => Object.keys(lighting).every(key => lighting[key as keyof Lighting] === item.lighting[key as keyof Lighting]))?.id ?? "";
  return <div className="ss-controls"><SegmentedControl ariaLabel="Lighting preset" value={preset} options={LIGHT_PRESETS.map(({ id, label }) => ({ id, label }))} onChange={id => onChange({ ...LIGHT_PRESETS.find(item => item.id === id)!.lighting })}/>
    {([['power', 'Light power', 0, 300, 5, ''], ['spread', 'Beam spread', 15, 80, 1, '°'], ['softness', 'Softness', 0, 1, .05, ''], ['azimuth', 'Light direction', 0, 360, 5, '°'], ['elevation', 'Light elevation', 15, 85, 5, '°'], ['fill', 'Environment fill', 0, 1.2, .05, ''], ['exposure', 'Exposure', .5, 2, .05, '']] as const).map(([id, label, min, max, step, unit]) => <label key={id}>{label}<Slider ariaLabel={label} value={lighting[id]} min={min} max={max} step={step} unit={unit} onChange={value => onChange({ ...lighting, [id]: value })}/></label>)}
  </div>;
}
