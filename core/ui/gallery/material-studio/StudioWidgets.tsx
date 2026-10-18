import { useState } from "react";
import { AetherIcon, MaterialSwatch, Button, Checkbox, ColorField, NumberField, Slider, TextField, Timeline, Tree, type TreeNode } from "../../src";
import { DURATION, type StudioMaterial, type StudioObject, type StudioTransform, type Vector3 } from "./state";

export function StudioMaterialControls({ material, onChange, onAssign, assignment }: {
  material: StudioMaterial; onChange: (patch: Partial<StudioMaterial>) => void; onAssign?: () => void; assignment: string;
}) {
  return <section className="ms-material-controls" aria-label="Surface material controls">
    <div className="ms-material-summary"><MaterialSwatch color={material.color} roughness={material.roughness} size="large"/><div><TextField aria-label="Material name" value={material.name} onChange={event => onChange({ name: event.target.value })}/><small>PHYSICAL MATERIAL</small></div></div>
    <label className="ms-field-label">Base color<ColorField value={material.color} onChange={color => onChange({ color })} ariaLabel="Base color"/></label>
    <div className="ms-material-channels">{([
      ["metalness", "Metalness"], ["roughness", "Roughness"], ["opacity", "Opacity"],
    ] as const).map(([id, label]) => <label key={id}><span>{label}</span><Slider ariaLabel={label} min={0} max={1} step={.01} value={material[id]} onChange={value => onChange({ [id]: value })}/></label>)}</div>
    <div className="ms-material-target"><span>Assigned to</span><strong>{assignment}</strong></div>
    {onAssign && <Button appearance="flat" onClick={onAssign}>Assign to selection</Button>}
  </section>;
}

export function StudioTransformControls({ value, onChange, onReset }: { value: StudioTransform; onChange: (value: StudioTransform) => void; onReset: () => void }) {
  return <section className="ms-transform" aria-label="Object transform">
    <div className="ms-transform-columns">{(["position", "rotation", "scale"] as const).map(group => <div key={group}>
      <h4>{group === "position" ? "Position" : group === "rotation" ? "Rotation" : "Scale"}</h4>
      {(["X", "Y", "Z"] as const).map((axis, index) => <label key={axis}><span data-axis={axis}>{axis}</span><NumberField aria-label={`${group} ${axis}`} value={value[group][index]} unit={group === "rotation" ? "°" : group === "position" ? "cm" : undefined} step={group === "scale" ? .1 : 1} precision={group === "scale" ? 2 : 1} min={group === "scale" ? .05 : -360} max={group === "scale" ? 5 : 360} onValueChange={number => {
        if (number === null) return;
        const vector = [...value[group]] as Vector3; vector[index] = number; onChange({ ...value, [group]: vector });
      }}/></label>)}
    </div>)}</div>
    <div className="ms-transform-footer"><span>Object coordinates</span><Button appearance="link" onClick={onReset}>Reset</Button></div>
  </section>;
}

export function StudioSceneTree({ objects, selected, onSelect, onVisibility, lights, onLightToggle }: {
  objects: readonly StudioObject[]; selected: string; onSelect: (id: string) => void; onVisibility: (id: string) => void;
  lights: { key: boolean; rim: boolean }; onLightToggle: (id: "key" | "rim") => void;
}) {
  const [query, setQuery] = useState("");
  const lightNodes: TreeNode[] = (["key", "rim"] as const).map(id => ({ id, label: id === "key" ? "Key light" : "Rim light", icon: <AetherIcon name="appearance-light"/>, dimmed: !lights[id], actions: [{ id: "visibility", label: `${lights[id] ? "Hide" : "Show"} ${id} light`, icon: <AetherIcon name={lights[id] ? "show" : "hidden"}/>, pinned: true }] }));
  return <section className="ms-scene-tree" aria-label="Scene objects"><TextField aria-label="Find an object" placeholder="Find an object…" value={query} onChange={event => setQuery(event.target.value)}/>
    <Tree ariaLabel="Scene hierarchy" filter={query} rowHeight={28} selectedIDs={new Set([selected])} onSelect={ids => { if (ids[0] !== "objects" && ids[0] !== "lights") onSelect(ids[0]); }} nodes={[
      { id: "objects", label: "Sculpture study", icon: <AetherIcon name="folder"/>, children: objects.map(object => ({ id: object.id, label: object.name, icon: <AetherIcon name={object.kind === "head" ? "person" : object.kind === "sphere" ? "circle" : "cube"}/>, dimmed: !object.visible, actions: [{ id: "visibility", label: `${object.visible ? "Hide" : "Show"} ${object.name}`, icon: <AetherIcon name={object.visible ? "show" : "hidden"}/>, pinned: true }] })) },
      { id: "lights", label: "Studio lights", icon: <AetherIcon name="appearance-light"/>, children: lightNodes },
    ]} onAction={id => id === "key" || id === "rim" ? onLightToggle(id) : onVisibility(id)}/>
  </section>;
}

