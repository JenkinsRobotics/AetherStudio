import type { StudioSpecimenKind } from "../showcase/studio-specimen-sections";
import { useEffect, useState } from "react";
import { MaterialSwatch } from "../../src";
import { StudioLightingControls, StudioMaterialControls, StudioMaterialShelf, StudioPreviewTimeline, StudioSceneTree, StudioTransformControls } from "./StudioWidgets";
import { DURATION, MATERIALS, identityTransform, initialObjects, nextPreviewTime } from "./state";
import "./material-studio.css";

export function StudioWidgetSpecimens({ kind }: { kind: StudioSpecimenKind }) {
  const [materials, setMaterials] = useState(MATERIALS.map(material => ({ ...material }))), [id, setID] = useState("clay");
  const [transform, setTransform] = useState(identityTransform), [objects, setObjects] = useState(initialObjects), [selected, setSelected] = useState("head");
  const [lights, setLights] = useState({ key: true, rim: true }), [exposure, setExposure] = useState(.95);
  const [time, setTime] = useState(0), [loop, setLoop] = useState(true), [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    let frame = 0, last = performance.now();
    const tick = (now: number) => { const delta = (now - last) / 1000; last = now; setTime(value => nextPreviewTime(value, delta, loop)); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [playing, loop]);
  useEffect(() => { if (!loop && time >= DURATION) setPlaying(false); }, [time, loop]);
  const material = materials.find(item => item.id === id)!;
  const toggle = (id: "key" | "rim") => setLights(value => ({ ...value, [id]: !value[id] }));
  return <div className="ms-specimens">
    <div className="ms-specimen-grid">
      {kind === "appearance" && <article><small className="showcase-studio-source">Material Studio</small><h3>Surface material</h3><StudioMaterialControls material={material} assignment="Head study" onChange={patch => setMaterials(items => items.map(item => item.id === id ? { ...item, ...patch } : item))}/></article>}
      {kind === "inspectors" && <article><small className="showcase-studio-source">Material Studio</small><h3>Object transforms</h3><StudioTransformControls value={transform} onChange={setTransform} onReset={() => setTransform(identityTransform())}/></article>}{kind === "appearance" && <article><small className="showcase-studio-source">Material Studio</small><h3>Studio lighting</h3><StudioLightingControls lights={lights} intensity={exposure} onToggle={toggle} onIntensity={setExposure}/></article>}
      {kind === "trees" && <article><small className="showcase-studio-source">Material Studio</small><h3>Scene hierarchy</h3><StudioSceneTree objects={objects} selected={selected} onSelect={setSelected} onVisibility={id => setObjects(items => items.map(item => item.id === id ? { ...item, visible: !item.visible } : item))} lights={lights} onLightToggle={toggle}/></article>}
    </div>
    {kind === "appearance" && <article><small className="showcase-studio-source">Material Studio</small><h3>Material shelf</h3><StudioMaterialShelf materials={materials} selected={id} onSelect={setID}/></article>}
    {kind === "timelines" && <article><small className="showcase-studio-source">Material Studio</small><h3>Preview timeline + transport</h3><StudioPreviewTimeline time={time} playing={playing} loop={loop} onSeek={setTime} onPlay={() => { if (time >= DURATION) setTime(0); setPlaying(value => !value); }} onLoop={() => setLoop(value => !value)}/></article>}
  </div>;
}

export function MaterialSwatchSpecimen() {
  return <div className="ms-swatch-specimen">{MATERIALS.map(material => <figure key={material.id}><MaterialSwatch color={material.color} roughness={material.roughness} size="large" label={`${material.name} surface sample`}/><figcaption>{material.name}</figcaption><MaterialSwatch color={material.color} roughness={material.roughness} label={`${material.name} small sample`}/></figure>)}</div>;
}
