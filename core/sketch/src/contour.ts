import { samplePath } from './curves';
import { polygonArea, pointInPolygon, distanceToSegment } from './geometry';
import type { Point, SketchPath } from './types';
/** Editable polygon offset; curved input is flattened at the caller's tolerance. Reject collapsed or crossing results. */
export function offsetContour(path: SketchPath, distance: number, tolerance = .25): SketchPath {
  if (!path.closed) throw new Error('Close the path before creating an offset contour.');
  if (!Number.isFinite(distance)) throw new Error('Enter a finite contour distance.');
  if (!distance) return path;
  const points = samplePath(path, tolerance).filter((p, i, all) => i === 0 || Math.hypot(p[0] - all[i - 1][0], p[1] - all[i - 1][1]) > 1e-9);
  const orientation = Math.sign(polygonArea(points));
  if (!orientation) throw new Error('The contour must enclose an area.');
  const result: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[(i - 1 + points.length) % points.length], p = points[i], b = points[(i + 1) % points.length];
    const l1 = Math.hypot(p[0] - a[0], p[1] - a[1]), l2 = Math.hypot(b[0] - p[0], b[1] - p[1]);
    if (!l1 || !l2) continue;
    const v: Point = [(p[0] - a[0]) / l1, (p[1] - a[1]) / l1], w: Point = [(b[0] - p[0]) / l2, (b[1] - p[1]) / l2];
    const first: Point = [p[0] + v[1] * distance * orientation, p[1] - v[0] * distance * orientation];
    const second: Point = [p[0] + w[1] * distance * orientation, p[1] - w[0] * distance * orientation];
    const det = v[0] * w[1] - v[1] * w[0];
    if (Math.abs(det) < 1e-10) { result.push(first); continue; }
    const t = ((second[0] - first[0]) * w[1] - (second[1] - first[1]) * w[0]) / det;
    const hit: Point = [first[0] + t * v[0], first[1] + t * v[1]];
    if (Math.hypot(hit[0] - p[0], hit[1] - p[1]) > Math.abs(distance) * 8) result.push(first, second); else result.push(hit);
  }
  if (result.length < 3 || Math.sign(polygonArea(result)) !== orientation) throw new Error('This offset collapses the contour. Use a smaller distance.');
  if (distance < 0 && result.some(p => !pointInPolygon(points, p) || points.some((a, i) => distanceToSegment(p, a, points[(i + 1) % points.length]) < Math.abs(distance) - tolerance))) throw new Error('This offset collapses the contour. Use a smaller distance.');
  // Crossing offsets require a region/Boolean kernel; never silently persist loops.
  for (let i = 0; i < result.length; i++) for (let j = i + 2; j < result.length; j++) {
    if (i === 0 && j === result.length - 1) continue;
    const a = result[i], b = result[(i + 1) % result.length], c = result[j], d = result[(j + 1) % result.length];
    const cross = (p: Point, q: Point, r: Point) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) throw new Error('This offset crosses itself. Use a smaller distance.');
  }
  return { points: result, closed: true };
}
