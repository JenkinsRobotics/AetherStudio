import type { Point, SketchPath } from './types';
import { lerp, splitCurve } from './curves';

export function transformPath(path: SketchPath, map: (point: Point) => Point): SketchPath {
  return { ...path, subpaths: path.subpaths?.map(p => transformPath(p, map)), points: path.points.map(map), curves: path.curves?.map(c => c ? { c1: map(c.c1), c2: map(c.c2) } : null) };
}

/** Carry attached handles with their anchors; retain unchanged edges after topology edits. */
export function replacePathPoints(path: SketchPath, points: Point[]): SketchPath {
  const old = path.points;
  const curves = path.curves && points.map((p, i) => {
    const next = (i + 1) % points.length;
    if (!path.closed && i === points.length - 1) return null;
    if (old.length !== points.length) {
      const j = old.findIndex(v => v[0] === p[0] && v[1] === p[1]);
      const end = old[(j + 1) % old.length];
      return j >= 0 && end && end[0] === points[next][0] && end[1] === points[next][1] ? path.curves?.[j] ?? null : null;
    }
    const c = path.curves?.[i];
    return c ? {
      c1: [c.c1[0] + p[0] - old[i][0], c.c1[1] + p[1] - old[i][1]] as Point,
      c2: [c.c2[0] + points[next][0] - old[next][0], c.c2[1] + points[next][1] - old[next][1]] as Point,
    } : null;
  });
  const nodeModes = path.nodeModes && points.map((p, i) => path.nodeModes?.[old.length === points.length ? i : old.findIndex(v => v[0] === p[0] && v[1] === p[1])] ?? 'corner');
  return { ...path, points, curves, nodeModes };
}

export function splitPathEdge(path: SketchPath, edge: number, t: number): SketchPath {
  const { points } = path, a = points[edge], b = points[(edge + 1) % points.length];
  if (!a || !b || t <= 0 || t >= 1 || (!path.closed && edge >= points.length - 1)) return path;
  const curves = points.map((_, i) => path.curves?.[i] ?? null), c = curves[edge];
  const split = c ? splitCurve(a, c, b, t) : null;
  curves.splice(edge, 1, split?.left ?? null, split?.right ?? null);
  const nodeModes = points.map((_, i) => path.nodeModes?.[i] ?? 'corner');
  if (split) {
    if (nodeModes[edge] === 'symmetric') nodeModes[edge] = 'smooth';
    const next = (edge + 1) % points.length;
    if (nodeModes[next] === 'symmetric') nodeModes[next] = 'smooth';
  }
  nodeModes.splice(edge + 1, 0, split ? 'smooth' : 'corner');
  return { ...path, points: [...points.slice(0, edge + 1), split?.point ?? lerp(a, b, t), ...points.slice(edge + 1)], curves, nodeModes };
}
