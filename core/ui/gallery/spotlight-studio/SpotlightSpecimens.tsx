import type { StudioSpecimenKind } from "../showcase/studio-specimen-sections";
import { useState } from "react";
import { StudyBrowser, StudyGeometry, StudySurface, StudioLighting } from "./SpotlightWidgets";
import { initialLighting, studies, updateStudy, type Study } from "./state";
import "./spotlight-studio.css";
export function SpotlightSpecimens({ kind }: { kind: StudioSpecimenKind }) {
  const [study, setStudy] = useState(() => studies()[0]), [selected, setSelected] = useState("rounding"), [lighting, setLighting] = useState(initialLighting);
  const change = (patch: Partial<Study>) => setStudy(value => updateStudy(value, patch));
  return <div className="ss-widget-specimens">{kind === "trees" && <article><small className="showcase-studio-source">Spotlight Studio</small><h3>Feature browser</h3><StudyBrowser study={study} selected={selected} onSelect={setSelected} onVisibility={id => change({ [id]: !study[id] })}/></article>}{kind === "inspectors" && <article><small className="showcase-studio-source">Spotlight Studio</small><h3>Shape and edge radius</h3><StudyGeometry study={study} onChange={change}/></article>}{kind === "appearance" && <article><small className="showcase-studio-source">Spotlight Studio</small><h3>Physical surface</h3><StudySurface study={study} onChange={change}/></article>}{kind === "appearance" && <article><small className="showcase-studio-source">Spotlight Studio</small><h3>Studio lighting</h3><StudioLighting lighting={lighting} onChange={setLighting}/></article>}</div>;
}
