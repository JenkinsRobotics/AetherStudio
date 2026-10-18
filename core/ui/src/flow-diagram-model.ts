import type { FlowDiagramRoute, FlowDiagramTone } from "./FlowDiagram";

export interface FlowPoint { x: number; y: number }
export type FlowPortSide = "left" | "right" | "top" | "bottom";
export interface FlowPort {
  id: string;
  label: string;
  side: FlowPortSide;
  /** Position along the side, from 0 to 1. */
  offset: number;
  direction: "input" | "output";
}
export interface FlowNode extends FlowPoint {
  id: string;
  label: string;
  detail: string;
  notes: string;
  width: number;
  height: number;
  kind: "source" | "module" | "gate" | "processor";
  tone: FlowDiagramTone;
  ports: FlowPort[];
}
export interface FlowEndpoint { nodeId: string; portId: string }
export interface FlowConnection {
  id: string;
  label: string;
  notes: string;
  source: FlowEndpoint;
  target: FlowEndpoint;
  tone: FlowDiagramTone;
  dashed: boolean;
  /** Optional authored route points; empty means automatic routing. */
  waypoints: FlowPoint[];
}
/** Unit-neutral diagram geometry. Product execution and transport are not represented. */
export interface FlowDocument {
  version: 1;
  width: number;
  height: number;
  nodes: FlowNode[];
  connections: FlowConnection[];
}
export type FlowSelection = { kind: "node"; id: string } | { kind: "port"; nodeId: string; id: string } | { kind: "connection"; id: string };
export const FLOW_TONES: readonly FlowDiagramTone[] = ["green", "violet", "red", "neutral", "teal", "blue", "amber"];
export const FLOW_SIDES: readonly FlowPortSide[] = ["left", "right", "top", "bottom"];
export const flowClamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function flowPortPoint(node: FlowNode, port: FlowPort): FlowPoint {
  const { x, y, width, height } = node;
  switch (port.side) {
    case "left": return { x, y: y + height * port.offset };
    case "right": return { x: x + width, y: y + height * port.offset };
    case "top": return { x: x + width * port.offset, y };
    case "bottom": return { x: x + width * port.offset, y: y + height };
  }
}

export function flowEndpoint(document: FlowDocument, endpoint: FlowEndpoint) {
  const node = document.nodes.find(item => item.id === endpoint.nodeId);
  const port = node?.ports.find(item => item.id === endpoint.portId);
  return node && port ? { node, port, point: flowPortPoint(node, port) } : undefined;
}

export function flowConnectionError(document: FlowDocument, source: FlowEndpoint, target: FlowEndpoint, ignoreId?: string): string | null {
  const from = flowEndpoint(document, source), to = flowEndpoint(document, target);
  if (!from || !to) return "Choose existing connection points.";
  if (from.port.direction !== "output" || to.port.direction !== "input") return "Connect an output to an input.";
  if (source.nodeId === target.nodeId) return "Choose an input on another node.";
  if (document.connections.some(edge => edge.id !== ignoreId && edge.source.nodeId === source.nodeId && edge.source.portId === source.portId && edge.target.nodeId === target.nodeId && edge.target.portId === target.portId)) return "These points are already connected.";
  return null;
}

/** Rounded polyline, preserving authored bends and exact endpoint positions. */
export function flowRoundedPath(points: readonly FlowPoint[], radius = 18): string {
  const distinct = points.filter((point, index) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
  if (distinct.length === 0) return "";
  let path = `M${distinct[0].x} ${distinct[0].y}`;
  for (let i = 1; i < distinct.length - 1; i++) {
    const a = distinct[i - 1], b = distinct[i], c = distinct[i + 1];
    const incoming = Math.hypot(b.x - a.x, b.y - a.y), outgoing = Math.hypot(c.x - b.x, c.y - b.y);
    const corner = Math.min(radius, incoming / 2, outgoing / 2);
    const p = { x: b.x + (a.x - b.x) * corner / incoming, y: b.y + (a.y - b.y) * corner / incoming };
    const q = { x: b.x + (c.x - b.x) * corner / outgoing, y: b.y + (c.y - b.y) * corner / outgoing };
    path += `L${p.x} ${p.y}Q${b.x} ${b.y} ${q.x} ${q.y}`;
  }
  const last = distinct[distinct.length - 1];
  return distinct.length > 1 ? `${path}L${last.x} ${last.y}` : path;
}

const normals: Record<FlowPortSide, FlowPoint> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 } };
export function flowConnectionPath(document: FlowDocument, edge: FlowConnection): string {
  const from = flowEndpoint(document, edge.source), to = flowEndpoint(document, edge.target);
  if (!from || !to) return "";
  const a = from.point, b = to.point;
  if (edge.waypoints.length) return flowRoundedPath([a, ...edge.waypoints, b]);
  const n1 = from.node.kind === "source" && from.port.side === "left" ? normals.right : normals[from.port.side], n2 = normals[to.port.side];
  if (n1.x === 1 && n2.x === -1 && b.x - a.x > 60) {
    const diagonal = Math.min(Math.abs(b.y - a.y), (b.x - a.x) / 2);
    const bend = a.x + (b.x - a.x - diagonal) * .7;
    return flowRoundedPath([a, { x: bend, y: a.y }, { x: bend + diagonal, y: b.y }, b]);
  }
  const p = { x: a.x + n1.x * 24, y: a.y + n1.y * 24 }, q = { x: b.x + n2.x * 24, y: b.y + n2.y * 24 };
  const mid = n1.x ? [{ x: (p.x + q.x) / 2, y: p.y }, { x: (p.x + q.x) / 2, y: q.y }] : [{ x: p.x, y: (p.y + q.y) / 2 }, { x: q.x, y: (p.y + q.y) / 2 }];
  return flowRoundedPath([a, p, ...mid, q, b]);
}

