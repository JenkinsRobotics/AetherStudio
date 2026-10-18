import { useEffect, useState } from "react";

const PREFIX = "aether.animation-studio.";

/** The keys were `aether.anima.*` until the 2026-09-28 rename; move a saved
 *  value across once so nobody's concept settings reset. */
function storedValue(key: string): string | null {
  const current = localStorage.getItem(`${PREFIX}${key}`);
  if (current !== null) return current;
  const legacy = localStorage.getItem(`aether.anima.${key}`);
  if (legacy === null) return null;
  localStorage.setItem(`${PREFIX}${key}`, legacy);
  localStorage.removeItem(`aether.anima.${key}`);
  return legacy;
}

/** Device-local concept preferences. Never writes a product document or engine setting. */
export function useAnimationStudioPreference<T extends string | number | boolean>(key: string, fallback: T) {
  const read = (): T => {
    try {
      const raw = storedValue(key);
      if (raw === null) return fallback;
      if (typeof fallback === "boolean") return (raw === "true") as T;
      if (typeof fallback === "number") return (Number.isFinite(Number(raw)) ? Number(raw) : fallback) as T;
      return raw as T;
    } catch { return fallback; }
  };
  const [value, setValue] = useState<T>(read);
  useEffect(() => {
    const follow = (event: Event) => {
      if (event instanceof CustomEvent) {
        if (event.detail?.key === key) setValue(event.detail.value as T);
      } else setValue(read());
    };
    window.addEventListener("animation-preference", follow);
    window.addEventListener("storage", follow);
    return () => { window.removeEventListener("animation-preference", follow); window.removeEventListener("storage", follow); };
  }, [key, fallback]);
  const update = (next: T) => {
    setValue(next);
    try { localStorage.setItem(`${PREFIX}${key}`, String(next)); } catch { /* Current-session controls still work. */ }
    window.dispatchEvent(new CustomEvent("animation-preference", {detail:{key,value:next}}));
  };
  return [value, update] as const;
}

export type StudioSetting = {
  id: string; label: string; initial: string | number | boolean;
  options?: readonly string[]; min?: number; max?: number; step?: number;
  color?: boolean; caption?: string;
};
const choice = (id: string, label: string, options: string[], initial = options[0]): StudioSetting => ({id,label,options,initial});
const toggle = (id: string, label: string, initial = true): StudioSetting => ({id,label,initial});
const range = (id: string, label: string, initial: number, min: number, max: number, step = .01): StudioSetting => ({id,label,initial,min,max,step});
const color = (id: string, label: string, initial: string): StudioSetting => ({id,label,initial,color:true});
const drags = ["Right Mouse Drag", "Shift + Right Mouse Drag", "Option + Right Mouse Drag", "Middle Mouse Drag", "Control + Right Mouse Drag", "Control + Middle Mouse Drag", "Control + Shift + Middle Mouse Drag", "Shift + Middle Mouse Drag", "Option + Middle Mouse Drag"];

/** Field inventory follows AnimationStudioSettingsView and MouseNavigationSettingsView. */
export const studioSettings: Record<string, readonly StudioSetting[]> = {
  workspace: [choice("import-unit", "Unitless model units", ["Millimeters", "Centimeters", "Meters", "Inches"]), toggle("autosave-import", "Autosave after import"), range("default-fps", "Default frame rate", 30, 12, 60, 1)],
  ui: [choice("design-preset", "Design preset", ["Standard", "Compact", "High Contrast"]), color("accent-color", "Accent color", "#4c9dff"), choice("toolbar-density", "Tool density", ["compact", "standard", "expanded"], "expanded"), choice("toolbar-shape", "Floating chrome", ["square", "soft", "rounded"], "soft"), toggle("status-bar", "Show workspace status bar")],
  renderer: [toggle("telemetry", "Show performance telemetry", false), toggle("view-cube", "Show orientation ViewCube"), toggle("origin", "Show character origin axes"), toggle("floor-grid", "Show world-space floor grid"), range("grid-spacing", "Grid spacing (m)", .1, .001, 1, .001), range("grid-extent", "Grid extent (m)", 10, 1.5, 20, .5), range("grid-major", "Major line interval", 5, 2, 20, 1), range("grid-opacity", "Grid opacity", .24, .02, .9), choice("render-style", "Render style", ["Shaded", "Shaded with Edges", "Wireframe", "Unshaded", "Translucent"]), choice("render-quality", "Render quality", ["Standard", "High (4× MSAA)"])],
  appearance: [choice("viewport-theme", "Theme", ["Midnight", "Studio", "Light"]), choice("reflections", "Reflections", ["Reflections Off", "Subtle Reflections", "Studio Reflections"], "Subtle Reflections"), choice("environment", "Studio environment", ["Neutral Softbox", "Cool Rim Studio", "Warm Stage"]), range("environment-rotation", "Environment rotation (°)", 0, 0, 360, 1), toggle("source-colors", "Preserve STEP/XDE colors"), color("background", "Viewport background", "#e8eaee"), color("neutral-color", "Unspecified model color", "#9dcfed"), color("selection-color", "Face selection", "#ff982b")],
  materials: [choice("finish", "Material finish", ["Matte", "Satin", "Glossy", "Metallic"], "Satin"), range("roughness", "Surface roughness", .48, 0, 1), range("metallic", "Surface metallic", .02, 0, 1), toggle("feature-edges", "Show exact B-Rep feature edges"), range("edge-definition", "Edge definition", .5, 0, 1), color("edge-color", "Edge color", "#5e6670"), color("selected-edge-color", "Selected edge color", "#ff982b")],
  lighting: [choice("lighting-preset", "Lighting preset", ["Balanced", "Soft", "Bright", "High Contrast"]), range("lighting-intensity", "Viewport intensity", 1, .1, 3), toggle("shadows", "Cast viewport shadows"), range("ambient", "Ambient light", .2, 0, .55), range("contact-shadows", "Contact shadows", .5, 0, 1), range("key-intensity", "Key light", 3000, 0, 8000, 50), color("key-color", "Key light color", "#fff7e8"), range("fill-intensity", "Fill light", 840, 0, 8000, 50), color("fill-color", "Fill light color", "#c7e0ff"), range("rim-intensity", "Rim light", 1500, 0, 8000, 50), color("rim-color", "Rim light color", "#ffffff")],
  navigation: [choice("navigation-profile", "Navigation profile", ["Default", "SolidWorks", "Onshape", "Fusion 360", "Custom"]), choice("rotate-drag", "Rotate", drags), choice("pan-drag", "Pan", drags, "Middle Mouse Drag"), choice("zoom-drag", "Precise zoom", drags, "Shift + Middle Mouse Drag"), ...["Orbit", "Pan", "Zoom"].map((name) => choice(`${name.toLowerCase()}-speed`, `${name} speed`, ["Slow", "Reduced", "Standard", "Fast", "Very Fast"], name === "Zoom" ? "Reduced" : "Standard")), toggle("reverse-zoom", "Reverse scroll zoom", false)],
  developer: [toggle("safe-area", "Show content-safe area", false), toggle("nodes-tab", "Nodes", false), toggle("design-tab", "Design sandbox", false)],
};
