import svgpath from 'svgpath';
import type { CubicControls, Point, SketchPath } from './types';
/** Editable lines/cubics; SVG arcs are converted to cubic approximations. */
export function parseSVGPath(data: string, transform = ''): SketchPath[] {
  if (data.length > 2_000_000) throw Error('SVG path data is too large.');
  const parser = svgpath(data), error = (parser as unknown as { err: string }).err;
  if (error) throw Error(`Invalid SVG path: ${error}`);
  const paths: SketchPath[] = [];
  let path: SketchPath | undefined, current: Point = [0, 0], commands = 0;
  const finish = () => { if (path && path.points.length >= 2) paths.push(path); path = undefined; };
  const add = (point: Point, curve: CubicControls | null = null) => {
    if (!path) path = { points: [[...current]], curves: [null], closed: false };
    path.curves![path.points.length - 1] = curve; path.points.push(point); path.curves!.push(null); current = point;
  };
  parser.abs().unshort().unarc().transform(transform).iterate(segment => {
    if (++commands > 20000) throw Error('SVG contains too many path commands.');
    const s = segment as (string | number)[], n = s.slice(1) as number[];
    if (n.some(v => !Number.isFinite(v) || Math.abs(v) > 1e7)) throw Error('SVG coordinates exceed the drawing limits.');
    switch (s[0]) {
      case 'M': finish(); current = [n[0], n[1]]; path = { points: [current], curves: [null], closed: false }; break;
      case 'L': add([n[0], n[1]]); break;
      case 'H': add([n[0], current[1]]); break;
      case 'V': add([current[0], n[0]]); break;
      case 'C': add([n[4], n[5]], { c1: [n[0], n[1]], c2: [n[2], n[3]] }); break;
      case 'Q': add([n[2], n[3]], { c1: [current[0] + (n[0] - current[0]) * 2 / 3, current[1] + (n[1] - current[1]) * 2 / 3], c2: [n[2] + (n[0] - n[2]) * 2 / 3, n[3] + (n[1] - n[3]) * 2 / 3] }); break;
      case 'Z': case 'z':
        if (path) {
          const start = path.points[0], end = path.points.at(-1)!;
          if (path.points.length > 2 && Math.hypot(end[0] - start[0], end[1] - start[1]) < 1e-9) { path.points.pop(); path.curves!.pop(); }
          path.closed = true; current = start; finish();
        }
        break;
      default: throw Error(`Unsupported SVG path command ${s[0]}`);
    }
  });
  finish(); return paths.map(p => ({ ...p, curves: p.curves?.some(Boolean) ? p.curves : undefined }));
}
