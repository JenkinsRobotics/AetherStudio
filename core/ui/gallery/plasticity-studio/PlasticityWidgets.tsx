import { useState } from "react";
import { modelStudioSurfaces, SurfacePresetPicker, TransformFields, AetherIcon, Button, Checkbox, ColorField, SegmentedControl } from "../../src";
import { editAxis, type ModelPart, type Transform } from "./state";
import type { CameraView, Plane, ViewSettings } from "./PlasticityViewport";

export { ModelFeatureBrowser as ModelBrowser } from "./ModelFeatureBrowser";

export function ModelProperties({ part, onChange, settings, onSettings, plane, onPlane }: { part?: ModelPart; onChange: (part: ModelPart) => void; settings: ViewSettings; onSettings: (value: ViewSettings) => void; plane: Plane; onPlane: (kind: string) => void }) {
  const [section, setSection] = useState("properties");
  return <div className="ps-properties">
    <SegmentedControl ariaLabel="Inspector section" value={section} onChange={setSection} options={[{ id: "display", label: "Display" }, { id: "properties", label: "Properties" }]} />
    {section === "display" ? <ModelDisplay settings={settings} onChange={onSettings} /> : <>
      <div className="ps-inspector-target">{part?.name ?? "Select a part"}</div>
      {([['position', 'Location', 'cm'], ['rotation', 'Rotation', '°'], ['scale', 'Scale', undefined]] as const).map(([group, title, unit]) =>
        <TransformFields key={group} label={title} unit={unit} values={part?.transform[group] ?? (group === 'scale' ? [1,1,1] : [0,0,0])} disabled={!part}
          min={group === 'scale' ? .05 : -1000} max={group === 'scale' ? 10 : 1000} step={group === 'scale' ? .1 : 1}
          locked={[0,1,2].map(axis => part?.locks.includes(`${group}-${axis}`) ?? false)}
          onCommit={(axis, value) => part && onChange(editAxis(part, group, axis, value))}
          onToggleLock={axis => { if (!part) return; const key = `${group}-${axis}`; onChange({...part, locks: part.locks.includes(key) ? part.locks.filter(id => id !== key) : [...part.locks, key]}); }}/>) }
      <section className="ps-planes"><h3>Construction planes</h3><div className="ps-plane-options">{["XY", "YZ", "XZ"].map(id => <Button key={id} aria-pressed={plane.kind === id} active={plane.kind === id} onClick={() => onPlane(plane.kind === id ? "" : id)}><AetherIcon name="planes-axes"/>{id}</Button>)}</div>
        <Button disabled={!part} onClick={() => onPlane("selection")}>Plane from selection</Button><Button onClick={() => onPlane("camera")}>Plane from camera</Button>
        {plane.kind && <Button appearance="link" onClick={() => onPlane("")}>Hide construction plane</Button>}
      </section>
    </>}
  </div>;
}
export function ModelDisplay({ settings, onChange }: { settings: ViewSettings; onChange: (value: ViewSettings) => void }) {
  return <div className="ps-settings">{([['grid', 'Ground grid'], ['wireframe', 'Wireframe'], ['edges', 'Show edges']] as const).map(([id, label]) => <Checkbox key={id} label={label} checked={settings[id]} onChange={event => onChange({ ...settings, [id]: event.target.checked })}/>)}</div>;
}
export function ModelMaterials({ part, onChange }: { part?: ModelPart; onChange: (part: ModelPart) => void }) {
  return <div className="ps-materials"><h3>Surface finish</h3><p>{part?.name ?? "Select a part to edit its finish."}</p>
    <SurfacePresetPicker presets={modelStudioSurfaces} selectedId={modelStudioSurfaces.find(preset => preset.color === part?.color)?.id} disabled={!part}
      onSelect={id => { const preset = modelStudioSurfaces.find(item => item.id === id); if (part && preset) onChange({...part, color: preset.color}); }}/>
    <ColorField ariaLabel="Surface color" value={part?.color ?? "#c6c9c7"} disabled={!part} onChange={color => part && onChange({ ...part, color })}/>
  </div>;
}
export function ModelViews({ view, onView, settings, onSettings }: { view: CameraView; onView: (view: CameraView) => void; settings: ViewSettings; onSettings: (value: ViewSettings) => void }) {
  return <div className="ps-settings"><h3>Camera</h3>{(["perspective", "front", "right", "top"] as const).map(id => <Button key={id} active={view === id} aria-pressed={view === id} onClick={() => onView(id)}>{id[0].toUpperCase() + id.slice(1)} view</Button>)}<h3>Viewport</h3><ModelDisplay settings={settings} onChange={onSettings}/></div>;
}
export function applyTransform(part: ModelPart, transform: Transform): ModelPart {
  let next = part;
  for (const group of ["position", "rotation", "scale"] as const) for (let axis = 0; axis < 3; axis++) next = editAxis(next, group, axis, transform[group][axis]);
  return next;
}
