import polygonClipping from 'polygon-clipping';
import type { MultiPolygon } from 'polygon-clipping';
import type { Point, SketchPath } from './types';
import { pathContours, compoundPath } from './compound';
import { samplePath } from './curves';
export type BooleanOperation = 'union' | 'difference' | 'intersection' | 'xor';
const area = (r: Point[]) => r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
/** Polygonized drawing regions; explicit caller-unit tolerance, never CAD exact geometry. */
export function regionPolygons(path: SketchPath, tolerance: number): MultiPolygon {
  if (!Number.isFinite(tolerance) || tolerance <= 0) throw Error('Use a positive curve tolerance.');
  let count = 0;
  const rings = pathContours(path).map(p => {
    if(p.points.length>12000)throw Error('Simplify this contour before combining shapes.');
    if (!p.closed) throw Error('Boolean operations require closed paths.');
    const points = samplePath(p, tolerance).filter((v, i, a) => !i || v[0] !== a[i - 1][0] || v[1] !== a[i - 1][1]);
    if (points.length > 1 && points[0][0] === points.at(-1)![0] && points[0][1] === points.at(-1)![1]) points.pop();
    count += points.length;
    if (count > 12000) throw Error('This Boolean is too detailed. Increase the curve tolerance.');
    if (points.length < 3 || points.some(v => v.some(n => !Number.isFinite(n) || Math.abs(n) > 1e7))) throw Error('A contour is invalid.');
    return points;
  });
  if (path.fillRule === 'evenodd') {
    const result = polygonClipping.xor([rings[0]], ...rings.slice(1).map(r => [r]));
    if (!result.length) throw Error('The contours enclose no filled area.');
    return result;
  }
  // Track disjoint nonzero winding strata, including overlapping opposite-winding rings.
  let strata = new Map<number, MultiPolygon>();
  for (const ring of rings) {
    const weight = area(ring) >= 0 ? 1 : -1, region = polygonClipping.union([ring]);
    const next = new Map<number, MultiPolygon>();
    const add = (winding: number, polygons: MultiPolygon) => {
      if (!winding || !polygons.length) return;
      next.set(winding, next.has(winding) ? polygonClipping.union(next.get(winding)!, polygons) : polygons);
    };
    let remaining = region;
    for (const [winding, old] of strata) {
      add(winding, polygonClipping.difference(old, region));
      add(winding + weight, polygonClipping.intersection(old, region));
      remaining = polygonClipping.difference(remaining, old);
    }
    add(weight, remaining); strata = next;
  }
  const values = [...strata.values()];
  const result = values.length ? polygonClipping.union(values[0], ...values.slice(1)) : [];

  if (!result.length) throw Error('The contours enclose no filled area.');
  return result;
}
export function booleanPaths(paths: SketchPath[], operation: BooleanOperation, tolerance: number): SketchPath | null {
  if (paths.length < 2) throw Error('Select at least two closed shapes.');
  if(paths.length>64 || paths.reduce((n,p)=>n+pathContours(p).reduce((sum,c)=>sum+c.points.length,0),0)>12000)throw Error('Combine a smaller selection of shapes.');
  const regions = paths.map(p => regionPolygons(p, tolerance));
  const result = polygonClipping[operation](regions[0], ...regions.slice(1));
  const contours = result.flatMap(polygon => polygon.map(ring => ({ points: ring.slice(0, -1) as Point[], closed: true })));
  return contours.length ? compoundPath(contours, 'evenodd') : null;
}
