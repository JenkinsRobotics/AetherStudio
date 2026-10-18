import type { CubicControls, NodeMode, Point, SketchPath } from './types';
import { lerp } from './curves';
const controls = (path: SketchPath) => path.points.map((_, i) => path.curves?.[i] ?? null);
function straightControls(path: SketchPath, edge: number): CubicControls | null {
  const a = path.points[edge], b = path.points[(edge + 1) % path.points.length];
  return !a || !b || (!path.closed && edge === path.points.length - 1) ? null : { c1: lerp(a, b, 1 / 3), c2: lerp(a, b, 2 / 3) };
}
export function setPathEdgeCurve(path: SketchPath, edge: number, curved: boolean): SketchPath {
  const curves = controls(path); if (!straightControls(path, edge)) return path;
  curves[edge] = curved ? curves[edge] ?? straightControls(path, edge) : null;
  return { ...path, curves, ...(!curved ? { nodeModes: path.points.map((_, i) => i === edge || i === (edge + 1) % path.points.length ? 'corner' : path.nodeModes?.[i] ?? 'corner') } : {}) };
}
/** Smooth preserves the other handle's length; symmetric also couples length. Alt breaks coupling. */
export function movePathControl(path: SketchPath, edge: number, control: 'c1' | 'c2', point: Point, independent = false): SketchPath {
  const curves = controls(path), c = curves[edge]; if (!c) return path;
  const count = path.points.length, node = control === 'c1' ? edge : (edge + 1) % count;
  const modes = path.points.map((_, i) => path.nodeModes?.[i] ?? 'corner');
  if (independent) modes[node] = 'corner';
  curves[edge] = { ...c, [control]: point };
  const otherEdge = control === 'c1' ? (node - 1 + count) % count : node, otherControl = control === 'c1' ? 'c2' : 'c1';
  const other = curves[otherEdge], anchor = path.points[node], mode = modes[node];
  if (mode !== 'corner' && other && (path.closed || (node > 0 && node < count - 1))) {
    const dx = point[0] - anchor[0], dy = point[1] - anchor[1], length = Math.hypot(dx, dy);
    const distance = mode === 'symmetric' ? length : Math.hypot(other[otherControl][0] - anchor[0], other[otherControl][1] - anchor[1]);
    if (length > 0) curves[otherEdge] = { ...other, [otherControl]: [anchor[0] - dx / length * distance, anchor[1] - dy / length * distance] };
    else if (mode === 'symmetric') curves[otherEdge] = { ...other, [otherControl]: [...anchor] };
  }
  return { ...path, curves, nodeModes: modes };
}
export function setNodeMode(path: SketchPath, node: number, mode: NodeMode): SketchPath {
  if (!path.points[node]) return path;
  const count = path.points.length, prev = (node - 1 + count) % count, next = (node + 1) % count;
  const nodeModes = path.points.map((_, i) => i === node ? mode : path.nodeModes?.[i] ?? 'corner');
  if (mode === 'corner') return { ...path, nodeModes };
  let nextPath = setPathEdgeCurve(setPathEdgeCurve(path, prev, true), node, true);
  const curves = controls(nextPath), anchor = path.points[node];
  // Direction from neighboring anchors creates usable handles even on a polygon.
  const from = !path.closed && node === 0 ? anchor : path.points[prev];
  const to = !path.closed && node === count - 1 ? anchor : path.points[next];
  let dx = to[0] - from[0], dy = to[1] - from[1], length = Math.hypot(dx, dy);
  if (!length) { dx = 1; dy = 0; length = 1; }
  const incoming = Math.hypot(anchor[0] - from[0], anchor[1] - from[1]) / 3;
  const outgoing = Math.hypot(to[0] - anchor[0], to[1] - anchor[1]) / 3;
  const a = mode === 'symmetric' ? Math.min(incoming || outgoing, outgoing || incoming) : incoming;
  const b = mode === 'symmetric' ? a : outgoing;
  if (curves[prev] && (path.closed || node > 0)) curves[prev] = { ...curves[prev]!, c2: [anchor[0] - dx / length * a, anchor[1] - dy / length * a] };
  if (curves[node] && (path.closed || node < count - 1)) curves[node] = { ...curves[node]!, c1: [anchor[0] + dx / length * b, anchor[1] + dy / length * b] };
  return { ...nextPath, curves, nodeModes };
}
export function reversePath(path: SketchPath): SketchPath {
  const n = path.points.length;
  return { ...path, points: [...path.points].reverse(), nodeModes: path.nodeModes && [...path.nodeModes].reverse(), curves: path.points.map((_, i) => {
    if (!path.closed && i === n - 1) return null;
    const c = path.curves?.[(n - 2 - i + n) % n]; return c ? { c1: c.c2, c2: c.c1 } : null;
  }) };
}
/** Closed outlines open at the selected node, preserving every edge with a duplicate endpoint. */
export function breakPath(path: SketchPath, node: number): SketchPath[] {
  if (!path.points[node]) return [path];
  const modes = path.points.map((_, i) => path.nodeModes?.[i] ?? 'corner'), cs = controls(path);
  if (path.closed) return [{ ...path, closed: false, points: [...path.points.slice(node), ...path.points.slice(0, node + 1)], curves: [...cs.slice(node), ...cs.slice(0, node), null], nodeModes: [...modes.slice(node), ...modes.slice(0, node + 1)] }];
  if (node === 0 || node === path.points.length - 1) return [path];
  return [ { ...path, points: path.points.slice(0, node + 1), curves: [...cs.slice(0, node), null], nodeModes: modes.slice(0, node + 1) },
    { ...path, points: path.points.slice(node), curves: cs.slice(node), nodeModes: modes.slice(node) } ];
}
/** Joins the nearest pair of endpoints, retaining both authored curves and a straight bridge if needed. */
export function joinPaths(a: SketchPath, b: SketchPath): SketchPath | null {
  if (a.closed || b.closed || !a.points.length || !b.points.length) return null;
  const candidates = [[a, b], [reversePath(a), b], [a, reversePath(b)], [reversePath(a), reversePath(b)]];
  candidates.sort(([x, y], [u, v]) => Math.hypot(x.points.at(-1)![0] - y.points[0][0], x.points.at(-1)![1] - y.points[0][1]) - Math.hypot(u.points.at(-1)![0] - v.points[0][0], u.points.at(-1)![1] - v.points[0][1]));
  const [x, y] = candidates[0], same = x.points.at(-1)!.every((v, i) => v === y.points[0][i]);
  const trim = same ? 1 : 0, xcount = x.points.length - trim;
  return { ...x, points: [...x.points, ...y.points.slice(trim)], curves: [...controls(x).slice(0, xcount), ...controls(y)], nodeModes: [...x.points.slice(0, xcount).map((_, i) => x.nodeModes?.[i] ?? 'corner'), ...y.points.map((_, i) => y.nodeModes?.[i] ?? 'corner')] };
}
