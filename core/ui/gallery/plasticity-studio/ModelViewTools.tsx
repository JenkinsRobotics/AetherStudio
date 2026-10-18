import { AetherIcon, Button, Checkbox, IconButton, NumberField, SelectField } from "../../src";
import type { Vector } from "./state";

export interface SectionSettings { enabled: boolean; axis: "X" | "Y" | "Z"; offset: number; flipped: boolean; }
export function ModelViewTools({ section, onSection }: {
  section: SectionSettings; onSection: (value: SectionSettings) => void;
}) {
  return <div className="ps-view-options">
    {section.enabled && <section aria-label="Section view controls">
      <header><h3>Section view</h3><IconButton label="Close section view" size="small" onClick={() => onSection({ ...section, enabled: false })}><AetherIcon name="close"/></IconButton></header>
      <label>Plane<SelectField aria-label="Section axis" value={section.axis} onChange={event => onSection({ ...section, axis: event.target.value as SectionSettings["axis"] })} options={[{ value: "X", label: "YZ · X axis" }, { value: "Y", label: "XZ · Y axis" }, { value: "Z", label: "XY · Z axis" }]}/></label>
      <label>Offset<NumberField aria-label="Section offset" value={section.offset} min={-1000} max={1000} step={10} unit="cm" onCommit={offset => onSection({ ...section, offset })}/></label>
      <Checkbox label="Flip section" checked={section.flipped} onChange={event => onSection({ ...section, flipped: event.target.checked })}/>
      <small>Viewport cutaway · open mesh surfaces</small>
    </section>}
  </div>;
}

export function ModelMeasurement({ points, onClear }: { points: Vector[]; onClear: () => void }) {
  const distance = points.length === 2 ? Math.hypot(...points[1].map((value, index) => value - points[0][index])) : null;
  return <section className="ps-measure-content" aria-label="Measure controls">
      <output aria-live="polite" aria-label="Measured distance">{distance == null ? points.length ? "Pick the second surface point" : "Pick two surface points" : `${distance.toFixed(2)} cm`}</output>
      <small>{distance == null ? "Click the model; drag to orbit." : "Straight-line mesh distance. Click to start again."}</small>
      <Button disabled={!points.length} onClick={onClear}>Clear measurement</Button>
  </section>;
}
