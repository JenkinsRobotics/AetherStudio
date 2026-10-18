import type { SketchPath } from './types';
/** One paint object may contain several retained contours, including holes. */
export function pathContours(path: SketchPath): SketchPath[] {
  return [path, ...(path.subpaths ?? [])].map(p => ({ points: p.points, closed: p.closed, curves: p.curves, nodeModes: p.nodeModes, fillRule: p.fillRule }));
}
export function replaceContour(path: SketchPath, index: number, contour: SketchPath): SketchPath {
  const { subpaths: _, ...clean } = contour;
  return index === 0 ? { ...path, ...clean } : { ...path, subpaths: path.subpaths?.map((p, i) => i === index - 1 ? clean : p) };
}
export function compoundPath(paths: SketchPath[], fillRule: 'evenodd' | 'nonzero' = 'evenodd'): SketchPath {
  const all = paths.flatMap(pathContours);
  if (!all.length || all.some(p => !p.closed)) throw Error('Compound shapes require closed contours.');
  return { ...all[0], subpaths: all.slice(1), fillRule };
}
