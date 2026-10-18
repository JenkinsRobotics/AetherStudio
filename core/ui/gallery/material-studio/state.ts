export type Vector3 = [number, number, number];
export interface StudioTransform { position: Vector3; rotation: Vector3; scale: Vector3; }
export interface StudioMaterial { id: string; name: string; color: string; metalness: number; roughness: number; opacity: number; }
export interface StudioObject { id: string; name: string; kind: "head" | "cube" | "sphere"; visible: boolean; material: string; transform: StudioTransform; }
export const identityTransform = (): StudioTransform => ({ position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] });
export const MATERIALS: readonly StudioMaterial[] = [
  { id: "clay", name: "Porcelain", color: "#7798b2", metalness: .08, roughness: .48, opacity: 1 },
  { id: "gold", name: "Brushed gold", color: "#d9ad64", metalness: .94, roughness: .23, opacity: 1 },
  { id: "diffuse", name: "Warm clay", color: "#d8ceba", metalness: 0, roughness: .84, opacity: 1 },
  { id: "metal", name: "Chrome", color: "#e2e5e9", metalness: 1, roughness: .12, opacity: 1 },
  { id: "graphite", name: "Graphite", color: "#383b42", metalness: .55, roughness: .32, opacity: 1 },
];
export function initialObjects(): StudioObject[] {
  return [
    { id: "head", name: "Head study", kind: "head", visible: true, material: "clay", transform: identityTransform() },
    { id: "cube", name: "Cube", kind: "cube", visible: false, material: "gold", transform: { ...identityTransform(), position: [200, -80, 0], scale: [.8, .8, .8] } },
    { id: "sphere", name: "Sphere", kind: "sphere", visible: false, material: "metal", transform: { ...identityTransform(), position: [-200, -80, 0], scale: [.8, .8, .8] } },
  ];
}
export const DURATION = 10;
export function nextPreviewTime(time: number, delta: number, loop: boolean): number {
  const next = time + Math.max(0, delta);
  return loop ? next % DURATION : Math.min(DURATION, next);
}