export function flowRoutes(document: FlowDocument): FlowDiagramRoute[] {
  return document.connections.map(edge => ({ id: edge.id, path: flowConnectionPath(document, edge), tone: edge.tone, dashed: edge.dashed, label: edge.label }));
}

export function flowNodeBounds(document: FlowDocument, node: FlowNode) {
  const roomX = document.width - node.width, roomY = document.height - node.height;
  const minX = Math.min(12, roomX / 2), minY = Math.min(28, roomY / 2);
  return { minX, maxX: Math.max(minX, roomX - 12), minY, maxY: Math.max(minY, roomY - 12) };
}

export function flowMoveNode(document: FlowDocument, id: string, point: FlowPoint): FlowDocument {
  return { ...document, nodes: document.nodes.map(node => {
    if (node.id !== id) return node;
    const bounds = flowNodeBounds(document, node);
    return { ...node, x: flowClamp(point.x, bounds.minX, bounds.maxX), y: flowClamp(point.y, bounds.minY, bounds.maxY) };
  }) };
}

export function flowMovePort(document: FlowDocument, nodeId: string, id: string, point: FlowPoint): FlowDocument {
  return { ...document, nodes: document.nodes.map(node => {
    if (node.id !== nodeId) return node;
    const distances = [Math.abs(point.x - node.x), Math.abs(point.x - node.x - node.width), Math.abs(point.y - node.y), Math.abs(point.y - node.y - node.height)];
    const side = FLOW_SIDES[distances.indexOf(Math.min(...distances))];
    const offset = flowClamp(side === "left" || side === "right" ? (point.y - node.y) / node.height : (point.x - node.x) / node.width, 0, 1);
    return { ...node, ports: node.ports.map(port => port.id === id ? { ...port, side, offset } : port) };
  }) };
}

export function flowDelete(document: FlowDocument, selection: FlowSelection): FlowDocument {
  if (selection.kind === "connection") return { ...document, connections: document.connections.filter(edge => edge.id !== selection.id) };
  const nodeId = selection.kind === "node" ? selection.id : selection.nodeId;
  const removed = (end: FlowEndpoint) => end.nodeId === nodeId && (selection.kind === "node" || end.portId === selection.id);
  return { ...document,
    nodes: selection.kind === "node" ? document.nodes.filter(node => node.id !== nodeId) : document.nodes.map(node => node.id === nodeId ? { ...node, ports: node.ports.filter(port => port.id !== selection.id) } : node),
    connections: document.connections.filter(edge => !removed(edge.source) && !removed(edge.target)),
  };
}

/** Validate imported data before it becomes interactive SVG or a saved draft. */
export function parseFlowDocument(text: string): FlowDocument {
  if (text.length > 1_000_000) throw new Error("Diagram files must be smaller than 1 MB.");
  const value: unknown = JSON.parse(text);
  const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
  const str = (v: unknown, max = 160) => typeof v === "string" && v.length <= max;
  const num = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  const fail = () => { throw new Error("Invalid flow diagram. Check nodes, ports and connection references."); };
  if (!record(value) || value.version !== 1 || !num(value.width, 400, 5000) || !num(value.height, 300, 5000) || !Array.isArray(value.nodes) || value.nodes.length > 100 || !Array.isArray(value.connections) || value.connections.length > 400) return fail();
  const ids = new Set<string>();
  for (const node of value.nodes) {
    if (!record(node) || !str(node.id) || !node.id || ids.has(node.id as string) || !str(node.label) || !str(node.detail) || !str(node.notes, 4000) || !["source", "module", "gate", "processor"].includes(node.kind as string) || !FLOW_TONES.includes(node.tone as FlowDiagramTone) || !num(node.width, 16, value.width) || !num(node.height, 20, value.height) || !num(node.x, 0, value.width - node.width) || !num(node.y, 0, value.height - node.height) || !Array.isArray(node.ports) || node.ports.length > 40) return fail();
    ids.add(node.id as string);
    if (node.kind === "processor" && (node.width < 120 || node.height < 96)) return fail();
    const ports = new Set<string>();
    for (const port of node.ports) {
      if (!record(port) || !str(port.id) || !port.id || ports.has(port.id as string) || !str(port.label) || !FLOW_SIDES.includes(port.side as FlowPortSide) || !num(port.offset, 0, 1) || !["input", "output"].includes(port.direction as string)) return fail();
      ports.add(port.id as string);
    }
  }
  ids.clear();
  const document = value as unknown as FlowDocument;
  for (const edge of value.connections) {
    if (!record(edge) || !str(edge.id) || !edge.id || ids.has(edge.id as string) || !str(edge.label) || !str(edge.notes, 4000) || !FLOW_TONES.includes(edge.tone as FlowDiagramTone) || typeof edge.dashed !== "boolean" || !record(edge.source) || !record(edge.target) || !str(edge.source.nodeId) || !str(edge.source.portId) || !str(edge.target.nodeId) || !str(edge.target.portId) || !Array.isArray(edge.waypoints) || edge.waypoints.length > 20) return fail();
    if (edge.waypoints.some(p => !record(p) || !num(p.x, 0, value.width as number) || !num(p.y, 0, value.height as number))) return fail();
    ids.add(edge.id as string);
  }
  for (const edge of document.connections) if (flowConnectionError(document, edge.source, edge.target, edge.id)) return fail();
  return document;
}
