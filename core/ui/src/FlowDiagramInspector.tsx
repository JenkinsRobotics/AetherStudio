import { Button } from "./Button";
import { TextField } from "./TextField";
import { NumberField } from "./NumberField";
import { SelectField } from "./SelectField";
import { Checkbox } from "./Checkbox";
import { FLOW_SIDES, FLOW_TONES, flowConnectionError, flowEndpoint, flowMoveNode, flowNodeBounds, type FlowDocument, type FlowSelection, type FlowNode, type FlowConnection, type FlowPort } from "./flow-diagram-model";

export interface FlowEditOptions { mergeKey?: string }
export type FlowDocumentChange = (next: FlowDocument, options?: FlowEditOptions) => void;

export function FlowDiagramInspector({ value, selection, onChange, onSelect, onDelete, onNotice }: {
  value: FlowDocument;
  selection: FlowSelection | null;
  onChange: FlowDocumentChange;
  onSelect: (selection: FlowSelection | null) => void;
  onDelete: () => void;
  onNotice: (message: string) => void;
}) {
  const node = selection?.kind === "node" ? value.nodes.find(n => n.id === selection.id) : selection?.kind === "port" ? value.nodes.find(n => n.id === selection.nodeId) : undefined;
  const port = selection?.kind === "port" ? node?.ports.find(p => p.id === selection.id) : undefined;
  const bounds = node ? flowNodeBounds(value, node) : undefined;
  const edge = selection?.kind === "connection" ? value.connections.find(e => e.id === selection.id) : undefined;
  const editNode = (patch: Partial<FlowNode>, field?: string) => node && onChange({ ...value, nodes: value.nodes.map(n => n.id === node.id ? { ...n, ...patch } : n) }, { mergeKey: field ? `node:${node.id}:${field}` : undefined });
  const editPort = (patch: Partial<FlowPort>, field?: string) => node && port && editNode({ ports: node.ports.map(p => p.id === port.id ? { ...p, ...patch } : p) }, field ? `port:${port.id}:${field}` : undefined);
  const editEdge = (patch: Partial<FlowConnection>, field?: string) => edge && onChange({ ...value, connections: value.connections.map(e => e.id === edge.id ? { ...e, ...patch } : e) }, { mergeKey: field ? `connection:${edge.id}:${field}` : undefined });
  const colors = FLOW_TONES.map(tone => ({ value: tone, label: tone[0].toUpperCase() + tone.slice(1) }));
  const notes = (text: string, onEdit: (text: string) => void) => <label className="aui-flow-editor-field">Notes<textarea className="aui-text-field" aria-label="Notes" maxLength={4000} rows={3} value={text} onChange={event => onEdit(event.target.value)} placeholder="Describe this part of the flow…" /></label>;
  const addPort = (direction: "input" | "output") => {
    if (!node || node.ports.length >= 40) return;
    const added: FlowPort = { id: crypto.randomUUID(), label: `${direction === "input" ? "Input" : "Output"} ${node.ports.length + 1}`, direction, side: direction === "input" ? "left" : "right", offset: .5 };
    editNode({ ports: [...node.ports, added] });
    onSelect({ kind: "port", nodeId: node.id, id: added.id });
  };
  const endpoints = (direction: "input" | "output") => value.nodes.flatMap(n => n.ports.filter(p => p.direction === direction).map(p => ({ value: JSON.stringify([n.id, p.id]), label: `${n.label} / ${p.label}` })));
  const reconnect = (which: "source" | "target", encoded: string) => {
    if (!edge) return;
    const [nodeId, portId] = JSON.parse(encoded) as [string, string];
    const endpoint = { nodeId, portId };
    const error = flowConnectionError(value, which === "source" ? endpoint : edge.source, which === "target" ? endpoint : edge.target, edge.id);
    if (error) { onNotice(error); return; }
    editEdge({ [which]: endpoint });
    onNotice("Connection endpoint updated.");
  };
  return <aside className="aui-flow-editor-inspector" aria-label="Diagram inspector">
    <header><strong>{port ? "Connection point" : node ? "Node" : edge ? "Connection" : "Diagram"}</strong>{selection && <Button onClick={() => onSelect(null)}>Done</Button>}</header>
    {!node && !edge && <><p>Select a node, point or line to edit it.</p><p>Drag nodes to reposition them. Drag connection points around a node’s edge. Use Connect to join an output to an input.</p><p>Arrow keys move selected nodes; Shift moves by 10. Escape cancels a drag or pending connection.</p></>}
    {node && !port && <>
      <label className="aui-flow-editor-field">Label<TextField aria-label="Node label" maxLength={160} value={node.label} onChange={e => editNode({ label: e.target.value }, "label")} /></label>
      <label className="aui-flow-editor-field">Detail<TextField aria-label="Node detail" maxLength={160} value={node.detail} onChange={e => editNode({ detail: e.target.value }, "detail")} /></label>
      {notes(node.notes, text => editNode({ notes: text }, "notes"))}
      <div className="aui-flow-editor-pair">
        <label className="aui-flow-editor-field">X<NumberField aria-label="Node X" value={node.x} min={bounds!.minX} max={bounds!.maxX} onCommit={x => onChange(flowMoveNode(value, node.id, { x, y: node.y }))} /></label>
        <label className="aui-flow-editor-field">Y<NumberField aria-label="Node Y" value={node.y} min={bounds!.minY} max={bounds!.maxY} onCommit={y => onChange(flowMoveNode(value, node.id, { x: node.x, y }))} /></label>
        <label className="aui-flow-editor-field">Width<NumberField aria-label="Node width" value={node.width} min={node.kind === "processor" ? 120 : 16} max={value.width - node.x} onCommit={width => editNode({ width })} /></label>
        <label className="aui-flow-editor-field">Height<NumberField aria-label="Node height" value={node.height} min={node.kind === "processor" ? 96 : 20} max={value.height - node.y} onCommit={height => editNode({ height })} /></label>
      </div>
      <label className="aui-flow-editor-field">Color<SelectField aria-label="Node color" value={node.tone} options={colors} onChange={e => editNode({ tone: e.target.value as FlowNode["tone"] })} /></label>
      <strong>Connection points · {node.ports.length}</strong>
      <div className="aui-flow-editor-port-list">{node.ports.map(p => <Button key={p.id} onClick={() => onSelect({ kind: "port", nodeId: node.id, id: p.id })}>{p.label}<span>{p.direction}</span></Button>)}</div>
      <div className="aui-flow-editor-actions"><Button disabled={node.ports.length >= 40} onClick={() => addPort("input")}>Add input</Button><Button disabled={node.ports.length >= 40} onClick={() => addPort("output")}>Add output</Button></div>
    </>}
    {node && port && <>
      <Button onClick={() => onSelect({ kind: "node", id: node.id })}>Back to {node.label}</Button>
      <label className="aui-flow-editor-field">Label<TextField aria-label="Point label" maxLength={160} value={port.label} onChange={e => editPort({ label: e.target.value }, "label")} /></label>
      <p>{port.direction === "input" ? "Input" : "Output"} · {value.connections.filter(e => [e.source, e.target].some(end => end.nodeId === node.id && end.portId === port.id)).length} attached connections</p>
      <label className="aui-flow-editor-field">Side<SelectField aria-label="Point side" value={port.side} options={FLOW_SIDES.map(side => ({ value: side, label: side }))} onChange={e => editPort({ side: e.target.value as FlowPort["side"] })} /></label>
      <label className="aui-flow-editor-field">Position along edge<NumberField aria-label="Point position" value={Math.round(port.offset * 100)} min={0} max={100} unit="%" onCommit={offset => editPort({ offset: offset / 100 })} /></label>
      <p>Drag the point to another edge, or enter an exact position. Attached connections follow it.</p>
    </>}
    {edge && <>
      <label className="aui-flow-editor-field">Label<TextField aria-label="Connection label" value={edge.label} maxLength={160} onChange={e => editEdge({ label: e.target.value }, "label")} /></label>
      {notes(edge.notes, text => editEdge({ notes: text }, "notes"))}
      <label className="aui-flow-editor-field">From<SelectField aria-label="Connection source" value={JSON.stringify([edge.source.nodeId, edge.source.portId])} options={endpoints("output")} onChange={e => reconnect("source", e.target.value)} /></label>
      <label className="aui-flow-editor-field">To<SelectField aria-label="Connection target" value={JSON.stringify([edge.target.nodeId, edge.target.portId])} options={endpoints("input")} onChange={e => reconnect("target", e.target.value)} /></label>
      <label className="aui-flow-editor-field">Color<SelectField aria-label="Connection color" value={edge.tone} options={colors} onChange={e => editEdge({ tone: e.target.value as FlowConnection["tone"] })} /></label>
      <Checkbox label="Dashed connection" checked={edge.dashed} onChange={e => editEdge({ dashed: e.target.checked })} />
      <strong>Route bends · {edge.waypoints.length}</strong>
      {edge.waypoints.map((point, index) => <div className="aui-flow-editor-bend" key={index}>
        <NumberField aria-label={`Bend ${index + 1} X`} value={point.x} min={0} max={value.width} onCommit={x => editEdge({ waypoints: edge.waypoints.map((p, i) => i === index ? { ...p, x } : p) })} />
        <NumberField aria-label={`Bend ${index + 1} Y`} value={point.y} min={0} max={value.height} onCommit={y => editEdge({ waypoints: edge.waypoints.map((p, i) => i === index ? { ...p, y } : p) })} />
        <Button aria-label={`Remove bend ${index + 1}`} onClick={() => editEdge({ waypoints: edge.waypoints.filter((_, i) => i !== index) })}>×</Button>
      </div>)}
      <div className="aui-flow-editor-actions"><Button disabled={edge.waypoints.length >= 20} onClick={() => {
        const a = edge.waypoints.at(-1) ?? flowEndpoint(value, edge.source)!.point, b = flowEndpoint(value, edge.target)!.point;
        editEdge({ waypoints: [...edge.waypoints, { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) }] });
      }}>Add bend</Button><Button disabled={!edge.waypoints.length} onClick={() => editEdge({ waypoints: [] })}>Auto route</Button></div>
    </>}
    {(node || edge) && <Button className="aui-flow-editor-delete" onClick={onDelete}>Delete {port ? "point" : node ? "node" : "connection"}</Button>}
    {node && <small>Deleting a node or point also removes its attached connections. Undo restores them.</small>}
  </aside>;
}
