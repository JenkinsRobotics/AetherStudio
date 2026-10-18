import { useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { AetherIcon, SegmentedControl, type AetherIconName } from "../src/index";

export type ShowCenterView = "node-graph" | "table" | "three-d";
type NodeTool = "select" | "hand" | "connect";
type NodeFamily = "Flow" | "Program Logic" | "Conditions" | "Performance" | "Timing & Gates" | "Events & Data" | "I/O & Registers" | "Background Logic" | "Inputs" | "Voice & AI" | "Outputs";

interface NodeKind {
  id: string;
  title: string;
  family: NodeFamily;
  icon: AetherIconName;
  inputs: readonly string[];
  outputs: readonly string[];
  runtime: "SCENE V1" | "CONCEPT" | "IMPORT ONLY";
  properties?: Readonly<Record<string, string>>;
}

interface GraphNode {
  id: string;
  kindID: string;
  title: string;
  subtitle: string;
  x: number;
  y: number;
  properties: Record<string, string>;
}

interface GraphEdge { id: string; source: string; target: string; }

const familyOrder: readonly NodeFamily[] = [
  "Flow", "Program Logic", "Conditions", "Performance", "Timing & Gates", "Events & Data",
  "I/O & Registers", "Background Logic", "Inputs", "Voice & AI", "Outputs",
];

const familyColors: Record<NodeFamily, string> = {
  Flow: "#50a9ff", "Program Logic": "#f2b84b", Conditions: "#ed69a9", Performance: "#49c99a",
  "Timing & Gates": "#917eea", "Events & Data": "#ff8a43", "I/O & Registers": "#49c5a0",
  "Background Logic": "#ef6262", Inputs: "#58b7f2", "Voice & AI": "#a778ee", Outputs: "#f39049",
};

const nodeKinds: readonly NodeKind[] = [
  { id: "start", title: "Start", family: "Flow", icon: "play", inputs: [], outputs: ["FLOW"], runtime: "SCENE V1" },
  { id: "end", title: "End", family: "Flow", icon: "close", inputs: ["FLOW"], outputs: [], runtime: "SCENE V1" },
  { id: "sequence", title: "Sequence", family: "Flow", icon: "parallel", inputs: ["FLOW"], outputs: ["FLOW"], runtime: "SCENE V1" },
  { id: "parallel", title: "Parallel", family: "Flow", icon: "parallel", inputs: ["FLOW"], outputs: ["A", "B"], runtime: "SCENE V1" },
  { id: "branch", title: "IF / ELSE", family: "Program Logic", icon: "connector", inputs: ["FLOW", "CONDITION"], outputs: ["TRUE", "FALSE"], runtime: "SCENE V1", properties: { Condition: "variable == value" } },
  { id: "if-guard", title: "Single-Line IF", family: "Program Logic", icon: "connector", inputs: ["FLOW", "CONDITION"], outputs: ["TRUE", "NEXT"], runtime: "CONCEPT", properties: { Condition: "input.ready == true" } },
  { id: "select", title: "SELECT", family: "Program Logic", icon: "items", inputs: ["FLOW", "VALUE"], outputs: ["CASE 1", "CASE 2", "DEFAULT"], runtime: "CONCEPT" },
  { id: "loop", title: "Loop", family: "Program Logic", icon: "redo", inputs: ["FLOW", "COUNT"], outputs: ["BODY", "DONE"], runtime: "SCENE V1", properties: { Count: "2" } },
  { id: "call", title: "CALL Subroutine", family: "Program Logic", icon: "layers", inputs: ["FLOW"], outputs: ["FLOW"], runtime: "CONCEPT" },
  { id: "jump", title: "JMP (Import Only)", family: "Program Logic", icon: "redo", inputs: ["FLOW", "LABEL"], outputs: ["FLOW"], runtime: "IMPORT ONLY" },
  { id: "label", title: "LBL (Import Only)", family: "Program Logic", icon: "file-clip", inputs: ["FLOW"], outputs: ["FLOW"], runtime: "IMPORT ONLY" },
  { id: "and", title: "AND", family: "Conditions", icon: "connector", inputs: ["A", "B"], outputs: ["CONDITION"], runtime: "CONCEPT" },
  { id: "or", title: "OR", family: "Conditions", icon: "connector", inputs: ["A", "B"], outputs: ["CONDITION"], runtime: "CONCEPT" },
  { id: "xor", title: "XOR", family: "Conditions", icon: "parallel", inputs: ["A", "B"], outputs: ["CONDITION"], runtime: "CONCEPT" },
  { id: "not", title: "NOT", family: "Conditions", icon: "status-error", inputs: ["CONDITION"], outputs: ["CONDITION"], runtime: "CONCEPT" },
  { id: "clip", title: "Animation Clip", family: "Performance", icon: "file-clip", inputs: ["FLOW"], outputs: ["FLOW"], runtime: "SCENE V1", properties: { Clip: "Choose clip", Speed: "1.0×", Loop: "Off" } },
  { id: "pose", title: "Pose", family: "Performance", icon: "file-character", inputs: ["FLOW"], outputs: ["FLOW"], runtime: "SCENE V1", properties: { Duration: "0.5 s", Targets: "0" } },
  { id: "wait", title: "Wait", family: "Timing & Gates", icon: "history", inputs: ["FLOW"], outputs: ["FLOW"], runtime: "SCENE V1", properties: { Duration: "1.0 s" } },
  { id: "wait-event", title: "Wait for Event", family: "Timing & Gates", icon: "history", inputs: ["FLOW"], outputs: ["FLOW"], runtime: "SCENE V1", properties: { Event: "event_name", Timeout: "None" } },
  { id: "wait-until", title: "WAIT Until", family: "Timing & Gates", icon: "history", inputs: ["FLOW", "CONDITION"], outputs: ["FLOW", "TIMEOUT"], runtime: "CONCEPT" },
  { id: "emit", title: "Emit Event", family: "Events & Data", icon: "wireless", inputs: ["FLOW"], outputs: ["FLOW"], runtime: "SCENE V1", properties: { Event: "event_name" } },
  { id: "variable", title: "Set Variable", family: "Events & Data", icon: "settings", inputs: ["FLOW", "VALUE"], outputs: ["FLOW"], runtime: "SCENE V1" },
  { id: "read", title: "Read Input", family: "I/O & Registers", icon: "import", inputs: ["ADDRESS"], outputs: ["VALUE"], runtime: "CONCEPT" },
  { id: "write", title: "Write Output", family: "I/O & Registers", icon: "export", inputs: ["FLOW", "VALUE"], outputs: ["FLOW"], runtime: "CONCEPT" },
  { id: "register", title: "Numeric Register", family: "I/O & Registers", icon: "gauge", inputs: ["VALUE"], outputs: ["VALUE"], runtime: "CONCEPT" },
  { id: "flag", title: "Flag", family: "I/O & Registers", icon: "file-clip", inputs: ["BOOL"], outputs: ["BOOL"], runtime: "CONCEPT" },
  { id: "position", title: "Position Register", family: "I/O & Registers", icon: "fit", inputs: ["POSE"], outputs: ["POSE"], runtime: "CONCEPT" },
  { id: "monitor", title: "Background Monitor", family: "Background Logic", icon: "gauge", inputs: ["CONDITION"], outputs: ["TRIGGER"], runtime: "CONCEPT" },
  { id: "end-scene", title: "End Scene / Interlock", family: "Background Logic", icon: "status-error", inputs: ["FLOW", "RESULT"], outputs: [], runtime: "CONCEPT" },
  { id: "text-input", title: "Text Input", family: "Inputs", icon: "text", inputs: [], outputs: ["TEXT"], runtime: "CONCEPT" },
  { id: "microphone", title: "Microphone Input", family: "Inputs", icon: "animate", inputs: [], outputs: ["AUDIO"], runtime: "CONCEPT" },
  { id: "event-input", title: "Event Input", family: "Inputs", icon: "wireless", inputs: [], outputs: ["EVENT"], runtime: "CONCEPT" },
  { id: "hardware-input", title: "Hardware Input", family: "Inputs", icon: "hardware", inputs: [], outputs: ["VALUE"], runtime: "CONCEPT" },
  { id: "stt", title: "Speech to Text (STT)", family: "Voice & AI", icon: "comment", inputs: ["AUDIO"], outputs: ["TEXT"], runtime: "CONCEPT" },
  { id: "llm", title: "LLM Prompt", family: "Voice & AI", icon: "aether", inputs: ["TEXT", "CONTEXT"], outputs: ["TEXT"], runtime: "CONCEPT" },
  { id: "memory", title: "Conversation Memory", family: "Voice & AI", icon: "layers", inputs: ["TEXT"], outputs: ["CONTEXT"], runtime: "CONCEPT" },
  { id: "tool", title: "Tool Call", family: "Voice & AI", icon: "hammer", inputs: ["FLOW", "REQUEST"], outputs: ["FLOW", "RESULT"], runtime: "CONCEPT" },
  { id: "tts", title: "Text to Speech (TTS)", family: "Voice & AI", icon: "animate", inputs: ["TEXT"], outputs: ["AUDIO"], runtime: "CONCEPT" },
  { id: "ai", title: "AI Behavior", family: "Voice & AI", icon: "ai-generate", inputs: ["FLOW", "CONTEXT"], outputs: ["FLOW", "ACTION"], runtime: "CONCEPT" },
  { id: "audio", title: "Audio Output", family: "Outputs", icon: "animate", inputs: ["FLOW", "AUDIO"], outputs: ["FLOW"], runtime: "CONCEPT" },
  { id: "motion", title: "Motion Output", family: "Outputs", icon: "file-character", inputs: ["FLOW", "MOTION"], outputs: ["FLOW"], runtime: "CONCEPT" },
  { id: "event-output", title: "Event Output", family: "Outputs", icon: "wireless", inputs: ["FLOW", "EVENT"], outputs: ["FLOW"], runtime: "CONCEPT" },
  { id: "screen", title: "Screen Output", family: "Outputs", icon: "window", inputs: ["FLOW", "CONTENT"], outputs: ["FLOW"], runtime: "CONCEPT" },
  { id: "led", title: "LED Output", family: "Outputs", icon: "apps", inputs: ["FLOW", "COLOR"], outputs: ["FLOW"], runtime: "CONCEPT" },
  { id: "hardware-output", title: "Hardware Output", family: "Outputs", icon: "hardware", inputs: ["FLOW", "VALUE"], outputs: ["FLOW"], runtime: "CONCEPT" },
];

const initialNodes: readonly GraphNode[] = [
  { id: "start-1", kindID: "start", title: "Start", subtitle: "Scene entry", x: 36, y: 205, properties: {} },
  { id: "greet-1", kindID: "clip", title: "Greeting Motion", subtitle: "clip · greet", x: 232, y: 125, properties: { Clip: "greet", Speed: "1.0×", Loop: "Off" } },
  { id: "parallel-1", kindID: "parallel", title: "Parallel", subtitle: "Run together", x: 446, y: 205, properties: {} },
  { id: "hold-1", kindID: "wait", title: "Hold Pose", subtitle: "1.5 seconds", x: 656, y: 92, properties: { Duration: "1.5 s" } },
  { id: "lights-1", kindID: "emit", title: "Lights On", subtitle: "event · lights_on", x: 656, y: 318, properties: { Event: "lights_on" } },
  { id: "end-1", kindID: "end", title: "End", subtitle: "Scene complete", x: 870, y: 205, properties: {} },
];

const initialEdges: readonly GraphEdge[] = [
  { id: "e1", source: "start-1", target: "greet-1" }, { id: "e2", source: "greet-1", target: "parallel-1" },
  { id: "e3", source: "parallel-1", target: "hold-1" }, { id: "e4", source: "parallel-1", target: "lights-1" },
  { id: "e5", source: "hold-1", target: "end-1" }, { id: "e6", source: "lights-1", target: "end-1" },
];

function kindFor(node: GraphNode) { return nodeKinds.find((kind) => kind.id === node.kindID) ?? nodeKinds[0]; }

function NodeLibrary({ search, onSearch, onAdd }: { search: string; onSearch: (value: string) => void; onAdd: (kind: NodeKind) => void }) {
  const groups = useMemo(() => familyOrder.map((family) => ({
    family,
    kinds: nodeKinds.filter((kind) => kind.family === family && kind.title.toLowerCase().includes(search.toLowerCase())),
  })).filter((group) => group.kinds.length > 0), [search]);
  return <aside className="animation-node-library" aria-label="Node Library">
    <header><AetherIcon name="apps" /><div><strong>NODE LIBRARY</strong><span>Scene actions</span></div></header>
    <label className="animation-node-search"><AetherIcon name="search" /><input aria-label="Find a node" placeholder="Find a node" value={search} onChange={(event) => onSearch(event.target.value)} /></label>
    <div className="animation-node-library-list">
      {groups.map(({ family, kinds }) => <section key={family}>
        <h3>{family}</h3>
        {kinds.map((kind) => <button key={kind.id} type="button" title={kind.runtime === "SCENE V1" ? "Scene v1 action" : `${kind.runtime.toLowerCase()} node`} onClick={() => onAdd(kind)}>
          <AetherIcon name={kind.icon} style={{ color: familyColors[kind.family] }} />
          <span><strong>{kind.title}</strong>{kind.runtime !== "SCENE V1" ? <small>{kind.runtime}</small> : null}</span>
          <AetherIcon name="plus" />
        </button>)}
      </section>)}
      {groups.length === 0 ? <p>No matching nodes.</p> : null}
    </div>
  </aside>;
}

function NodeInspector({ node, onRename }: { node?: GraphNode; onRename: (name: string) => void }) {
  const kind = node ? kindFor(node) : undefined;
  return <aside className="animation-node-inspector" aria-label="Node Inspector">
    <header><AetherIcon name="settings" /><div><strong>NODE INSPECTOR</strong><span>{kind?.family ?? "Nothing selected"}</span></div></header>
    {node && kind ? <div className="animation-node-inspector-body">
      <div className="animation-node-inspector-kind" style={{ color: familyColors[kind.family] }}><AetherIcon name={kind.icon} /><strong>{kind.title}</strong><span>{kind.runtime}</span></div>
      <label>Name<input aria-label="Node name" value={node.title} onChange={(event) => onRename(event.target.value)} /></label>
      {Object.entries(node.properties).length ? <section><h3>PARAMETERS</h3>{Object.entries(node.properties).map(([key, value]) => <div className="animation-node-readout" key={key}><span>{key}</span><strong>{value}</strong></div>)}</section> : <p>This flow node has no editable parameters.</p>}
      <section><h3>INPUTS</h3>{kind.inputs.length ? kind.inputs.map((port) => <div className="animation-node-port-row" key={port}><i className={port === "FLOW" ? "" : "data"} />{port}</div>) : <span className="animation-node-none">None</span>}</section>
      <section><h3>OUTPUTS</h3>{kind.outputs.length ? kind.outputs.map((port) => <div className="animation-node-port-row animation-node-port-row--output" key={port}>{port}<i className={port === "FLOW" ? "" : "data"} /></div>) : <span className="animation-node-none">None</span>}</section>
      <div className={`animation-node-capability animation-node-capability--${kind.runtime === "SCENE V1" ? "ready" : "concept"}`}><AetherIcon name={kind.runtime === "SCENE V1" ? "status-incomplete" : "history"} />{kind.runtime === "SCENE V1" ? "Scene v1 action" : kind.runtime === "IMPORT ONLY" ? "Import reference; replace with structured logic" : "Concept node; runtime binding planned"}</div>
    </div> : <div className="animation-node-empty"><AetherIcon name="node-select" /><strong>Select a Node</strong><span>Choose a node on the canvas to inspect its parameters and ports.</span></div>}
  </aside>;
}

function GraphCard({ node, selected, connectSource, tool, onPointerDown, onActivate }: {
  node: GraphNode; selected: boolean; connectSource: boolean; tool: NodeTool;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void; onActivate: () => void;
}) {
  const kind = kindFor(node);
  return <button type="button" className={`animation-graph-node${selected ? " animation-graph-node--selected" : ""}${connectSource ? " animation-graph-node--connect" : ""}`}
    aria-pressed={selected} aria-label={`${node.title} node`} style={{ left: node.x, top: node.y, "--node-color": familyColors[kind.family] } as CSSProperties}
    onPointerDown={onPointerDown} onClick={onActivate}>
    {selected && tool === "select" ? <span className="animation-node-quickbar" aria-hidden><AetherIcon name="settings" /><AetherIcon name="comment" /><AetherIcon name="export" /><AetherIcon name="help" /></span> : null}
    <span className="animation-graph-node-head"><AetherIcon name={kind.icon} /><span><strong>{node.title}</strong><small>{kind.family}</small></span><i className={kind.runtime === "SCENE V1" ? "ready" : ""} /><AetherIcon name="more-circle" /></span>
    <span className="animation-graph-node-body">
      <em>{node.subtitle}</em>
      {Array.from({ length: Math.max(kind.inputs.length, kind.outputs.length, 1) }, (_, index) => <span className="animation-graph-port" key={index}>
        <span>{kind.inputs[index] ? <><i className={kind.inputs[index] === "FLOW" ? "" : "data"} />{kind.inputs[index]}</> : null}</span>
        <span>{kind.outputs[index] ? <>{kind.outputs[index]}<i className={kind.outputs[index] === "FLOW" ? "" : "data"} /></> : null}</span>
      </span>)}
      {Object.keys(node.properties).length ? <span className="animation-node-properties">{Object.values(node.properties).slice(0, 3).map((value) => <small key={value}>{value}</small>)}</span> : null}
    </span>
  </button>;
}

function PerformanceStrip({ timeS, playing, onSeek, onTogglePlay }: { timeS: number; playing: boolean; onSeek: (time: number) => void; onTogglePlay: () => void }) {
  return <section className="animation-node-performance" aria-label="Performance timeline">
    <header><span><AetherIcon name="animate" /><strong>PERFORMANCE</strong><small>Graph and timeline are two views of the same scene</small></span><div>
      <button type="button" aria-label="Jump to show start" onClick={() => onSeek(0)}><AetherIcon name="undo" /></button>
      <button type="button" aria-label={playing ? "Pause show" : "Play show"} onClick={onTogglePlay}><AetherIcon name="play" /></button>
      <button type="button" aria-label="Jump to show end" onClick={() => onSeek(30)}><AetherIcon name="redo" /></button>
    </div></header>
    <div className="animation-performance-rows">
      <div className="animation-performance-labels"><span><i style={{ background: "#50a9ff" }} />Greeting Motion</span><span><i style={{ background: "#917eea" }} />Hold Pose</span><span><i style={{ background: "#ff8a43" }} />Lights On</span></div>
      <div className="animation-performance-lanes" onPointerDown={(event) => { const rect = event.currentTarget.getBoundingClientRect(); onSeek(Math.max(0, Math.min(30, (event.clientX - rect.left) / rect.width * 30))); }}>
        <i className="animation-performance-bar animation-performance-bar--greeting" /><i className="animation-performance-bar animation-performance-bar--hold" /><i className="animation-performance-bar animation-performance-bar--lights" />
        <b className="animation-performance-playhead" style={{ left: `${timeS / 30 * 100}%` }} />
      </div>
    </div>
  </section>;
}

export function StudioNodeWorkspace({ timeS, playing, onSeek, onTogglePlay }: { timeS: number; playing: boolean; onSeek: (time: number) => void; onTogglePlay: () => void }) {
  const [nodes, setNodes] = useState<GraphNode[]>([...initialNodes]);
  const [edges, setEdges] = useState<GraphEdge[]>([...initialEdges]);
  const [selectedID, setSelectedID] = useState<string | null>("start-1");
  const [connectSource, setConnectSource] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tool, setTool] = useState<NodeTool>("select");
  const [zoom, setZoom] = useState(.85);
  const [grid, setGrid] = useState(true);
  const [status, setStatus] = useState("Sample scene graph · UI draft");
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; clientX: number; clientY: number; x: number; y: number; moved: boolean } | null>(null);
  const panRef = useRef<{ clientX: number; clientY: number; left: number; top: number } | null>(null);
  const selected = nodes.find((node) => node.id === selectedID);

  const addNode = (kind: NodeKind) => {
    const index = nodes.length;
    const node: GraphNode = { id: `${kind.id}-${Date.now()}`, kindID: kind.id, title: kind.title, subtitle: kind.runtime === "SCENE V1" ? "New scene action" : kind.runtime.toLowerCase(), x: 470 + index % 4 * 22, y: 120 + index % 5 * 34, properties: { ...(kind.properties ?? {}) } };
    setNodes((current) => [...current, node]); setSelectedID(node.id);
    setStatus(`Added ${kind.title}${kind.runtime === "SCENE V1" ? "" : " concept"}`);
  };
  const activateNode = (id: string) => {
    if (dragRef.current?.moved) return;
    if (tool === "connect") {
      if (!connectSource) { setConnectSource(id); setStatus("Choose a target node"); return; }
      if (connectSource !== id) { setEdges((current) => [...current, { id: `edge-${Date.now()}`, source: connectSource, target: id }]); setStatus("Connected nodes"); }
      setConnectSource(null); return;
    }
    setSelectedID(id); setStatus(`Selected ${nodes.find((node) => node.id === id)?.title ?? "node"}`);
  };
  const onNodePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, node: GraphNode) => {
    if (tool !== "select") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: node.id, clientX: event.clientX, clientY: event.clientY, x: node.x, y: node.y, moved: false };
    setSelectedID(node.id);
  };
  const onNodePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current; if (!drag) return;
    const dx = (event.clientX - drag.clientX) / zoom; const dy = (event.clientY - drag.clientY) / zoom;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    setNodes((current) => current.map((node) => node.id === drag.id ? { ...node, x: Math.max(0, Math.min(950, drag.x + dx)), y: Math.max(15, Math.min(430, drag.y + dy)) } : node));
  };
  const finishDrag = () => { if (dragRef.current?.moved) setStatus("Moved node"); window.setTimeout(() => { dragRef.current = null; }, 0); };
  const reset = () => { setNodes([...initialNodes]); setEdges([...initialEdges]); setSelectedID("start-1"); setConnectSource(null); setZoom(.85); setStatus("Restored the sample scene graph"); };
  const frameAll = () => { setZoom(.85); canvasRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" }); setStatus("Framed the complete sample graph"); };
  const validation = nodes.filter((node) => node.kindID === "start").length === 1 && nodes.filter((node) => node.kindID === "end").length === 1;

  return <div className="animation-node-editor">
    <div className="animation-node-toolbar">
      <div className="animation-node-toolset" role="group" aria-label="Graph tool">
        {([ ["select", "node-select", "Select"], ["hand", "mouse", "Hand"], ["connect", "connector", "Connect"] ] as const).map(([id, icon, label]) => <button key={id} type="button" aria-pressed={tool === id} onClick={() => { setTool(id); setConnectSource(null); setStatus(`${label} selected`); }}><AetherIcon name={icon} />{label}</button>)}
      </div>
      <span className="animation-node-toolbar-divider" />
      <button type="button" onClick={frameAll}><AetherIcon name="fit" />Frame All</button>
      <button type="button" onClick={() => setGrid((current) => !current)}><AetherIcon name="layout" />{grid ? "Hide Grid" : "Show Grid"}</button>
      <button type="button" onClick={() => setStatus(validation ? "Graph structure is valid" : "Graph needs exactly one Start and End node")}><AetherIcon name={validation ? "status-incomplete" : "status-error"} />Validate</button>
      <span className="animation-node-toolbar-divider" />
      <button type="button" className="animation-node-icon-button" aria-label="Zoom out" onClick={() => setZoom((current) => Math.max(.5, current - .1))}>−</button><strong>{Math.round(zoom * 100)}%</strong><button type="button" className="animation-node-icon-button" aria-label="Zoom in" onClick={() => setZoom((current) => Math.min(1.25, current + .1))}>+</button>
      <span className="animation-node-status">{status}</span>
      <button type="button" className="animation-node-delete" disabled={!selectedID} onClick={() => { if (!selectedID) return; setNodes((current) => current.filter((node) => node.id !== selectedID)); setEdges((current) => current.filter((edge) => edge.source !== selectedID && edge.target !== selectedID)); setSelectedID(null); setStatus("Removed node and attached connections"); }}><AetherIcon name="delete" />Delete</button>
      <button type="button" onClick={reset}><AetherIcon name="redo" />Reset Sample</button>
    </div>
    <div className="animation-node-main">
      <NodeLibrary search={search} onSearch={setSearch} onAdd={addNode} />
      <div ref={canvasRef} className={`animation-node-canvas-scroll${tool === "hand" ? " animation-node-canvas-scroll--hand" : ""}`} aria-label="Scene node graph"
        onPointerDown={(event) => { if (tool === "hand" && canvasRef.current) { event.currentTarget.setPointerCapture(event.pointerId); panRef.current = { clientX: event.clientX, clientY: event.clientY, left: canvasRef.current.scrollLeft, top: canvasRef.current.scrollTop }; } else if (event.target === event.currentTarget) setSelectedID(null); }}
        onPointerMove={(event) => { onNodePointerMove(event); const pan = panRef.current; if (pan && canvasRef.current) { canvasRef.current.scrollLeft = pan.left - (event.clientX - pan.clientX); canvasRef.current.scrollTop = pan.top - (event.clientY - pan.clientY); } }}
        onPointerUp={() => { finishDrag(); panRef.current = null; }} onPointerCancel={() => { finishDrag(); panRef.current = null; }}>
        <div className={`animation-node-canvas${grid ? " animation-node-canvas--grid" : ""}`} style={{ width: 1120 * zoom, height: 540 * zoom }}>
          <div className="animation-node-canvas-scale" style={{ transform: `scale(${zoom})` }}>
            <svg viewBox="0 0 1120 540" role="img" aria-label="Node connections">
              {edges.map((edge) => { const source = nodes.find((node) => node.id === edge.source); const target = nodes.find((node) => node.id === edge.target); if (!source || !target) return null; const x1 = source.x + 166, y1 = source.y + 58, x2 = target.x, y2 = target.y + 58, bend = Math.max(50, Math.abs(x2 - x1) * .45); return <path key={edge.id} d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`} />; })}
            </svg>
            {nodes.map((node) => <GraphCard key={node.id} node={node} selected={selectedID === node.id} connectSource={connectSource === node.id} tool={tool} onPointerDown={(event) => onNodePointerDown(event, node)} onActivate={() => activateNode(node.id)} />)}
          </div>
        </div>
      </div>
      <NodeInspector node={selected} onRename={(name) => setNodes((current) => current.map((node) => node.id === selectedID ? { ...node, title: name } : node))} />
    </div>
    <PerformanceStrip timeS={timeS} playing={playing} onSeek={onSeek} onTogglePlay={onTogglePlay} />
  </div>;
}

function ShowTable({ timeS }: { timeS: number }) {
  const rows = [
    ["Opening", "Scene", "00:00", "00:08", "Ready"], ["Greeting Motion", "Animation", "00:08", "00:18", "Active"],
    ["Hold Pose", "Action", "00:18", "00:19.5", "Ready"], ["Lights On", "Event", "00:18", "00:30", "Ready"], ["Scene complete", "Flow", "00:30", "00:30", "Ready"],
  ];
  return <div className="animation-show-table"><header><span>SHOW SEQUENCE</span><strong>Scene actions</strong><small>Playhead {timeS.toFixed(2)}s</small></header><table aria-label="Show scene actions"><thead><tr>{["ACTION", "TYPE", "START", "END", "STATE"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${index}-${cell}`}>{index === 0 ? <><AetherIcon name={row[1] === "Event" ? "wireless" : row[1] === "Animation" ? "file-clip" : "scene"} />{cell}</> : cell}</td>)}</tr>)}</tbody></table></div>;
}

