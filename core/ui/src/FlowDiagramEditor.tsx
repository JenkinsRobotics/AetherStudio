import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { SelectField } from "./SelectField";
import { SegmentedControl } from "./SegmentedControl";
import { FlowDiagram, FlowDiagramLabel, FlowDiagramNode } from "./FlowDiagram";
import { FlowDiagramInspector, type FlowDocumentChange } from "./FlowDiagramInspector";
import { flowClamp, flowConnectionError, flowDelete, flowEndpoint, flowMoveNode, flowMovePort, flowPortPoint, flowRoutes, type FlowDocument, type FlowEndpoint, type FlowNode, type FlowPoint, type FlowSelection } from "./flow-diagram-model";
import "./FlowDiagramEditor.css";

export interface FlowDiagramEditorProps {
  value: FlowDocument;
  onChange: FlowDocumentChange;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  paused?: boolean;
  playbackRate?: number;
  highlightedRouteIds?: readonly string[];
  actions?: ReactNode;
}
type DragTarget = { kind: "node"; id: string } | { kind: "port"; nodeId: string; id: string } | { kind: "bend"; id: string; index: number };
interface Drag { target: DragTarget; base: FlowDocument; current: FlowDocument; start: FlowPoint; pointerId: number; svg: SVGSVGElement }

const shortLabel = (label: string, limit = 28) => label.length > limit ? `${label.slice(0, limit - 1)}…` : label;
const svgPoint = (svg: SVGSVGElement, x: number, y: number): FlowPoint => {
  const matrix = svg.getScreenCTM();
  if (!matrix) return { x, y };
  const point = new DOMPoint(x, y).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
};

