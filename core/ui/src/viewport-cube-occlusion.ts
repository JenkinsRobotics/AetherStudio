import type { CubeVector } from "./viewport-cube-geometry";

/** Orthographic camera space: larger Z is nearer the viewer. Clip each facet
 * to the portion in front of an axis segment (or a constant-depth label).
 * Masks therefore remove only occluded pixels, not entire axes by direction. */
export function cubeAxisOccluders(
  facets: readonly (readonly CubeVector[])[],
  start: CubeVector,
  end: CubeVector = start,
): CubeVector[][] {
  const dx = end[0] - start[0], dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  const depthDifference = (point: CubeVector) => {
    const t = lengthSquared > 1e-12
      ? ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared
      : 0;
    return point[2] - (start[2] + t * (end[2] - start[2]));
  };
  return facets.map(facet => {
    const clipped: CubeVector[] = [];
    for (let i = 0; i < facet.length; i++) {
      const a = facet[i], b = facet[(i + 1) % facet.length];
      const da = depthDifference(a), db = depthDifference(b);
      const aInFront = da > 1e-9, bInFront = db > 1e-9;
      if (aInFront) clipped.push(a);
      if (aInFront !== bInFront) {
        const t = da / (da - db);
        clipped.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])]);
      }
    }
    return clipped;
  }).filter(polygon => polygon.length >= 3);
}
