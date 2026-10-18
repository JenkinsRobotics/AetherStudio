import { expect, test } from "vitest";
import { cubeAxisOccluders } from "./viewport-cube-occlusion";
import type { CubeVector } from "./viewport-cube-geometry";

const face: CubeVector[] = [[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0]];
test("nearer cube faces occlude rear axes but never foreground axes", () => {
  expect(cubeAxisOccluders([face],[-2,0,-1],[2,0,-1])).toEqual([face]);
  expect(cubeAxisOccluders([face],[-2,0,1],[2,0,1])).toEqual([]);
});
test("splits an oblique axis at the actual face depth instead of hiding its entire length", () => {
  const [occluder] = cubeAxisOccluders([face],[-2,0,-2],[2,0,2]);
  expect(occluder).toHaveLength(4);
  expect(Math.min(...occluder.map(p=>p[0]))).toBe(-1);
  expect(Math.max(...occluder.map(p=>p[0]))).toBe(0);
});
test("axis labels have their endpoint depth even when the axis points at the camera", () => {
  expect(cubeAxisOccluders([face],[0,0,-2])).toEqual([face]);
  expect(cubeAxisOccluders([face],[0,0,2])).toEqual([]);
});
