import { finiteTuple, isRecord, validateItems } from "../demo-document/document";
import type { ModelPart, Shape, Vector } from "./state";
import { validModelMesh } from './feature-model';
const shapes: readonly Shape[] = ["cad-body", "shell", "lens", "hub", "vents", "sensors", "seams", "antenna", "sphere", "box", "cylinder", "torus"];
export function validateModelParts(value: unknown): ModelPart[] {
  validateItems(value);
  return value.map(part => {
    const t = part.transform;
    if (!shapes.includes(part.shape as Shape) || !isRecord(t) || !finiteTuple(t.position, 3) || !finiteTuple(t.rotation, 3) || !finiteTuple(t.scale, 3) || t.scale.some(n => n < .05 || n > 10) || !Array.isArray(part.locks) || part.locks.some(lock => typeof lock !== "string" || !/^(position|rotation|scale)-[0-2]$/.test(lock)))
      throw Error("The study contains invalid model parts or transforms.");
    if (part.shape === 'cad-body' && !validModelMesh(part.sourceBody,part.meshKey)) throw Error('The study refers to an unknown CAD body or feature tip.');
    return { id: String(part.id), name: String(part.name), shape: part.shape as Shape, ...(part.shape === 'cad-body' ? {sourceBody:String(part.sourceBody),meshKey:String(part.meshKey)} : {}), color: String(part.color), visible: Boolean(part.visible), locks: part.locks as string[], transform: { position: t.position as Vector, rotation: t.rotation as Vector, scale: t.scale as Vector } };
  });
}
