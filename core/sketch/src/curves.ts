import type { CubicControls, Point, SketchPath } from './types';

export function samplePath(path: SketchPath, tolerance = .25): Point[] {
  const { points, curves, closed } = path;
  if (!curves?.some(Boolean)) return points;
  const result: Point[] = [];
  const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const flatten = (a: Point, b: Point, c: Point, d: Point, depth: number) => {
    const length = Math.hypot(d[0] - a[0], d[1] - a[1]);
    const deviation = (p: Point) => length < 1e-8 ? Math.hypot(p[0] - a[0], p[1] - a[1])
      : Math.abs((d[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (d[1] - a[1])) / length;
    const excess = Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1]) + Math.hypot(d[0] - c[0], d[1] - c[1]) - length;
    if (depth >= 10 || (excess < tolerance && Math.max(deviation(b), deviation(c)) < tolerance)) { result.push(a); return; }
    const ab = mid(a, b), bc = mid(b, c), cd = mid(c, d), abc = mid(ab, bc), bcd = mid(bc, cd), center = mid(abc, bcd);
    flatten(a, ab, abc, center, depth + 1); flatten(center, bcd, cd, d, depth + 1);
  };
  points.slice(0, closed ? points.length : Math.max(0, points.length - 1)).forEach((a, i) => {
    const c = curves[i], b = points[(i + 1) % points.length];
    if (c) flatten(a, c.c1, c.c2, b, 0); else result.push(a);
  });
  if (!closed && points.length) result.push(points[points.length - 1]);
  return result;
}
export const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export function splitCurve(a: Point, curve: CubicControls, b: Point, t: number) {
  const ab = lerp(a, curve.c1, t), bc = lerp(curve.c1, curve.c2, t), cd = lerp(curve.c2, b, t);
  const left = lerp(ab, bc, t), right = lerp(bc, cd, t);
  return { point: lerp(left, right, t), left: { c1: ab, c2: left }, right: { c1: right, c2: cd } };
}

export function nearestPathEdge(path: SketchPath, at: Point, tolerance: number): { edge: number; fraction: number } | null {
  const points = path.points;
  let best: { edge: number; fraction: number } | null = null, distance = tolerance;
  points.slice(0, path.closed ? points.length : Math.max(0, points.length - 1)).forEach((a, edge) => {
    const b = points[(edge + 1) % points.length], curve = path.curves?.[edge];
    const count = curve ? 128 : 1;
    let previous = a;
    for (let i = 1; i <= count; i++) {
      const t = i / count, p = curve ? splitCurve(a, curve, b, t).point : b;
      const dx = p[0] - previous[0], dy = p[1] - previous[1], len = dx * dx + dy * dy;
      const along = len ? Math.max(0, Math.min(1, ((at[0] - previous[0]) * dx + (at[1] - previous[1]) * dy) / len)) : 0;
      const fraction = (i - 1 + along) / count, gap = Math.hypot(at[0] - previous[0] - dx * along, at[1] - previous[1] - dy * along);
      if (fraction > .001 && fraction < .999 && gap <= distance) { distance = gap; best = { edge, fraction }; }
      previous = p;
    }
  });
  return best;
}
