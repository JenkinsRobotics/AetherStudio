/**
 * The viewport look, read from the theme as numbers a renderer can use.
 *
 * A theme's `viewport-*` tokens describe the stage: its gradient, grid, part
 * shading, sketch strokes and selection. A viewport theme
 * (core/assets/themes/viewports) overrides only those, independently of the
 * interface theme. Every product's 3D view reads the same tokens through this
 * module, so one choice restyles every stage.
 *
 * Presentation only: it reads CSS custom properties and returns numbers. It
 * knows nothing about any renderer, and nothing about the host.
 */

export interface RGBA { r: number; g: number; b: number; a: number }

/** Parses the CSS colour forms a theme manifest may use: #rgb, #rrggbb, #rrggbbaa, rgb()/rgba(). */
export function parseCSSColor(value: string): RGBA | null {
  const text = value.trim();
  if (!text) return null;
  const hex = /^#([0-9a-f]{3,8})$/i.exec(text);
  if (hex) {
    const digits = hex[1];
    const expand = (part: string) => parseInt(part.length === 1 ? part + part : part, 16);
    if (digits.length === 3 || digits.length === 4) {
      return { r: expand(digits[0]), g: expand(digits[1]), b: expand(digits[2]), a: digits.length === 4 ? expand(digits[3]) / 255 : 1 };
    }
    if (digits.length === 6 || digits.length === 8) {
      return {
        r: parseInt(digits.slice(0, 2), 16), g: parseInt(digits.slice(2, 4), 16), b: parseInt(digits.slice(4, 6), 16),
        a: digits.length === 8 ? parseInt(digits.slice(6, 8), 16) / 255 : 1,
      };
    }
    return null;
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(text);
  if (!rgb) return null;
  const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) return null;
  const alpha = parts.length > 3 && Number.isFinite(parts[3]) ? parts[3] : 1;
  return { r: parts[0], g: parts[1], b: parts[2], a: alpha };
}

/** A colour as a renderer hex number, with the alpha the token carried. */
export interface ViewportColor { hex: number; alpha: number }

export interface ViewportPalette {
  /** The stage gradient, and the single colour a solid background should use (their midpoint). */
  backgroundTop?: ViewportColor;
  backgroundBottom?: ViewportColor;
  background?: ViewportColor;
  grid?: ViewportColor;
  gridAxis?: ViewportColor;
  part?: ViewportColor;
  partShade?: ViewportColor;
  partEdge?: ViewportColor;
  cavity?: ViewportColor;
  sketch?: ViewportColor;
  sketchConstrained?: ViewportColor;
  construction?: ViewportColor;
  selection?: ViewportColor;
  hover?: ViewportColor;
}

const TOKENS: readonly (readonly [keyof ViewportPalette, string])[] = [
  ["backgroundTop", "viewport-bg-top"], ["backgroundBottom", "viewport-bg-bottom"],
  ["grid", "viewport-grid"], ["gridAxis", "viewport-grid-axis"],
  ["part", "viewport-part"], ["partShade", "viewport-part-shade"], ["partEdge", "viewport-part-edge"],
  ["cavity", "viewport-cavity"], ["sketch", "viewport-sketch"], ["sketchConstrained", "viewport-sketch-constrained"],
  ["construction", "viewport-construction"], ["selection", "viewport-selection"], ["hover", "viewport-hover"],
];

const toColor = (rgba: RGBA): ViewportColor => ({ hex: (Math.round(rgba.r) << 16) | (Math.round(rgba.g) << 8) | Math.round(rgba.b), alpha: rgba.a });

/** Builds the palette from already-read token text, so the arithmetic is testable without a DOM. */
export function viewportPalette(tokens: Record<string, string>): ViewportPalette {
  const palette: ViewportPalette = {};
  for (const [key, token] of TOKENS) {
    const parsed = parseCSSColor(tokens[token] ?? "");
    if (parsed) palette[key] = toColor(parsed);
  }
  const top = parseCSSColor(tokens["viewport-bg-top"] ?? "");
  const bottom = parseCSSColor(tokens["viewport-bg-bottom"] ?? "");
  // A scene that paints one colour takes the gradient's midpoint.
  if (top && bottom) palette.background = toColor({ r: (top.r + bottom.r) / 2, g: (top.g + bottom.g) / 2, b: (top.b + bottom.b) / 2, a: 1 });
  else if (top) palette.background = toColor(top);
  return palette;
}

/**
 * The palette the page's theme currently resolves to. Returns an empty palette
 * where there is no document, so a renderer keeps its own defaults rather than
 * painting the scene black.
 */
export function readViewportPalette(element?: Element): ViewportPalette {
  if (typeof document === "undefined" || typeof getComputedStyle !== "function") return {};
  const style = getComputedStyle(element ?? document.documentElement);
  const tokens: Record<string, string> = {};
  for (const [, token] of TOKENS) tokens[token] = style.getPropertyValue(`--aether-${token}`);
  return viewportPalette(tokens);
}