function ShowPreview({ timeS }: { timeS: number }) {
  return <div className="animation-show-stage"><div className="animation-show-grid"><article><AetherIcon name="scene" /><strong>Opening</strong><span>0:00 – 0:08</span></article><article className={timeS >= 8 && timeS < 18 ? "animation-show-cue animation-show-cue--active" : "animation-show-cue"}><AetherIcon name="file-clip" /><strong>Character entrance</strong><span>0:08 – 0:18</span></article><article className={timeS >= 18 ? "animation-show-cue animation-show-cue--active" : "animation-show-cue"}><AetherIcon name="lighting" /><strong>Stage wash</strong><span>0:18 – 0:30</span></article></div><div className="animation-viewport-caption"><strong>SHOW PREVIEW</strong><span>Scene sequence · {timeS.toFixed(2)}s</span></div></div>;
}

export function StudioShowWorkspace({ timeS, playing, onSeek, onTogglePlay }: { timeS: number; playing: boolean; onSeek: (time: number) => void; onTogglePlay: () => void }) {
  const [mode, setMode] = useState<ShowCenterView>("node-graph");
  return <div className="animation-show-workspace"><div className="animation-show-center">
    {mode === "node-graph" ? <StudioNodeWorkspace timeS={timeS} playing={playing} onSeek={onSeek} onTogglePlay={onTogglePlay} /> : mode === "table" ? <ShowTable timeS={timeS} /> : <ShowPreview timeS={timeS} />}
  </div><div className="animation-show-switcher"><SegmentedControl ariaLabel="Show center view" value={mode} onChange={(id) => setMode(id as ShowCenterView)} options={[
    { id: "node-graph", label: "Node Graph", icon: <AetherIcon name="sketch-nodes" /> }, { id: "table", label: "Table", icon: <AetherIcon name="items" /> }, { id: "three-d", label: "3D", icon: <AetherIcon name="cube" /> },
  ]} /></div></div>;
}
