import { pathContours } from './compound';
import type { Point, SketchPath } from './types';
import { lerp, splitCurve } from './curves';
import { pathBounds } from './bounds';
export interface SnapTarget { point: Point; label?: string }
export interface SnapGuide { from: Point; to: Point; label: string }
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** Stable ties prefer the first target. Adapters may order by product priority. */
export function nearestPoint<T extends SnapTarget>(point: Point, targets: readonly T[], tolerance: number): T | undefined {
  let nearest: T | undefined, best = tolerance;
  for (const target of targets) {
    const d = distance(point, target.point);
    if (d <= tolerance && (!nearest || d < best)) { nearest = target; best = d; }
  }
  return nearest;
}
export function nearestAxis<T extends SnapTarget>(point: Point, targets: readonly T[], tolerance: number, axis: 0 | 1): T | undefined {
  let nearest: T | undefined, best = tolerance, radial = Infinity;
  for (const target of targets) {
    const d = Math.abs(point[axis] - target.point[axis]), r = distance(point, target.point);
    if (d <= tolerance && (!nearest || d < best || (d === best && r < radial))) { nearest = target; best = d; radial = r; }
  }
  return nearest;
}
/** Caller converts its screen tolerance into document units, once. */
export function snapPoint(point: Point, targets: readonly SnapTarget[], options: { tolerance: number; gridStep?: number; align?: boolean; bypass?: boolean }) {
  if (options.bypass) return { point, guides: [] as SnapGuide[] };
  const nearest = nearestPoint(point, targets, options.tolerance);
  if (nearest) return { point: [...nearest.point] as Point, guides: [{ from: nearest.point, to: nearest.point, label: nearest.label ?? 'Point' }] };
  const result: Point = [...point], guides: SnapGuide[] = [];
  for (const axis of [0, 1] as const) {
    const target = options.align === false ? undefined : nearestAxis(point, targets, options.tolerance, axis);
    if (target) {
      result[axis] = target.point[axis];
      guides.push({ from: target.point, to: result, label: axis === 0 ? 'Vertical' : 'Horizontal' });
    } else if (options.gridStep && options.gridStep > 0) {
      const value = Math.round(point[axis] / options.gridStep) * options.gridStep;
      if (Math.abs(value - point[axis]) <= options.tolerance) { result[axis] = value; guides.push({ from: result, to: result, label: 'Grid' }); }
    }
  }
  return { point: result, guides };
}
export function pathSnapTargets(path: SketchPath): SnapTarget[] {
  if (path.subpaths?.length) return pathContours(path).flatMap(pathSnapTargets);
  const b = pathBounds([path]);
  const targets: SnapTarget[] = path.points.map(point => ({ point, label: 'Anchor' }));
  const count = path.closed ? path.points.length : path.points.length - 1;
  for (let i = 0; i < count; i++) {
    const a = path.points[i], end = path.points[(i + 1) % path.points.length], c = path.curves?.[i];
    targets.push({ point: c ? splitCurve(a, c, end, .5).point : lerp(a, end, .5), label: 'Midpoint' });
  }
  if (b) targets.push({ point: [b.x + b.width / 2, b.y + b.height / 2], label: 'Center' });
  return targets;
}
export function constrainAngle(origin: Point, point: Point, stepRadians = Math.PI / 4): Point {
  const dx = point[0] - origin[0], dy = point[1] - origin[1], length = Math.hypot(dx, dy);
  const angle = Math.round(Math.atan2(dy, dx) / stepRadians) * stepRadians;
  return [origin[0] + Math.cos(angle) * length, origin[1] + Math.sin(angle) * length];
}