export function StudioLightingControls({ lights, intensity, onToggle, onIntensity }: { lights: { key: boolean; rim: boolean }; intensity: number; onToggle: (id: "key" | "rim") => void; onIntensity: (value: number) => void }) {
  return <section className="ms-light-controls" aria-label="Studio lighting"><Checkbox label="Key light" checked={lights.key} onChange={() => onToggle("key")}/><Checkbox label="Rim light" checked={lights.rim} onChange={() => onToggle("rim")}/><label className="ms-field-label">Exposure<Slider ariaLabel="Exposure" value={intensity} min={.2} max={2} step={.05} onChange={onIntensity}/></label></section>;
}

export function StudioMaterialShelf({ materials, selected, onSelect }: { materials: readonly StudioMaterial[]; selected: string; onSelect: (id: string) => void }) {
  return <section className="ms-material-shelf" aria-label="Material presets">{materials.map(material => <Button appearance="link" key={material.id} aria-pressed={selected === material.id} onClick={() => onSelect(material.id)}><MaterialSwatch color={material.color} roughness={material.roughness}/><span>{material.name}</span></Button>)}</section>;
}

export function StudioPreviewTimeline({ time, playing, loop, onSeek, onPlay, onLoop }: { time: number; playing: boolean; loop: boolean; onSeek: (time: number) => void; onPlay: () => void; onLoop: () => void }) {
  return <section className="ms-timeline" aria-label="Turntable preview">
    <Timeline tracks={[{ id: "turntable", label: "Turntable", color: "#78b6a3", keyframes: [{ timeS: 0 }, { timeS: 5 }, { timeS: 10 }] }]} durationS={DURATION} timeS={time} onSeek={onSeek} onSelectKeyframe={(_, index) => onSeek(index * 5)}/>
    <div className="ms-transport"><div><NumberField aria-label="Preview time" value={time} min={0} max={DURATION} step={1 / 30} precision={2} unit="s" onValueChange={value => onSeek(value ?? 0)}/><span>/ 10 s</span></div>
      <div><Button appearance="link" aria-label="First frame" onClick={() => onSeek(0)}><AetherIcon name="skip-back"/></Button><Button appearance="link" aria-label="Previous frame" onClick={() => onSeek(Math.max(0, time - 1 / 30))}><AetherIcon name="chevron-left"/></Button><Button appearance="link" aria-label={playing ? "Pause preview" : "Play preview"} onClick={onPlay}><AetherIcon name={playing ? "pause" : "play"}/></Button><Button appearance="link" aria-label="Next frame" onClick={() => onSeek(Math.min(DURATION, time + 1 / 30))}><AetherIcon name="chevron-right"/></Button><Button appearance="link" aria-label="Last frame" onClick={() => onSeek(DURATION)}><AetherIcon name="skip-forward"/></Button><Button appearance="link" aria-label="Loop preview" aria-pressed={loop} onClick={onLoop}><AetherIcon name="repeat"/></Button></div>
      <span>30 fps · Turntable preview</span>
    </div>
  </section>;
}
