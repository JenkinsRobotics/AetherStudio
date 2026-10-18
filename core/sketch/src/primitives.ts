import type { Point, SketchPath } from './types';
/** Four retained cubic arcs (standard kappa approximation; not an analytic CAD conic). */
export function ellipsePath(a: Point, b: Point): SketchPath {
  const x = (a[0] + b[0]) / 2, y = (a[1] + b[1]) / 2, rx = Math.abs(b[0] - a[0]) / 2, ry = Math.abs(b[1] - a[1]) / 2, k = 4 * (Math.sqrt(2) - 1) / 3;
  return { closed: true, points: [[x + rx, y], [x, y + ry], [x - rx, y], [x, y - ry]], nodeModes: ['smooth', 'smooth', 'smooth', 'smooth'], curves: [
    { c1: [x + rx, y + k * ry], c2: [x + k * rx, y + ry] },
    { c1: [x - k * rx, y + ry], c2: [x - rx, y + k * ry] },
    { c1: [x - rx, y - k * ry], c2: [x - k * rx, y - ry] },
    { c1: [x + k * rx, y - ry], c2: [x + rx, y - k * ry] },
  ] };
}
