import { useEffect, useRef, useState } from "react";
import { AetherIcon, Button, Dialog, SelectField, SegmentedControl } from "../src/index";
import { FlowDiagramEditor } from "../src/FlowDiagramEditor";
import { parseFlowDocument, type FlowDocument } from "../src/flow-diagram-model";
import type { FlowEditOptions } from "../src/FlowDiagramInspector";
import { createFlowExample } from "./flow-diagram-example";
import "./FlowDiagramDemo.css";

const STORAGE_KEY = "aether-ui-flow-diagram-v1";
const families = [
  { id: "all", label: "All signals", tones: [] },
  { id: "agents", label: "Agents", tones: ["green", "violet"] },
  { id: "apps", label: "Applications", tones: ["red", "neutral"] },
  { id: "data", label: "Documents", tones: ["teal"] },
  { id: "local", label: "Local I/O", tones: ["blue", "amber"] },
];
function loadDraft() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return { document: stored ? parseFlowDocument(stored) : createFlowExample(), notice: stored ? "Saved browser draft restored." : "Edits save in this browser." };
  } catch { return { document: createFlowExample(), notice: "The saved draft could not be loaded. Export your edits to keep a separate copy." }; }
}

export function FlowDiagramDemo() {
  const [initial] = useState(loadDraft);
  const [history, setHistory] = useState<{ present: FlowDocument; past: FlowDocument[]; future: FlowDocument[]; edited: boolean }>({ present: initial.document, past: [], future: [], edited: false });
  const [saveNotice, setSaveNotice] = useState(initial.notice);
  const [fileNotice, setFileNotice] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState("");
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState("1");
  const [family, setFamily] = useState("all");
  const importInput = useRef<HTMLInputElement>(null);
  const exportText = useRef<HTMLTextAreaElement>(null);
  const merge = useRef<{ key?: string; time: number }>({ time: 0 });
  const selected = families.find(item => item.id === family)!;
  const document = history.present;
  useEffect(() => {
    if (!history.edited) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(document)); setSaveNotice("Saved in this browser."); }
    catch { setSaveNotice("Browser storage unavailable. Export JSON to keep your edits."); }
  }, [document, history.edited]);
  const commit = (next: FlowDocument, options?: FlowEditOptions) => {
    const now = Date.now();
    const combine = Boolean(options?.mergeKey && merge.current.key === options.mergeKey && now - merge.current.time < 1000);
    merge.current = { key: options?.mergeKey, time: now };
    setHistory(current => JSON.stringify(current.present) === JSON.stringify(next) ? current : ({ present: next, past: combine ? current.past : [...current.past.slice(-79), current.present], future: [], edited: true }));
  };
  const undo = () => {
    merge.current = { time: 0 };
    setHistory(current => current.past.length ? { present: current.past.at(-1)!, past: current.past.slice(0, -1), future: [current.present, ...current.future], edited: true } : current);
  };
  const redo = () => {
    merge.current = { time: 0 };
    setHistory(current => current.future.length ? { present: current.future[0], past: [...current.past, current.present], future: current.future.slice(1), edited: true } : current);
  };
  const exportFile = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }));
    const anchor = window.document.createElement("a");
    anchor.href = url; anchor.download = "aether-flow-diagram.json";
    window.document.body.append(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportNotice("Download requested. You can also copy the JSON below.");
  };
  return <div className="flow-demo">
    <div className="flow-demo-toolbar">
      <div className="flow-demo-title"><strong>Connected by design.</strong><span>Editable nodes, points and signals</span></div>
      <div className="flow-demo-controls">
        <label className="flow-demo-speed">Speed<SelectField aria-label="Signal speed" value={speed} onChange={event => setSpeed(event.target.value)} options={[
          { value: "0.5", label: "0.5×" }, { value: "1", label: "1×" }, { value: "2", label: "2×" },
        ]} /></label>
        <Button onClick={() => setPaused(v => !v)} aria-pressed={paused} aria-label={paused ? "Resume signals" : "Pause signals"}><AetherIcon name={paused ? "play" : "pause"} />{paused ? "Resume" : "Pause"}</Button>
      </div>
    </div>
    <FlowDiagramEditor value={document} onChange={commit} onUndo={undo} onRedo={redo} canUndo={Boolean(history.past.length)} canRedo={Boolean(history.future.length)} paused={paused} playbackRate={Number(speed)}
      highlightedRouteIds={family === "all" ? undefined : document.connections.filter(edge => selected.tones.includes(edge.tone)).map(edge => edge.id)}
      actions={<><Button onClick={() => { setExportOpen(true); setExportNotice(""); }}>Export JSON</Button><Button onClick={() => importInput.current?.click()}>Import JSON</Button><Button onClick={() => { commit(createFlowExample()); setFamily("all"); setFileNotice("Example restored. Undo returns to your previous diagram."); }}>Restore example</Button></>} />
    <input ref={importInput} type="file" accept=".json,application/json" aria-label="Import flow diagram JSON" hidden onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = "";
      if (!file) return;
      try {
        if (file.size > 1_000_000) throw new Error("Diagram files must be smaller than 1 MB.");
        commit(parseFlowDocument(await file.text())); setFamily("all"); setFileNotice("Diagram imported. Undo restores the previous document.");
      } catch (error) { setFileNotice(error instanceof Error ? error.message : "Could not import this diagram."); }
    }} />
    <div className="flow-demo-footer"><SegmentedControl ariaLabel="Focus signal family" options={families} value={family} onChange={setFamily} /><span className="flow-demo-caption">{saveNotice}</span></div>
    <p className="flow-demo-description" role="status">{fileNotice || "Diagram editing preview · signal animation illustrates direction."}<span className="flow-demo-reduced-motion"> Motion is reduced by your system preference.</span></p>
    <Dialog open={exportOpen} title="Export flow diagram" onClose={() => setExportOpen(false)} actions={<>
      <Button onClick={async () => {
        try { await navigator.clipboard.writeText(JSON.stringify(document, null, 2)); setExportNotice("Diagram JSON copied."); }
        catch { exportText.current?.focus(); exportText.current?.select(); setExportNotice("JSON selected. Use your system copy shortcut to copy it."); }
      }}>Copy JSON</Button>
      <Button onClick={exportFile}>Download JSON</Button>
      <Button onClick={() => setExportOpen(false)}>Done</Button>
    </>}>
      <div className="flow-demo-export"><p>Keep a copy of every node, note, connection point and route. Import this JSON to continue editing.</p>
        <textarea ref={exportText} aria-label="Diagram JSON" readOnly spellCheck={false} value={JSON.stringify(document, null, 2)} />
        <p role="status">{exportNotice || "Ready to copy or download as aether-flow-diagram.json."}</p>
      </div>
    </Dialog>
  </div>;
}
