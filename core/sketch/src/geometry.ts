import type { Point } from "./types";

/**
 * Shared shape construction and picking.
 *
 * Coordinates retain their input precision unless a quantization step is supplied. These
 * are the pure conversions from a gesture to that polygon, kept away from the
 * pointer handling so they can be tested exactly.
 */

/** Axis-aligned rectangle from two opposite corners, in any order. */
export function rectPolygon(a: Point, b: Point, coordinateStep = 0): Point[] {
  const left = Math.min(a[0], b[0]);
  const right = Math.max(a[0], b[0]);
  const top = Math.min(a[1], b[1]);
  const bottom = Math.max(a[1], b[1]);
  const corners: Point[] = [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ];
  return corners.map(p => quantize(p, coordinateStep));
}

/**
 * An ellipse inscribed in the rectangle between two corners, as a polygon.
 * A clip-path cannot take a true ellipse per-surface, and at projection
 * distances 48 segments are indistinguishable from a curve.
 */
export function ellipsePolygon(a: Point, b: Point, segments = 48, coordinateStep = 0): Point[] {
  const cx = (a[0] + b[0]) / 2;
  const cy = (a[1] + b[1]) / 2;
  const rx = Math.abs(a[0] - b[0]) / 2;
  const ry = Math.abs(a[1] - b[1]) / 2;
  const n = Math.max(3, Math.floor(segments));
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return quantize([cx + rx * Math.cos(t), cy + ry * Math.sin(t)], coordinateStep);
  });
}

/** A regular n-gon centred on `centre`, with one vertex at `edge`. */
export function regularPolygon(centre: Point, edge: Point, sides: number, coordinateStep = 0): Point[] {
  const n = Math.max(3, Math.floor(sides));
  const r = Math.hypot(edge[0] - centre[0], edge[1] - centre[1]);
  const start = Math.atan2(edge[1] - centre[1], edge[0] - centre[0]);
  return Array.from({ length: n }, (_, i) => {
    const t = start + (i / n) * Math.PI * 2;
    return quantize([centre[0] + r * Math.cos(t), centre[1] + r * Math.sin(t)], coordinateStep);
  });
}

/** Change a regular polygon's sides without moving its centre or rotating it. */
export function resizeRegularPolygon(points: Point[], sides: number, coordinateStep = 0): Point[] {
  if (points.length < 3) return points;
  const centre: Point = [
    points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length,
  ];
  const radius = points.reduce((sum, point) => sum + Math.hypot(point[0] - centre[0], point[1] - centre[1]), 0) / points.length;
  const angle = Math.atan2(points[0][1] - centre[1], points[0][0] - centre[0]);
  return regularPolygon(centre, [centre[0] + radius * Math.cos(angle), centre[1] + radius * Math.sin(angle)],
    Math.max(3, Math.min(64, Math.floor(sides))), coordinateStep);
}

/**
 * Ramer–Douglas–Peucker. A freehand stroke arrives as hundreds of points a
 * few pixels apart; the mask wants the dozen that describe the shape.
 */
export function simplify(points: Point[], tolerance: number, coordinateStep = 0): Point[] {
  if (points.length <= 2 || tolerance <= 0) return points.map(p => quantize(p, coordinateStep));
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let farthest = 0;
    let index = -1;
    for (let i = first + 1; i < last; i += 1) {
      const d = distanceToSegment(points[i], points[first], points[last]);
      if (d > farthest) {
        farthest = d;
        index = i;
      }
    }
    if (index >= 0 && farthest > tolerance) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]).map(p => quantize(p, coordinateStep));
}

/** True when a new point lands close enough to the first to close the shape. */
export function closesOnStart(points: Point[], candidate: Point, tolerance: number): boolean {
  if (points.length < 3) return false;
  return Math.hypot(candidate[0] - points[0][0], candidate[1] - points[0][1]) <= tolerance;
}

/** Signed area; a polygon with |area| below this is a slip, not a shape. */
export function polygonArea(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

export function isUsableShape(points: Point[], minimumArea = 16): boolean {
  return points.length >= 3 && Math.abs(polygonArea(points)) >= minimumArea;
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function quantize(p: Point, step = 0): Point {
  return step > 0 ? [Math.round(p[0] / step) * step, Math.round(p[1] / step) * step] : [...p];
}

/** Even-odd containment, independent of axis direction and coordinate scale. */
export function pointInPolygon(points: readonly Point[], p: Point): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
