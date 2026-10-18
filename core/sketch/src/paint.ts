/** Renderer-independent vector paint. Stops and positions use normalized units. */
export interface GradientStop { offset: number; color: string; opacity: number }
export interface VectorGradient { kind: 'linear' | 'radial'; angleDeg: number; stops: GradientStop[] }
export interface VectorAppearance {
  fillGradient?: VectorGradient;
  fillOpacity?: number;
  strokeOpacity?: number;
  strokeEnabled?: boolean;
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
  dash?: 'solid' | 'dashed' | 'dotted';
}
export function isVectorGradient(value: unknown): value is VectorGradient {
  if (!value || typeof value !== 'object') return false;
  const g = value as VectorGradient;
  return ['linear', 'radial'].includes(g.kind) && Number.isFinite(g.angleDeg) && Math.abs(g.angleDeg) <= 36000 &&
    Array.isArray(g.stops) && g.stops.length >= 2 && g.stops.length <= 16 && g.stops.every((s, i) =>
      !!s && Number.isFinite(s.offset) && s.offset >= 0 && s.offset <= 1 && (!i || s.offset >= g.stops[i - 1].offset) &&
      typeof s.color === 'string' && /^#[\da-f]{6}$/i.test(s.color) && Number.isFinite(s.opacity) && s.opacity >= 0 && s.opacity <= 1);
}
/** Linear endpoints span the normalized bounding box at the requested angle. */
export function gradientVector(angleDeg: number) {
  const angle = angleDeg * Math.PI / 180, dx = Math.cos(angle), dy = Math.sin(angle);
  const radius = (Math.abs(dx) + Math.abs(dy)) / 2;
  return { x1: .5 - dx * radius, y1: .5 - dy * radius, x2: .5 + dx * radius, y2: .5 + dy * radius };
}
export function strokeDash(dash: VectorAppearance['dash'], width: number): number[] | undefined {
  return dash === 'dashed' ? [4 * width, 2 * width] : dash === 'dotted' ? [width, 2 * width] : undefined;
}
