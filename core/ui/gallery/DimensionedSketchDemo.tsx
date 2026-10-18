import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../src/Button";
import { Checkbox } from "../src/Checkbox";
import { Dialog } from "../src/Dialog";
import { TextField } from "../src/TextField";
import { parseNumberExpression } from "../src/number-expression";
import { DimensionedSketch, type SketchAnnotationSelection, type SketchAnnotationView } from "../src/DimensionedSketch";
import { DIMENSION_PARAMETER, SAMPLE_VIEW, SKETCH_PARAMETERS, dimensionedSketchSample, initialSketchSample, sketchSampleProblem, type SketchSampleState } from "./dimensioned-sketch-example";
import "./DimensionedSketchDemo.css";

export function DimensionedSketchDemo() {
  const [history, setHistory] = useState<{ past: SketchSampleState[]; current: SketchSampleState; future: SketchSampleState[] }>(() => ({ past: [], current: initialSketchSample(), future: [] }));
  const state = history.current, scene = dimensionedSketchSample(state);
  const [selection, setSelection] = useState<SketchAnnotationSelection>({ kind: "dimension", id: "cap" });
  const [view, setView] = useState<SketchAnnotationView>({ zoom: 1, pan: [0, 0] });
  const [visibility, setVisibility] = useState({ grid: true, construction: true, constraints: true, references: true });
  const [draft, setDraft] = useState(""), [note, setNote] = useState(""), [error, setError] = useState("");
  const [notice, setNotice] = useState("Select a dimension to inspect its reference."), [confirmReset, setConfirmReset] = useState(false);
  const [editRequest, setEditRequest] = useState(0);
  const inspector = useRef<HTMLFormElement>(null), errorID = useId();
  const dimension = selection?.kind === "dimension" ? scene.dimensions.find(d => d.id === selection.id) : undefined;
  const parameter = dimension ? SKETCH_PARAMETERS.find(p => p.id === DIMENSION_PARAMETER[dimension.id]) : undefined;
  const constraint = selection?.kind === "constraint" ? scene.constraints.find(c => c.id === selection.id) : undefined;
  const entity = selection?.kind === "entity" ? scene.entities.find(e => e.id === selection.id) : undefined;
  const related = scene.dimensions.filter(d => entity && d.entityIDs.includes(entity.id));

  useEffect(() => {
    setDraft(parameter ? state.values[parameter.id].toFixed(2) : dimension?.value ?? "");
    setNote(dimension ? state.notes[dimension.id] ?? "" : ""); setError("");
  }, [dimension?.id, parameter?.id, state]);
  useEffect(() => {
    if (editRequest) { const input = inspector.current?.querySelector<HTMLInputElement>("input:not([readonly])"); input?.focus(); input?.select(); }
  }, [editRequest]);

  const commit = (next: SketchSampleState, message: string) => {
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    setHistory(h => ({ past: [...h.past.slice(-49), h.current], current: next, future: [] })); setNotice(message);
  };
  const undo = () => {
    setHistory(h => h.past.length ? { past: h.past.slice(0, -1), current: h.past[h.past.length - 1], future: [h.current, ...h.future] } : h);
    setNotice("Undid the last sketch edit.");
  };
  const redo = () => {
    setHistory(h => h.future.length ? { past: [...h.past, h.current], current: h.future[0], future: h.future.slice(1) } : h);
    setNotice("Redid the sketch edit.");
  };
  const apply = () => {
    if (!dimension) return;
    let values = state.values;
    if (parameter) {
      const parsed = parseNumberExpression(draft);
      if (parsed === null) { setError("Enter a finite number or arithmetic such as 20 + 5.14."); return; }
      values = { ...values, [parameter.id]: parsed };
      const problem = sketchSampleProblem(values);
      if (problem) { setError(problem); return; }
    }
    setError("");
    commit({ ...state, values, notes: { ...state.notes, [dimension.id]: note } }, `${dimension.reference} updated. Linked annotations and measurements are current.`);
  };
  const selectDimension = (id: string) => { setSelection({ kind: "dimension", id }); setError(""); };

  return <div className="dimension-sketch-demo" onKeyDown={event => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z" || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    event.preventDefault(); if (event.shiftKey) { if (history.future.length) redo(); } else if (history.past.length) undo();
  }}>
    <header className="dimension-sketch-heading"><div><strong>A sketch that explains itself.</strong><p>Dimensions, construction geometry and named references, together on the canvas.</p></div><span className="dimension-sketch-unit">XY plane · mm</span></header>
    <div className="dimension-sketch-workspace">
      <div className="dimension-sketch-canvas-column">
        <div className="dimension-sketch-toolbar" role="toolbar" aria-label="Sketch display controls">
          <div className="dimension-sketch-toggles">
            {([['grid', 'Grid'], ['construction', 'Construction'], ['constraints', 'Constraints'], ['references', 'References']] as const).map(([key, label]) => <Checkbox key={key} label={label} checked={visibility[key]} onChange={event => setVisibility(v => ({ ...v, [key]: event.target.checked }))} />)}
          </div>
          <div className="dimension-sketch-view-tools"><Button aria-label="Zoom out sketch" disabled={view.zoom <= .5} onClick={() => setView(v => ({ ...v, zoom: Math.max(.5, v.zoom - .25) }))}>−</Button><output aria-label="Sketch zoom">{Math.round(view.zoom * 100)}%</output><Button aria-label="Zoom in sketch" disabled={view.zoom >= 3} onClick={() => setView(v => ({ ...v, zoom: Math.min(3, v.zoom + .25) }))}>+</Button><Button onClick={() => setView({ zoom: 1, pan: [0, 0] })}>Fit</Button></div>
        </div>
        <div className="dimension-sketch-paper">
          <DimensionedSketch {...SAMPLE_VIEW} {...scene} selection={selection} onSelect={setSelection} view={view} onViewChange={setView}
            showGrid={visibility.grid} showConstruction={visibility.construction} showConstraints={visibility.constraints} showReferences={visibility.references}
            onEditDimension={id => { selectDimension(id); setEditRequest(n => n + 1); }}
            onMoveLabel={(id, position) => commit({ ...state, labels: { ...state.labels, [id]: position } }, "Dimension label moved; its leader remains attached.")} />
          <div className="dimension-sketch-scale" aria-hidden="true">TOP / XY <span>6 inputs · 2 measurements</span></div>
        </div>
        <div className="dimension-sketch-canvas-footer"><div className="dimension-sketch-legend"><span>Profile</span><span>Construction</span><span>Constraint</span><span>Reference</span></div><span>Double-click a dimension to edit · drag labels or paper</span></div>
      </div>
      <aside className="dimension-sketch-inspection" aria-label="Sketch references and inspection">
        <section className="dimension-sketch-expressions"><div className="dimension-sketch-panel-title"><h3>Expressions</h3><span>mm</span></div>
          <div className="dimension-sketch-expression-list">
            {SKETCH_PARAMETERS.map(p => {
              const id = Object.keys(DIMENSION_PARAMETER).find(key => DIMENSION_PARAMETER[key] === p.id)!;
              return <button key={p.id} type="button" className="dimension-sketch-expression-row" aria-label={`Inspect ${p.label}`} aria-pressed={parameter?.id === p.id} onClick={() => selectDimension(id)}>
                <span><code>@expr.{p.id}</code><small>{p.label}</small></span><span>{state.values[p.id].toFixed(2)}</span>
              </button>;
            })}
            {([['yH', 'horizontal', 'Tangent horizontal distance'], ['Vb', 'vertical', 'Tangent vertical distance']] as const).map(([key, id, label]) => <button key={key} type="button" className="dimension-sketch-expression-row is-measured" aria-label={`Inspect ${label}`} aria-pressed={dimension?.id === id} onClick={() => selectDimension(id)}><span><code>@expr.{key}</code><small>Measured</small></span><span>{scene.measured[key].toFixed(2)}</span></button>)}
          </div>
        </section>
        <section className="dimension-sketch-detail"><div className="dimension-sketch-panel-title"><h3>{dimension ? "Dimension" : constraint ? "Constraint" : entity ? "Geometry" : "Selection"}</h3><span>{dimension?.readOnly ? "Measured" : dimension ? "Driving" : ""}</span></div>
          {dimension ? <form ref={inspector} onSubmit={event => { event.preventDefault(); apply(); }}>
            <strong>{dimension.label}</strong><code className="dimension-sketch-ref">{dimension.reference}</code>
            <label>Value<TextField aria-label="Dimension value" value={draft} readOnly={!parameter} maxLength={80} unit="mm" invalid={Boolean(error)} aria-describedby={error ? errorID : undefined} onChange={event => { setDraft(event.target.value); setError(""); }} /></label>
            {parameter ? <p className="dimension-sketch-hint">{parameter.min}–{parameter.max} mm · arithmetic accepted. {parameter.id === "Ework" && "Both working arcs share this value."}</p> : <p className="dimension-sketch-hint">Measured from the tangent point. Change the working radius, seat radius or center offset to update it.</p>}
            <label>Note<TextField aria-label="Dimension note" value={note} maxLength={200} placeholder="Add design intent…" onChange={event => setNote(event.target.value)} /></label>
            {error && <p role="alert" id={errorID}>{error}</p>}
            <div className="dimension-sketch-form-actions"><Button primary type="submit">Apply</Button><Button disabled={!state.labels[dimension.id]} onClick={() => { const labels = { ...state.labels }; delete labels[dimension.id]; commit({ ...state, labels }, "Restored the label position."); }}>Restore label</Button></div>
          </form> : constraint ? <><strong>{constraint.label}</strong><p className="dimension-sketch-hint">{constraint.id === "vertical" ? "The construction centerline follows the Y axis." : "The working circle and seat circle meet at the highlighted tangent point. Their positions follow the sample’s named radii and center offset."}</p><p className="dimension-sketch-hint">Edit the linked dimensions to change this construction.</p></> : entity ? <><strong>{entity.label}</strong><p className="dimension-sketch-hint">{entity.construction ? "Construction geometry" : "Profile geometry"}</p>{related.map(d => <Button key={d.id} onClick={() => selectDimension(d.id)}>{d.reference} · {d.value}</Button>)}{!related.length && <p className="dimension-sketch-hint">This line follows the adjacent arc endpoints.</p>}</> : <p className="dimension-sketch-hint">Select a profile edge, dimension or green constraint marker. Enter opens dimension editing; arrow keys move a focused label.</p>}
        </section>
      </aside>
    </div>
    <footer className="dimension-sketch-footer"><div className="dimension-sketch-history"><Button disabled={!history.past.length} onClick={undo}>Undo</Button><Button disabled={!history.future.length} onClick={redo}>Redo</Button><Button onClick={() => setConfirmReset(true)}>Reset sketch</Button></div><p role="status">{notice}</p></footer>
    <p className="dimension-sketch-footnote">Local reference sketch · values, notes and label positions last while this section is open. This sample illustrates annotation behavior; CAD supplies the geometry and constraint solver in a product.</p>
    <Dialog open={confirmReset} title="Reset sketch?" onClose={() => setConfirmReset(false)} actions={<><Button onClick={() => setConfirmReset(false)}>Cancel</Button><Button primary onClick={() => { commit(initialSketchSample(), "Restored the reference sketch. Undo is available."); setView({ zoom: 1, pan: [0, 0] }); setConfirmReset(false); }}>Reset</Button></>}><p>Restore the sample values, notes and label positions. This change can be undone.</p></Dialog>
  </div>;
}
