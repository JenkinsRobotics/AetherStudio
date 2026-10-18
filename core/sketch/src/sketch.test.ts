import { describe, expect, it } from 'vitest';
import { rectPolygon, distanceToSegment, pointInPolygon, arcPath, samplePath, splitCurve, splitPathEdge,
  replacePathPoints, transformPath, beginDraft, endDraft, moveDraft, penPointerDown, finishPen,
  nearestPathEdge, type Point, type SketchPath } from './index';

describe('unit-neutral geometry', () => {
  it('keeps submillimetre coordinates and makes quantization explicit', () => {
    expect(rectPolygon([.0001, .0002], [.0003, .0004])).toEqual([[.0001, .0002], [.0003, .0002], [.0003, .0004], [.0001, .0004]]);
    expect(rectPolygon([1.2, 3.9], [9.8, 8.2], 1)).toEqual([[1, 4], [10, 4], [10, 8], [1, 8]]);
    expect(endDraft(beginDraft('rect', [0, 0])!, [.001, .002]).kind).toBe('commit');
  });
  it('handles degenerate picking and either polygon winding', () => {
    expect(distanceToSegment([3, 4], [0, 0], [0, 0])).toBe(5);
    const polygon = rectPolygon([0, 0], [10, 10]);
    expect(pointInPolygon(polygon, [5, 5])).toBe(true);
    expect(pointInPolygon([...polygon].reverse(), [5, 5])).toBe(true);
    expect(pointInPolygon(polygon, [-1, 5])).toBe(false);
    expect(arcPath([0, 0], [1, 0], [2, 0])).toBe('L2,0');
    expect(arcPath([1, 0], [0, 1], [-1, 0])).toBe('A1 1 0 0 1 -1,0');
  });
});
const path: SketchPath = { points: [[0, 0], [100, 0], [100, 100]], curves: [{ c1: [20, 80], c2: [80, 80] }, null, null], closed: true };
describe('retained curves', () => {
  it('subdivision preserves the original cubic at every sampled parameter', () => {
    const split = splitPathEdge(path, 0, .3), c = path.curves![0]!;
    for (let i = 0; i <= 100; i++) {
      const t = i / 100, expected = splitCurve(path.points[0], c, path.points[1], t).point;
      const actual = t <= .3 ? splitCurve(split.points[0], split.curves![0]!, split.points[1], t / .3).point
        : splitCurve(split.points[1], split.curves![1]!, split.points[2], (t - .3) / .7).point;
      expect(actual[0]).toBeCloseTo(expected[0], 8); expect(actual[1]).toBeCloseTo(expected[1], 8);
    }
    expect(path.points).toHaveLength(3);
  });
  it('carries adjacent handles and transforms all authored coordinates', () => {
    const moved = replacePathPoints(path, [[10, 20], [100, 0], [100, 100]]);
    expect(moved.curves![0]).toEqual({ c1: [30, 100], c2: [80, 80] });
    expect(transformPath(path, p => [p[0] * 2, p[1] * 2]).curves![0]!.c2).toEqual([160, 160]);
  });
  it('samples overshooting collinear controls and respects open endpoints', () => {
    const open: SketchPath = { points: [[0, 0], [10, 0]], closed: false, curves: [{ c1: [100, 0], c2: [100, 0] }, null] };
    const sampled = samplePath(open);
    expect(Math.max(...sampled.map(p => p[0]))).toBeGreaterThan(70);
    expect(sampled.at(-1)).toEqual([10, 0]);
    expect(splitPathEdge(open, 1, .5)).toBe(open);
    expect(nearestPathEdge(path, [50, 60], 1)).toMatchObject({ edge: 0 });
  });
});
it('pen supports mirrored tangents, repeated final clicks and closing without losing controls', () => {
  let draft = penPointerDown(null, [0, 0]);
  const clicks: [Point, Point][] = [[[0, 0], [40, 0]], [[100, 100], [130, 100]], [[0, 100], [0, 120]]];
  for (const [anchor, end] of clicks) {
    draft = penPointerDown(draft, anchor);
    const step = endDraft(moveDraft(draft, end), end);
    if (step.kind !== 'continue') throw new Error('expected pen draft');
    draft = step.draft;
  }
  const before = finishPen(draft);
  const repeated = endDraft(penPointerDown(draft, [0, 100]), [0, 100]);
  if (repeated.kind !== 'continue') throw new Error('expected pen draft');
  expect(finishPen(repeated.draft)).toEqual(before);
  expect(endDraft(penPointerDown(repeated.draft, [0, 0]), [0, 0])).toEqual(before);
});
