import type { Point, SketchPath } from './types';
import { nearestPathEdge, splitCurve, lerp } from './curves';
import { pathContours } from './compound';
const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0];
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
function samples(path: SketchPath) {
  const segments: { a: Point; b: Point; t0: number; t1: number }[] = [];
  const count = path.closed ? path.points.length : path.points.length - 1;
  for (let edge = 0; edge < count; edge++) {
    const a = path.points[edge], b = path.points[(edge + 1) % path.points.length], c = path.curves?.[edge], n = c ? 96 : 1;
    let previous = a;
    for (let i = 1; i <= n; i++) { const p = c ? splitCurve(a, c, b, i / n).point : b; segments.push({ a: previous, b: p, t0: edge + (i - 1) / n, t1: edge + i / n }); previous = p; }
  }
  return segments;
}
/** Intersection parameters are sampled for cubics; retained output curves are split exactly at those parameters. */
export function pathIntersections(path: SketchPath, cutters: readonly SketchPath[]): number[] {
  const result: number[] = [];
  const own = samples(path), others = cutters.flatMap(pathContours).flatMap(samples);
  for (const a of own) for (const b of others) {
    const r = sub(a.b, a.a), s = sub(b.b, b.a), d = cross(r, s); if (Math.abs(d) < 1e-12) continue;
    const q = sub(b.a, a.a), t = cross(q, s) / d, u = cross(q, r) / d;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) result.push(a.t0 + (a.t1 - a.t0) * t);
  }
  return result.sort((a, b) => a - b).filter((t, i, values) => i === 0 || t - values[i - 1] > 1e-6);
}
export function slicePath(path: SketchPath, start: number, end: number): SketchPath | null {
  if (end - start < 1e-8) return null;
  const points: Point[] = [], curves: NonNullable<SketchPath['curves']> = [];
  const n = path.points.length;
  for (let index = Math.floor(start); index < Math.ceil(end); index++) {
    const edge = ((index % n) + n) % n, a = path.points[edge], b = path.points[(edge + 1) % n];
    let c = path.curves?.[edge], from = a, to = b;
    const t0 = Math.max(0, start - index), t1 = Math.min(1, end - index);
    if (c) {
      if (t0 > 0) { const split = splitCurve(from, c, to, t0); from = split.point; c = split.right; }
      if (t1 < 1) { const split = splitCurve(from, c, to, (t1 - t0) / (1 - t0)); to = split.point; c = split.left; }
    } else { from = lerp(a, b, t0); to = lerp(a, b, t1); }
    if (!points.length) points.push(from);
    points.push(to); curves.push(c ?? null);
  }
  curves.push(null);
  return { points, curves, closed: false, nodeModes: points.map((_, i) => {
    if (i === 0 || i === points.length - 1) return 'corner';
    const mode = path.nodeModes?.[(Math.floor(start) + i) % n] ?? 'corner';
    return mode === 'symmetric' && (i === 1 || i === points.length - 2) ? 'smooth' : mode;
  }) };
}
/** Remove the section between adjacent intersections, or the clicked edge when unbounded. */
export function trimPath(path: SketchPath, at: Point, cutters: readonly SketchPath[], tolerance: number): SketchPath[] | null {
  const hit = nearestPathEdge(path, at, tolerance); if (!hit) return null;
  const count = path.closed ? path.points.length : path.points.length - 1, t = hit.edge + hit.fraction;
  const cuts = pathIntersections(path, cutters).map(v => path.closed && Math.abs(v - count) < 1e-7 ? 0 : v)
    .filter(v => path.closed || (v > 1e-7 && v < count - 1e-7))
    .sort((a, b) => a - b).filter((v, i, values) => !i || v - values[i - 1] > 1e-6);
  let start = [...cuts].reverse().find(v => v < t), end = cuts.find(v => v > t);
  if (!cuts.length || (path.closed && cuts.length < 2)) { start = hit.edge; end = hit.edge + 1; }
  if (path.closed) {
    start ??= cuts.at(-1)! - count; end ??= cuts[0] + count;
    const kept = slicePath(path, end, start + count);
    return kept ? [kept] : [];
  }
  return [slicePath(path, 0, start ?? 0), slicePath(path, end ?? count, count)].filter((p): p is SketchPath => !!p);
}