/** Controlled editing surface. The host owns persistence and history; routes derive from the document. */
export function FlowDiagramEditor({ value, onChange, onUndo, onRedo, canUndo, canRedo, paused, playbackRate, highlightedRouteIds, actions }: FlowDiagramEditorProps) {
  const [selection, setSelection] = useState<FlowSelection | null>(null);
  const [mode, setMode] = useState("select");
  const [snap, setSnap] = useState(true);
  const [zoom, setZoom] = useState("fit");
  const [pending, setPending] = useState<FlowEndpoint | null>(null);
  const [notice, setNotice] = useState("Select a node, point or connection to edit. Drag to move.");
  const [draft, setDraft] = useState<FlowDocument | null>(null);
  const drag = useRef<Drag | null>(null);
  const document = draft ?? value;
  const selectedEdge = selection?.kind === "connection" ? document.connections.find(edge => edge.id === selection.id) : undefined;
  const select = (next: FlowSelection | null) => { setSelection(next); setPending(null); };
  const cancelDrag = () => { drag.current = null; setDraft(null); };
  const remove = () => {
    if (!selection) return;
    onChange(flowDelete(value, selection));
    setSelection(null); setPending(null); setNotice("Removed. Undo restores the item and its connections.");
  };
  const startDrag = (event: PointerEvent<SVGGElement>, target: DragTarget) => {
    if (event.button !== 0 || mode !== "select") return;
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    event.stopPropagation(); event.preventDefault(); event.currentTarget.focus();
    const start = svgPoint(svg, event.clientX, event.clientY);
    drag.current = { target, base: value, current: value, start, pointerId: event.pointerId, svg };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (target.kind === "bend") select({ kind: "connection", id: target.id });
    else select(target);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    const point = svgPoint(current.svg, event.clientX, event.clientY);
    if (Math.hypot(point.x - current.start.x, point.y - current.start.y) < 2 && current.current === current.base) return;
    const rounded = (n: number) => snap && !event.shiftKey ? Math.round(n / 8) * 8 : Math.round(n);
    const target = current.target;
    let next: FlowDocument;
    if (target.kind === "node") {
      const node = current.base.nodes.find(n => n.id === target.id)!;
      next = flowMoveNode(current.base, target.id, { x: rounded(node.x + point.x - current.start.x), y: rounded(node.y + point.y - current.start.y) });
    } else if (target.kind === "port") next = flowMovePort(current.base, target.nodeId, target.id, point);
    else next = { ...current.base, connections: current.base.connections.map(edge => edge.id === target.id ? { ...edge, waypoints: edge.waypoints.map((p, index) => index === target.index ? { x: flowClamp(rounded(point.x), 0, value.width), y: flowClamp(rounded(point.y), 0, value.height) } : p) } : edge) };
    current.current = next;
    setDraft(next);
  };
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const current = drag.current;
    cancelDrag();
    if (current.current !== current.base) onChange(current.current);
  };
  const clickPort = (endpoint: FlowEndpoint) => {
    if (mode !== "connect") { select({ kind: "port", nodeId: endpoint.nodeId, id: endpoint.portId }); return; }
    const found = flowEndpoint(value, endpoint)!;
    if (found.port.direction === "output") { setPending(endpoint); setSelection({ kind: "port", nodeId: endpoint.nodeId, id: endpoint.portId }); setNotice(`Connecting ${found.node.label} / ${found.port.label}. Choose an input.`); return; }
    if (!pending) { setNotice("Start with an output point, then choose an input."); return; }
    const error = flowConnectionError(value, pending, endpoint);
    if (error) { setNotice(error); return; }
    if (value.connections.length >= 400) { setNotice("This diagram has reached its 400-connection limit."); return; }
    const source = flowEndpoint(value, pending)!;
    const id = crypto.randomUUID();
    onChange({ ...value, connections: [...value.connections, { id, label: `${source.node.label} → ${found.node.label}`.slice(0, 160), notes: "", source: pending, target: endpoint, tone: source.node.tone, dashed: false, waypoints: [] }] });
    setSelection({ kind: "connection", id }); setPending(null); setMode("select"); setNotice("Connection created. Select its line to change endpoints, color or bends.");
  };
  const addNode = () => {
    if (value.nodes.length >= 100) return;
    const id = crypto.randomUUID(), count = value.nodes.length;
    const node: FlowNode = { id, label: "New node", detail: "", notes: "", kind: "module", tone: "blue", x: flowClamp(260 + count % 5 * 28, 12, value.width - 172), y: flowClamp(210 + count % 4 * 24, 28, value.height - 92), width: 160, height: 80, ports: [
      { id: "in", label: "Input", direction: "input", side: "left", offset: .5 },
      { id: "out", label: "Output", direction: "output", side: "right", offset: .5 },
    ] };
    onChange({ ...value, nodes: [...value.nodes, node] }); select({ kind: "node", id }); setMode("select"); setNotice("Node added. Give it a label, then connect its points.");
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("input, textarea, select, [contenteditable=true]")) return;
    if (event.key === "Escape") { cancelDrag(); setPending(null); setMode("select"); setNotice("Interaction canceled."); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault(); cancelDrag(); setPending(null);
      if (event.shiftKey) { if (canRedo) onRedo?.(); } else if (canUndo) onUndo?.();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); remove(); return; }
    if (!selection || !(event.target instanceof SVGElement) || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    if (selection.kind === "node") {
      const node = value.nodes.find(n => n.id === selection.id);
      if (!node) return;
      const step = event.shiftKey ? 10 : 1;
      onChange(flowMoveNode(value, node.id, { x: node.x + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0), y: node.y + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0) }), { mergeKey: `nudge:${node.id}` });
    } else if (selection.kind === "port") {
      const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
      onChange({ ...value, nodes: value.nodes.map(node => node.id === selection.nodeId ? { ...node, ports: node.ports.map(port => port.id === selection.id ? { ...port, offset: flowClamp(port.offset + direction * (event.shiftKey ? .1 : .01), 0, 1) } : port) } : node) }, { mergeKey: `nudge-port:${selection.id}` });
    }
  };
  return <div className="aui-flow-editor" data-zoom={zoom} style={{ "--flow-editor-canvas-width": `${value.width * (Number(zoom) || 1)}px` } as CSSProperties} onKeyDown={keyDown} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}>
    <div className="aui-flow-editor-toolbar" aria-label="Diagram editing tools">
      <SegmentedControl ariaLabel="Diagram interaction" value={mode} onChange={next => { setMode(next); setPending(null); setNotice(next === "connect" ? "Choose an output point, then an input point." : "Select a node, point or connection to edit."); }} options={[{ id: "select", label: "Select / move" }, { id: "connect", label: "Connect" }]} />
      <Button onClick={addNode} disabled={value.nodes.length >= 100}>Add node</Button>
      {onUndo && <Button disabled={!canUndo} onClick={() => { cancelDrag(); setPending(null); onUndo(); }}>Undo</Button>}
      {onRedo && <Button disabled={!canRedo} onClick={() => { cancelDrag(); setPending(null); onRedo(); }}>Redo</Button>}
      <Checkbox label="Snap to grid" checked={snap} onChange={e => setSnap(e.target.checked)} />
      <SelectField aria-label="Diagram zoom" value={zoom} onChange={e => setZoom(e.target.value)} options={[{ value: "fit", label: "Fit diagram" }, { value: "1", label: "100%" }, { value: "1.5", label: "150%" }]} />
      {actions}
    </div>
    <div className="aui-flow-editor-workspace">
      <FlowDiagram title="Editable signal flow" description={`${document.nodes.length} editable nodes and ${document.connections.length} connections. Select a node or connection to inspect it. Use Connect to join output and input points.`}
        width={document.width} height={document.height} routes={flowRoutes(document)} paused={paused} playbackRate={playbackRate} highlightedRouteIds={highlightedRouteIds}
        interactive selectedRouteId={selectedEdge?.id} onRouteSelect={id => { select({ kind: "connection", id }); setMode("select"); }}>
        {document.nodes.map(node => {
          const selected = selection?.kind === "node" && selection.id === node.id;
          return <g key={node.id} className="aui-flow-editable-node" data-node={node.id} data-selected={selected} data-tone={node.tone}>
            <g className="aui-flow-node-drag" role="button" tabIndex={0} aria-label={`Node: ${node.label}`} aria-pressed={selected}
              onPointerDown={event => startDrag(event, { kind: "node", id: node.id })}
              onClick={() => { if (mode === "select") select({ kind: "node", id: node.id }); }}
              onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select({ kind: "node", id: node.id }); } }}>
              <title>{node.label}{node.notes ? ` — ${node.notes}` : ""}</title>
              <rect className="aui-flow-node-hit" x={node.x - 6} y={node.y - 6} width={node.width + 12} height={node.height + 12} rx="8" />
              {node.kind === "source" ? <FlowDiagramLabel x={node.x - 8} y={node.y + 18}>{shortLabel(node.label)}</FlowDiagramLabel> : <>
                <FlowDiagramNode x={node.x} y={node.y} width={node.width} height={node.height} variant={node.kind} label={node.kind === "gate" ? undefined : shortLabel(node.label, node.kind === "processor" ? 13 : 21)} detail={node.kind === "gate" ? undefined : shortLabel(node.detail, 24)} />
                {node.kind === "gate" && <FlowDiagramLabel x={node.x + node.width / 2} y={node.y - 12} anchor="middle">{shortLabel(node.label, 20)}</FlowDiagramLabel>}
              </>}
            </g>
            {node.ports.map(port => {
              const point = flowPortPoint(node, port);
              const selectedPort = selection?.kind === "port" && selection.nodeId === node.id && selection.id === port.id;
              const isPending = pending?.nodeId === node.id && pending.portId === port.id;
              return <g key={port.id} className="aui-flow-editable-port" data-node={node.id} data-port={port.id} data-selected={selectedPort || isPending}
                role="button" tabIndex={0} aria-label={`${port.direction === "input" ? "Input" : "Output"} point: ${node.label} / ${port.label}`} aria-pressed={selectedPort || isPending}
                onPointerDown={event => { event.stopPropagation(); startDrag(event, { kind: "port", nodeId: node.id, id: port.id }); }}
                onClick={event => { event.stopPropagation(); clickPort({ nodeId: node.id, portId: port.id }); }}
                onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); clickPort({ nodeId: node.id, portId: port.id }); } }}>
                <title>{port.label} · {port.direction} · {port.side}</title>
                <circle className="aui-flow-point-hit" cx={point.x} cy={point.y} r="10" />
                <circle className="aui-flow-port" cx={point.x} cy={point.y} r="4.5" />
                {node.kind === "processor" && port.side === "left" && <text className="aui-flow-point-label" x={point.x + 17} y={point.y + 4}>{shortLabel(port.label, 22)}</text>}
                {isPending && <circle className="aui-flow-pending-ring" cx={point.x} cy={point.y} r="9" />}
              </g>;
            })}
          </g>;
        })}
        {selectedEdge?.waypoints.map((point, index) => <g key={index} className="aui-flow-bend-handle" role="button" tabIndex={0} aria-label={`Route bend ${index + 1}`} onPointerDown={event => startDrag(event, { kind: "bend", id: selectedEdge.id, index })}
          onClick={() => setNotice(`Bend ${index + 1}: drag, use arrow keys, or edit its coordinates in the inspector.`)}
          onKeyDown={event => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setNotice(`Bend ${index + 1}: use arrow keys to move it.`); return; }
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
            event.preventDefault(); event.stopPropagation();
            const step = event.shiftKey ? 10 : 1;
            onChange({ ...value, connections: value.connections.map(edge => edge.id === selectedEdge.id ? { ...edge, waypoints: edge.waypoints.map((p, i) => i === index ? { x: flowClamp(p.x + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0), 0, value.width), y: flowClamp(p.y + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0), 0, value.height) } : p) } : edge) }, { mergeKey: `bend:${selectedEdge.id}:${index}` });
          }}>
          <circle className="aui-flow-point-hit" cx={point.x} cy={point.y} r="12" />
          <rect x={point.x - 5} y={point.y - 5} width="10" height="10" rx="2" />
        </g>)}
      </FlowDiagram>
      <FlowDiagramInspector value={document} selection={selection} onChange={onChange} onSelect={select} onDelete={remove} onNotice={setNotice} />
    </div>
    <div className="aui-flow-editor-status" role="status"><span>{notice}</span><span>{document.nodes.length} nodes · {document.connections.length} connections</span></div>
  </div>;
}
