import { modelBodies } from './feature-model';
/** Display state for native CAD-generated bodies and local study primitives. */
export type Vector = [number, number, number];
export type Transform = { position: Vector; rotation: Vector; scale: Vector };
export type Shape = "cad-body" | "shell" | "lens" | "hub" | "vents" | "sensors" | "seams" | "antenna" | "sphere" | "box" | "cylinder" | "torus";
export interface ModelPart { id: string; name: string; shape: Shape; sourceBody?: string; meshKey?: string; visible: boolean; transform: Transform; color: string; locks: string[]; }
export const identity = (): Transform => ({ position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] });
export function initialParts(): ModelPart[] {
  return modelBodies.map(body => ({ id: body.id, name: body.name, shape:'cad-body', sourceBody:body.id, meshKey:body.tips.at(-1)!.mesh, color: body.color, visible: true, transform: { ...identity(), position: [0, 153, 0] }, locks: [] }));
}
export interface SceneHistory { past: ModelPart[][]; present: ModelPart[]; future: ModelPart[][]; }
export type SceneAction = { type: "edit" | "open"; parts: ModelPart[] } | { type: "undo" | "redo" | "reset" };
export const freshHistory = (): SceneHistory => ({ past: [], present: initialParts(), future: [] });
export function sceneReducer(state: SceneHistory, action: SceneAction): SceneHistory {
  if (action.type === "reset") return freshHistory();
  if (action.type === "open") return { past: [], present: action.parts, future: [] };
  if (action.type === "undo") return state.past.length ? { past: state.past.slice(0, -1), present: state.past[state.past.length - 1], future: [state.present, ...state.future] } : state;
  if (action.type === "redo") return state.future.length ? { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) } : state;
  if (action.type !== "edit" || JSON.stringify(action.parts) === JSON.stringify(state.present)) return state;
  return { past: [...state.past.slice(-39), state.present], present: action.parts, future: [] };
}
export function editAxis(part: ModelPart, group: keyof Transform, axis: number, value: number): ModelPart {
  if (!Number.isFinite(value) || part.locks.includes(`${group}-${axis}`)) return part;
  const values = [...part.transform[group]] as Vector;
  values[axis] = group === "scale" ? Math.max(.05, Math.min(10, value)) : Math.max(-1000, Math.min(1000, value));
  return { ...part, transform: { ...part.transform, [group]: values } };
}
export const CREATE_TOOLS = [
  { id: "sphere", label: "Add sphere", icon: "ball" }, { id: "box", label: "Add box", icon: "cube-transparent" },
  { id: "cylinder", label: "Add cylinder", icon: "cylinder" }, { id: "torus", label: "Add torus", icon: "concentric" },
] as const;
