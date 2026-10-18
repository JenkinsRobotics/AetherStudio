import type { Point, SketchPath } from './types';
export function arcPath(a: Point, m: Point, b: Point) {
  const d =
    2 * (a[0] * (m[1] - b[1]) + m[0] * (b[1] - a[1]) + b[0] * (a[1] - m[1]));
  if (Math.abs(d) < 1e-8) return `L${b}`;
  const sq = (p: Point) => p[0] * p[0] + p[1] * p[1];
  const cx =
    (sq(a) * (m[1] - b[1]) + sq(m) * (b[1] - a[1]) + sq(b) * (a[1] - m[1])) / d;
  const cy =
    (sq(a) * (b[0] - m[0]) + sq(m) * (a[0] - b[0]) + sq(b) * (m[0] - a[0])) / d;
  const angle = (p: Point) => Math.atan2(p[1] - cy, p[0] - cx);
  const tau = 2 * Math.PI,
    delta = (u: number, v: number) => (v - u + tau) % tau;
  const sweep = delta(angle(a), angle(m)) < delta(angle(a), angle(b));
  const extent = sweep ? delta(angle(a), angle(b)) : delta(angle(b), angle(a));
  return `A${Math.hypot(a[0] - cx, a[1] - cy)} ${Math.hypot(a[0] - cx, a[1] - cy)} 0 ${extent > Math.PI ? 1 : 0} ${sweep ? 1 : 0} ${b}`;
}

export function pathData(path: SketchPath): string {
  if (!path.points.length) return '';
  let d = `M${path.points[0]}`;
  const count = path.closed ? path.points.length : path.points.length - 1;
  for (let i = 0; i < count; i++) {
    const end = path.points[(i + 1) % path.points.length], c = path.curves?.[i];
    d += c ? `C${c.c1} ${c.c2} ${end}` : `L${end}`;
  }
  return d + (path.closed ? 'Z' : '') + (path.subpaths ?? []).map(pathData).join('');
}
