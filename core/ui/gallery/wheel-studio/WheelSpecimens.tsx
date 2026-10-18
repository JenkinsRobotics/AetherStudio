import type { StudioSpecimenKind } from "../showcase/studio-specimen-sections";
import { useState } from "react";
import { WheelAppearance, WheelBrowser, WheelDimensions, WheelProperties } from "./WheelWidgets";
import { initialDisplay, initialWheel, updateWheel, type WheelStudy } from "./state";
import "./wheel-studio.css";
export function WheelSpecimens({ kind }: { kind: StudioSpecimenKind }) {
  const [wheel, setWheel] = useState(initialWheel), [display, setDisplay] = useState(initialDisplay), [selected, setSelected] = useState("wheel");
  const change = (patch: Partial<WheelStudy>) => setWheel(value => updateWheel(value, patch));
  return <div className="ws-widget-specimens">{kind === "trees" && <article><small className="showcase-studio-source">Wheel Studio</small><h3>Wheel features</h3><WheelBrowser wheel={wheel} assembly={false} selected={selected} onSelect={setSelected} onVisibility={() => change({ visible: !wheel.visible })}/></article>}{kind === "inspectors" && <article><small className="showcase-studio-source">Wheel Studio</small><h3>Revolved profile</h3><WheelDimensions wheel={wheel} onChange={change}/></article>}{kind === "inspectors" && <article><small className="showcase-studio-source">Wheel Studio</small><h3>Part properties</h3><WheelProperties wheel={wheel} onChange={change} display={display} onDisplay={setDisplay} assembly={false}/></article>}{kind === "appearance" && <article><small className="showcase-studio-source">Wheel Studio</small><h3>Wheel finishes</h3><WheelAppearance wheel={wheel} onChange={change}/></article>}</div>;
}
