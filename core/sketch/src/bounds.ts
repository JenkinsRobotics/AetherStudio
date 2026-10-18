import { pathContours } from './compound';
import type { Point, SketchPath } from './types';
import { splitCurve } from './curves';
export interface Bounds { x: number; y: number; width: number; height: number }
/** Cubic extrema, not control-polygon or flattened bounds. */
export function pathBounds(paths: readonly SketchPath[]): Bounds | null {
  const points: Point[] = [];
  for (const path of paths.flatMap(pathContours)) {
    points.push(...path.points);
    const count = path.closed ? path.points.length : path.points.length - 1;
    for (let i = 0; i < count; i++) {
      const c = path.curves?.[i]; if (!c) continue;
      const a = path.points[i], b = path.points[(i + 1) % path.points.length];
      for (const axis of [0, 1] as const) {
        const qa = -a[axis] + 3 * c.c1[axis] - 3 * c.c2[axis] + b[axis], qb = 2 * (a[axis] - 2 * c.c1[axis] + c.c2[axis]), qc = c.c1[axis] - a[axis];
        const discriminant = qb * qb - 4 * qa * qc;
        const roots = Math.abs(qa) < 1e-14 ? (Math.abs(qb) < 1e-14 ? [] : [-qc / qb]) : discriminant < 0 ? [] : [(-qb + Math.sqrt(discriminant)) / (2 * qa), (-qb - Math.sqrt(discriminant)) / (2 * qa)];
        for (const t of roots) if (t > 0 && t < 1) points.push(splitCurve(a, c, b, t).point);
      }
    }
  }
  if (!points.length) return null;
  let x = Infinity, y = Infinity, right = -Infinity, bottom = -Infinity;
  for (const p of points) { x = Math.min(x, p[0]); y = Math.min(y, p[1]); right = Math.max(right, p[0]); bottom = Math.max(bottom, p[1]); }
  return { x, y, width: right - x, height: bottom - y };
}
export const boundsContain = (outer: Bounds, inner: Bounds) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
export const resizePoint = (p: Point, before: Bounds, after: Bounds): Point => [after.x + (before.width ? (p[0] - before.x) / before.width * after.width : 0), after.y + (before.height ? (p[1] - before.y) / before.height * after.height : 0)];
export function rotatePoint(point: Point, center: Point, radians: number): Point {
  const x = point[0] - center[0], y = point[1] - center[1], c = Math.cos(radians), s = Math.sin(radians);
  return [center[0] + c * x - s * y, center[1] + s * x + c * y];
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export const RESIZE_HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
export function handlePoint(b: Bounds, h: ResizeHandle): Point {
  return [b.x + b.width * (h.includes('w') ? 0 : h.includes('e') ? 1 : .5), b.y + b.height * (h.includes('n') ? 0 : h.includes('s') ? 1 : .5)];
}
export function resizeBounds(b: Bounds, h: ResizeHandle, delta: Point, aspect: boolean, minimumSize = 1e-9): Bounds {
  let width = Math.max(minimumSize, b.width + (h.includes('e') ? delta[0] : h.includes('w') ? -delta[0] : 0));
  let height = Math.max(minimumSize, b.height + (h.includes('s') ? delta[1] : h.includes('n') ? -delta[1] : 0));
  if (aspect && b.width > 0 && b.height > 0) {
    const horizontal = h === 'e' || h === 'w' || (h.length === 2 && Math.abs(width / b.width - 1) >= Math.abs(height / b.height - 1));
    const ratio = Math.max(minimumSize / Math.min(b.width, b.height), horizontal ? width / b.width : height / b.height);
    width = b.width * ratio; height = b.height * ratio;
  }
  return { x: b.x + (h.includes('w') ? b.width - width : h === 'n' || h === 's' ? (b.width - width) / 2 : 0),
    y: b.y + (h.includes('n') ? b.height - height : h === 'e' || h === 'w' ? (b.height - height) / 2 : 0), width, height };
}
