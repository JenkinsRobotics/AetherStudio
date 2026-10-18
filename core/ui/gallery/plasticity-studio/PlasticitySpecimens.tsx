import type { StudioSpecimenKind } from "../showcase/studio-specimen-sections";
import { modelStudioSample, modelStudioFeatureSample } from "../../src/model-studio-assets";
import { useReducer, useState } from "react";
import { Button } from "../../src";
import { ModelBrowser, ModelMaterials, ModelProperties } from "./PlasticityWidgets";
import { freshHistory, sceneReducer, type ModelPart, type Vector } from "./state";
import { ModelCommentsPanel, ModelRevisionsPanel, ModelVersionControlPanel } from "./ModelReviewPanels";
import { ModelViewTools, type SectionSettings } from "./ModelViewTools";
import { ModelMeasurePopup } from "./ModelMeasurePopup";
import "./plasticity-studio.css";
export function PlasticitySpecimens({ kind }: { kind: StudioSpecimenKind }) {
  const [history, dispatch] = useReducer(sceneReducer, undefined, freshHistory), parts = history.present;
  const [showRevisions, setShowRevisions] = useState(true);
  const [measuring, setMeasuring] = useState(true), [points, setPoints] = useState<Vector[]>([[0, 0, 0], [3, 4, 0]]);
  const [selected, setSelected] = useState("shell");
  const [section, setSection] = useState<SectionSettings>({ enabled: true, axis: "X", offset: 0, flipped: false });
  const [settings, setSettings] = useState({ grid: true, wireframe: false, edges: false }), [plane, setPlane] = useState({ kind: "", revision: 0 });
  const part = parts.find(item => item.id === selected);
  const change = (part: ModelPart) => dispatch({ type: "edit", parts: parts.map(item => item.id === part.id ? part : item) });
  return <div className="ps-widget-specimens">
    {kind === "trees" && <article><small className="showcase-studio-source">Model Studio</small><h3>Model browser</h3><ModelBrowser parts={parts} selected={selected} onSelect={setSelected} onVisibility={id => { const item = parts.find(part => part.id === id); if (item) change({ ...item, visible: !item.visible }); }}/></article>}
    {kind === "inspectors" && <article><small className="showcase-studio-source">Model Studio</small><h3>Transform inspector</h3><ModelProperties part={part} onChange={change} settings={settings} onSettings={setSettings} plane={plane} onPlane={kind => setPlane(value => ({ kind, revision: value.revision + 1 }))}/></article>}
    {kind === "appearance" && <article><small className="showcase-studio-source">Model Studio</small><h3>Shared study artwork</h3><p>Scifirobot · seven mesh groups · GLB</p><a href={modelStudioSample.url} download={modelStudioSample.filename}>Download Scifirobot</a><p>Original mesh study retained.</p><p><a href={modelStudioFeatureSample.url} download={modelStudioFeatureSample.filename}>Download native CAD feature model</a> · 120 features / 39 solid bodies</p></article>}
    {kind === "appearance" && <article><small className="showcase-studio-source">Model Studio</small><h3>Surface finishes</h3><ModelMaterials part={part} onChange={change}/></article>}
    {kind === "collaboration" && <article className="ps-review-specimen"><small className="showcase-studio-source">Model Studio</small><h3>Local comments</h3><ModelCommentsPanel selected={part}/></article>}
    {kind === "revisions" && <article className="ps-review-specimen"><small className="showcase-studio-source">Model Studio</small><h3>Versions and history</h3>{showRevisions ? <ModelRevisionsPanel onClose={() => setShowRevisions(false)}/> : <Button onClick={() => setShowRevisions(true)}>Show revisions</Button>}</article>}
    {kind === "revisions" && <article className="ps-review-specimen" style={{ height:720 }}><small className="showcase-studio-source">Model Studio · new variant</small><h3>Version control</h3><ModelVersionControlPanel/></article>}
    {kind === "viewports" && <article><small className="showcase-studio-source">Model Studio</small><h3>Viewport inspection</h3><ModelViewTools section={section} onSection={setSection}/><Button onClick={() => { setSection({ ...section, enabled: true }); setMeasuring(true); setPoints([[0, 0, 0], [3, 4, 0]]); }}>Reset inspection example</Button><p>Surface-point picking is available in Model Studio.</p></article>}
    {kind === "floating" && <article className="ps-measure-specimen"><small className="showcase-studio-source">Model Studio</small><h3>Measure popup</h3><div>{measuring ? <ModelMeasurePopup points={points} onClear={() => setPoints([])} onClose={() => setMeasuring(false)}/> : <Button onClick={() => setMeasuring(true)}>Open measure</Button>}</div></article>}
  </div>;
}
