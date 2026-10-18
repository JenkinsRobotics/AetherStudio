/** Browser-local interface overrides. Separate light/dark palettes preserve readability. */
export const interfaceColorFields = [
  ["bg-app", "Page background"], ["bg-shell", "Workspace background"],
  ["bg-panel", "Panels and cards"], ["bg-bar", "Toolbars and sidebar"],
  ["bg-inset", "Input backgrounds"], ["border", "Borders"],
  ["accent", "Accent"], ["text", "Text"], ["text-dim", "Secondary text"],
] as const;
export type InterfaceColorToken = typeof interfaceColorFields[number][0];
export type InterfaceColors = Partial<Record<InterfaceColorToken, string>>;
export type ColorMode = "light" | "dark";
export const INTERFACE_COLORS_KEY = "aether-interface-colors-v1";
const hex = /^#[0-9a-f]{6}$/i;
export function validateInterfaceColors(input: unknown): InterfaceColors {
  if (!input || typeof input !== "object") return {};
  return Object.fromEntries(interfaceColorFields.flatMap(([key]) => {
    const value = (input as Record<string, unknown>)[key];
    return typeof value === "string" && hex.test(value) ? [[key, value.toLowerCase()]] : [];
  }));
}
export function readInterfaceColors(mode: ColorMode): InterfaceColors {
  try { return validateInterfaceColors(JSON.parse(localStorage.getItem(INTERFACE_COLORS_KEY) || "{}")[mode]); } catch { return {}; }
}
export function resolvedInterfaceMode(): ColorMode { return document.documentElement.dataset.aetherTheme === "light" ? "light" : "dark"; }
export function applyInterfaceColors() {
  if (typeof document === "undefined") return;
  let style = document.querySelector<HTMLStyleElement>("style[data-aether-custom-colors]");
  if (!style) { style = document.createElement("style"); style.dataset.aetherCustomColors = ""; document.head.append(style); }
  const colors = readInterfaceColors(resolvedInterfaceMode());
  style.textContent = `:root, .aether-home-theme {${Object.entries(colors).map(([key,value]) => `--aether-color-${key}:${value} !important;`).join("")}}`;
}
export function setInterfaceColors(mode: ColorMode, colors: InterfaceColors) {
  const saved = { light: readInterfaceColors("light"), dark: readInterfaceColors("dark"), [mode]: validateInterfaceColors(colors) };
  try { localStorage.setItem(INTERFACE_COLORS_KEY, JSON.stringify(saved)); } catch { return; }
  applyInterfaceColors();
  document.dispatchEvent(new Event("aether-interface-colors"));
}
export const neutralInterfaceColors: Record<ColorMode, InterfaceColors> = {
  light: { "bg-app": "#f0f0f0", "bg-shell": "#eeeeee", "bg-panel": "#fafafa", "bg-bar": "#f6f6f6", "bg-inset": "#e7e7e7", border: "#d4d4d4", text: "#242424", "text-dim": "#606060" },
  dark: { "bg-app": "#202020", "bg-shell": "#242424", "bg-panel": "#2b2b2b", "bg-bar": "#272727", "bg-inset": "#353535", border: "#474747", text: "#f0f0f0", "text-dim": "#b6b6b6" },
};
