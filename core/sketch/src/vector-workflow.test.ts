import { expect, it } from 'vitest';
import { snapPoint, nearestPoint, nearestAxis, pathBounds, ellipsePath, setNodeMode, movePathControl,
  splitPathEdge, reversePath, breakPath, joinPaths, trimPath, slicePath, offsetContour, splitCurve,
  beginDraft, endDraft, penPointerDown, finishPen, type SketchPath } from './index';
const square: SketchPath = { points: [[0, 0], [100, 0], [100, 100], [0, 100]], closed: true };
const line = (x: number): SketchPath => ({ points: [[x, -20], [x, 120]], closed: false });
it('snaps by screen-derived tolerance, stable target priority, independent axes, grid and bypass', () => {
  const targets = [{ point: [10, 10] as [number, number], label: 'first' }, { point: [10, 10] as [number, number], label: 'second' }];
  expect(nearestPoint([12, 10], targets, 2)?.label).toBe('first');
  expect(snapPoint([12, 10], targets, { tolerance: 8 / 4 }).point).toEqual([10, 10]);
  expect(snapPoint([13, 10], targets, { tolerance: 8 / 4, align: false }).point).toEqual([13, 10]);
  expect(snapPoint([12, 200], targets, { tolerance: 2 }).point).toEqual([10, 200]);
  expect(nearestAxis([10, 100], [{ point: [10, 0] }, { point: [10, 90] }], 2, 0)?.point).toEqual([10, 90]);
  expect(snapPoint([19, 21], [], { tolerance: 2, gridStep: 20 }).point).toEqual([20, 20]);
  expect(snapPoint([12, 10], targets, { tolerance: 10, bypass: true }).point).toEqual([12, 10]);
});
it('has exact cubic extrema bounds and four editable ellipse arcs', () => {
  const path: SketchPath = { points: [[0, 0], [100, 0]], closed: false, curves: [{ c1: [0, 100], c2: [100, 100] }, null] };
  expect(pathBounds([path])).toEqual({ x: 0, y: 0, width: 100, height: 75 });
  const ellipse = ellipsePath([20, 30], [220, 130]);
  expect(ellipse.curves).toHaveLength(4);
  expect(pathBounds([ellipse])).toEqual({ x: 20, y: 30, width: 200, height: 100 });
});
it('smooth handles retain opposite length, symmetric handles match length, Alt breaks the coupling', () => {
  const path = setNodeMode(square, 1, 'symmetric');
  const symmetric = movePathControl(path, 1, 'c1', [130, 40]);
  expect(symmetric.curves![0]!.c2).toEqual([70, -40]);
  expect(movePathControl(symmetric, 1, 'c1', [100, 0]).curves![0]!.c2).toEqual([100, 0]);
  const smooth = movePathControl({ ...path, nodeModes: ['corner', 'smooth', 'corner', 'corner'] }, 1, 'c1', [130, 40]);
  expect(Math.hypot(smooth.curves![0]!.c2[0] - 100, smooth.curves![0]!.c2[1])).toBeCloseTo(100 / 3);
  const broken = movePathControl(symmetric, 1, 'c1', [150, 10], true);
  expect(broken.curves![0]).toEqual(symmetric.curves![0]);
  expect(broken.nodeModes![1]).toBe('corner');
  const subdivided = splitPathEdge(path, 1, .25);
  expect(subdivided.nodeModes![1]).toBe('smooth');
});
it('reverses, breaks and joins retained curves without closing open endpoints', () => {
  const ellipse = ellipsePath([0, 0], [100, 100]);
  expect(reversePath(reversePath(ellipse))).toEqual(ellipse);
  const opened = breakPath(ellipse, 2)[0];
  expect(opened.closed).toBe(false); expect(opened.points).toHaveLength(5);
  const pieces = breakPath(opened, 2); expect(pieces).toHaveLength(2);
  const joined = joinPaths(pieces[0], pieces[1])!;
  expect(joined.points).toEqual(opened.points); expect(joined.curves).toEqual(opened.curves);
  expect(joined.nodeModes).toHaveLength(joined.points.length);
  const unrelated = joinPaths(line(0), line(100))!;
  expect(unrelated.curves).toHaveLength(4); expect(unrelated.nodeModes).toHaveLength(4);
});
it('creates open pen and line paths while preserving explicit closure', () => {
  let draft = penPointerDown(null, [0, 0], undefined, { closePenOnFinish: false });
  let step = endDraft(draft, [0, 0]); if (step.kind !== 'continue') throw Error('draft');
  draft = penPointerDown(step.draft, [100, 0]); step = endDraft(draft, [100, 0]); if (step.kind !== 'continue') throw Error('draft');
  expect(finishPen(step.draft)).toMatchObject({ kind: 'commit', closed: false, shape: [[0, 0], [100, 0]] });
  expect(finishPen(step.draft, true).kind).not.toBe('commit');
  expect(endDraft(beginDraft('line', [0, 0])!, [50, 20])).toMatchObject({ kind: 'commit', closed: false, shape: [[0, 0], [50, 20]] });
});
it('trims only the clicked interval and retains the rest of a closed contour', () => {
  const horizontal: SketchPath = { points: [[0, 0], [100, 0]], closed: false };
  const result = trimPath(horizontal, [50, 0], [line(25), line(75)], 2)!;
  expect(result.map(p => p.points)).toEqual([[[0, 0], [25, 0]], [[75, 0], [100, 0]]]);
  const closed = trimPath(square, [50, 0], [line(25), line(75)], 2)!;
  expect(closed).toHaveLength(1); expect(closed[0].closed).toBe(false);
  expect(closed[0].points[0]).toEqual([75, 0]); expect(closed[0].points.at(-1)).toEqual([25, 0]);
  expect(trimPath(square, [50, 0], [], 2)![0].points).toEqual([[100, 0], [100, 100], [0, 100], [0, 0]]);
  expect(trimPath(horizontal, [50, 0], [], 2)).toEqual([]);
});
it('slicing a cubic retains its exact shape on the retained parameter interval', () => {
  const path: SketchPath = { points: [[0, 0], [100, 0]], closed: false, curves: [{ c1: [10, 80], c2: [90, 80] }, null] };
  const kept = slicePath(path, .2, .8)!;
  for (let i = 0; i <= 20; i++) {
    const actual = splitCurve(kept.points[0], kept.curves![0]!, kept.points[1], i / 20).point;
    const expected = splitCurve(path.points[0], path.curves![0]!, path.points[1], .2 + .6 * i / 20).point;
    expect(actual[0]).toBeCloseTo(expected[0], 8); expect(actual[1]).toBeCloseTo(expected[1], 8);
  }
});
it('offsets either winding outward/inward and rejects collapse rather than saving crossed loops', () => {
  expect(pathBounds([offsetContour(square, 10)])).toEqual({ x: -10, y: -10, width: 120, height: 120 });
  expect(pathBounds([offsetContour(reversePath(square), 10)])).toEqual({ x: -10, y: -10, width: 120, height: 120 });
  expect(pathBounds([offsetContour(square, -10)])).toEqual({ x: 10, y: 10, width: 80, height: 80 });
  expect(() => offsetContour(square, -60)).toThrow('collapses');
  expect(() => offsetContour(line(0), 10)).toThrow('Close');
});

it('closed trim recognizes a crossing at the closing node', () => {
  const diagonal: SketchPath = { points: [[-10, -10], [110, 110]], closed: false };
  const result = trimPath(square, [50, 0], [diagonal], 2)!;
  expect(result).toHaveLength(1);
  expect(result[0].points).toEqual([[100, 100], [0, 100], [0, 0]]);
});

it('trims at compound inner boundaries without treating separate contours as connected', () => {
  const ring: SketchPath = { ...square, subpaths: [{
    points: [[25, 25], [75, 25], [75, 75], [25, 75]], closed: true,
  }] };
  const horizontal: SketchPath = { points: [[-20, 50], [120, 50]], closed: false };
  const result = trimPath(horizontal, [50, 50], [ring], 2)!;
  expect(result).toHaveLength(2);
  expect(result[0].points.at(-1)![0]).toBeCloseTo(25);
  expect(result[1].points[0][0]).toBeCloseTo(75);
  expect(result[0].points[0]).toEqual([-20, 50]);
  expect(result[1].points.at(-1)).toEqual([120, 50]);
});
