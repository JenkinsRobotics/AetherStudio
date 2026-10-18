export interface Study {
  id: string; name: string; length: number; width: number; height: number; radius: number;
  color: string; metalness: number; roughness: number; lid: boolean; body: boolean; exploded: boolean;
}
export interface Lighting { power: number; spread: number; softness: number; azimuth: number; elevation: number; exposure: number; fill: number; }
export const initialLighting: Lighting = { power: 190, spread: 45, softness: .8, azimuth: 225, elevation: 60, exposure: 1.1, fill: .45 };
export const studies = (): Study[] => [
  { id: "enclosure", name: "Enclosure study", length: 160, width: 64, height: 28, radius: 2.5, color: "#8c9aa9", metalness: .9, roughness: .3, body: true, lid: true, exploded: false },
  { id: "matchbox", name: "Matchbox", length: 84, width: 54, height: 25, radius: 4, color: "#a39784", metalness: .75, roughness: .38, body: true, lid: true, exploded: false },
  { id: "part-study", name: "Part study", length: 100, width: 100, height: 40, radius: 7, color: "#777f88", metalness: .96, roughness: .22, body: true, lid: true, exploded: false },
];
export const maxRadius = (study: Study) => Math.min(study.width, study.length, study.height) / 2 - .5;
export function updateStudy(study: Study, patch: Partial<Study>): Study {
  const next = { ...study, ...patch };
  for (const [key, min, max] of [["length", 40, 240], ["width", 25, 140], ["height", 10, 80]] as const) next[key] = Number.isFinite(next[key]) ? Math.min(max, Math.max(min, next[key])) : study[key];
  next.radius = Math.max(.25, Math.min(maxRadius(next), Number.isFinite(next.radius) ? next.radius : study.radius));
  return next;
}
export const LIGHT_PRESETS: { id: string; label: string; lighting: Lighting }[] = [
  { id: "spotlight", label: "Spotlight", lighting: initialLighting },
  { id: "softbox", label: "Softbox", lighting: { power: 160, spread: 65, softness: 1, azimuth: 210, elevation: 75, exposure: 1.2, fill: .65 } },
  { id: "rim", label: "Rim light", lighting: { power: 210, spread: 35, softness: .5, azimuth: 50, elevation: 35, exposure: 1, fill: .15 } },
];
