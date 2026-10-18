import { expect, it } from 'vitest';
import { gradientVector, isVectorGradient, strokeDash } from './paint';
const gradient = { kind: 'linear', angleDeg: 0, stops: [{ offset: 0, color: '#123456', opacity: 1 }, { offset: 1, color: '#abcdef', opacity: .4 }] };
it('validates portable paint, refusing malformed, unordered and executable colors', () => {
  expect(isVectorGradient(gradient)).toBe(true);
  for (const value of [null, {}, { ...gradient, angleDeg: NaN }, { ...gradient, stops: gradient.stops.slice(0, 1) }, { ...gradient, stops: [...gradient.stops].reverse() }, { ...gradient, stops: [null, gradient.stops[1]] }, { ...gradient, stops: [{ ...gradient.stops[0], color: 'url(x)' }, gradient.stops[1]] }]) expect(isVectorGradient(value)).toBe(false);
});
it('uses the same normalized gradient direction and width-relative strokes in consumers', () => {
  expect(gradientVector(0)).toEqual({ x1: 0, y1: .5, x2: 1, y2: .5 });
  expect(gradientVector(90).y1).toBeCloseTo(0); expect(gradientVector(90).y2).toBeCloseTo(1);
  expect(gradientVector(45).x1).toBeCloseTo(0); expect(gradientVector(45).y2).toBeCloseTo(1);
  expect(strokeDash('dashed', 3)).toEqual([12, 6]); expect(strokeDash('solid', 3)).toBeUndefined();
});
