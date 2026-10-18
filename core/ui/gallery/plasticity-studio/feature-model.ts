import { scifirobotFeatureModel as model } from '@aether/assets/models/scifirobot/parametric/manifest';
import type { ModelPart } from './state';

/** Generated presentation data. Aether CAD owns the source document and evaluation. */
export const modelFeatures = model.features;
export const modelBodies = model.bodies;
export const featureIndex = new Map(modelFeatures.map((feature, index) => [feature.id, index]));
export const modelBody = (id?: string) => modelBodies.find(body => body.id === id);

/** Select a previously evaluated native tip; this does not evaluate CAD in the UI. */
export function previewParts(parts: ModelPart[], cutoff: number): ModelPart[] {
  if (cutoff >= modelFeatures.length) return parts;
  return parts.flatMap(part => {
    if (part.shape !== 'cad-body') return [part];
    const body = modelBody(part.sourceBody);
    const tip = body?.tips.filter(tip => (featureIndex.get(tip.featureID) ?? Infinity) < cutoff).at(-1);
    return tip ? [{...part, meshKey: tip.mesh}] : [];
  });
}
export function validModelMesh(sourceBody: unknown, meshKey: unknown): boolean {
  return typeof sourceBody === 'string' && typeof meshKey === 'string' && !!modelBody(sourceBody)?.tips.some(tip => tip.mesh === meshKey);
}
