export interface WheelStudy {
  name: string; diameter: number; width: number; bore: number; flange: number; rounding: number;
  color: string; roughness: number; metalness: number; opacity: number; visible: boolean;
}
export const initialWheel: WheelStudy = { name: "Train cart wheel", diameter: 400, width: 120, bore: 48, flange: 24, rounding: 3, color: "#769fbb", roughness: .32, metalness: .8, opacity: 1, visible: true };
export const finishes = [
  { name: "Steel Blue", color: "#769fbb", metalness: .8, roughness: .32 },
  { name: "Brushed Steel", color: "#a7afb8", metalness: .94, roughness: .3 },
  { name: "Graphite", color: "#424b55", metalness: .7, roughness: .4 },
  { name: "Bronze", color: "#b59062", metalness: .85, roughness: .3 },
];
export function updateWheel(previous: WheelStudy, patch: Partial<WheelStudy>): WheelStudy {
  const next = { ...previous, ...patch };
  const bound = (key: keyof WheelStudy, min: number, max: number) => {
    const value = Number(next[key]); Object.assign(next, { [key]: Math.min(max, Math.max(min, Number.isFinite(value) ? value : Number(previous[key]))) });
  };
  bound("diameter", 180, 700); bound("width", 50, next.diameter * .5); bound("bore", 12, next.diameter * .22);
  bound("flange", 8, next.diameter * .12); bound("rounding", .2, Math.min(next.width * .06, next.flange * .4));
  bound("roughness", .08, 1); bound("metalness", 0, 1); bound("opacity", .1, 1);
  return next;
}
export type WheelEditor = "properties" | "profile" | "rounding" | "appearance" | "lighting" | "notes";
export interface WheelDisplay { grid: boolean; edges: boolean; wireframe: boolean; section: boolean; bounds: boolean; }
export const initialDisplay: WheelDisplay = { grid: true, edges: true, wireframe: false, section: false, bounds: false };
