import packagedAssets0 from "@aether/assets/catalogs/28b1cf0e1f9aba";
import packagedAssets1 from "@aether/assets/catalogs/fc43ab973bc0db";
/**
 * The theme pack: every manifest in core/assets/themes, resolved. A theme is
 * one JSON of data — colour modes, geometry, font, effects and the viewport
 * look — and may `extends` another. dev/build-theme-css.mjs turns the same
 * manifests into tokens.css; this module gives the running app the list
 * (for a theme menu or a preview) and the resolver for hot installs.
 * Viewport themes live beside them and set the `viewport-*` tokens only.
 */

export interface AetherThemeManifest {
  id: string;
  name: string;
  description?: string;
  /** Inherit every token from this theme (the default when omitted) and override some. */
  extends?: string;
  /** Extra selectors that carry the theme, for a subtree that has its own class (`.aether-home-theme`). */
  aliases?: readonly string[];
  modes: { dark?: Record<string, string>; light?: Record<string, string> };
  geometry?: Record<string, string>;
  font?: Record<string, string>;
  effects?: Record<string, string>;
  /** Geometry overrides applied under `@media (pointer: coarse)`. */
  touch?: Record<string, string>;
}

export interface ResolvedTheme {
  id: string; name: string; description: string; aliases: readonly string[];
  modes: { dark: Record<string, string>; light: Record<string, string> };
  geometry: Record<string, string>; font: Record<string, string>; effects: Record<string, string>;
  touch: Record<string, string>;
}

export const DEFAULT_THEME_ID = "aether-default";

const themeFiles = (packagedAssets0 as Record<string, AetherThemeManifest>);
const viewportFiles = (packagedAssets1 as Record<string, AetherThemeManifest>);
const byID = (files: Record<string, AetherThemeManifest>) => Object.fromEntries(Object.values(files).map((m) => [m.id, m]));
const manifests = byID(themeFiles);
const merge = (a?: Record<string, string>, b?: Record<string, string>) => ({ ...(a ?? {}), ...(b ?? {}) });

/** Same algorithm as dev/build-theme-css.mjs — keep in step. */
export function resolveTheme(manifest: AetherThemeManifest, registry: Record<string, AetherThemeManifest> = manifests, seen: string[] = []): ResolvedTheme {
  if (seen.includes(manifest.id)) throw new Error(`theme ${manifest.id} extends itself`);
  const baseID = manifest.id === DEFAULT_THEME_ID ? null : manifest.extends ?? DEFAULT_THEME_ID;
  const base = baseID ? resolveTheme(registry[baseID] ?? manifests[baseID], registry, [...seen, manifest.id]) : null;
  return {
    id: manifest.id, name: manifest.name, description: manifest.description ?? "", aliases: manifest.aliases ?? [],
    modes: { dark: merge(base?.modes.dark, manifest.modes?.dark), light: merge(base?.modes.light, manifest.modes?.light) },
    geometry: merge(base?.geometry, manifest.geometry), font: merge(base?.font, manifest.font), effects: merge(base?.effects, manifest.effects),
    touch: merge(base?.touch, manifest.touch),
  };
}

/** The interface themes, default first then by name. */
export const aetherThemes: readonly ResolvedTheme[] = [manifests[DEFAULT_THEME_ID], ...Object.values(manifests).filter((m) => m.id !== DEFAULT_THEME_ID).sort((a, b) => a.name.localeCompare(b.name))]
  .map((m) => resolveTheme(m));

/** The viewport themes: only `viewport-*` tokens, applied on top of any interface theme. */
export const aetherViewportThemes: readonly ResolvedTheme[] = Object.values(byID(viewportFiles)).sort((a, b) => a.name.localeCompare(b.name))
  .map((m) => ({ id: m.id, name: m.name, description: m.description ?? "", aliases: [], modes: { dark: m.modes?.dark ?? {}, light: m.modes?.light ?? {} }, geometry: {}, font: {}, effects: {}, touch: {} }));

export const aetherTheme = (id: string): ResolvedTheme | undefined => aetherThemes.find((t) => t.id === id);

/** The scoped CSS for one resolved theme — identical to what the build emits, for hot installs. */
export function themeCSS(theme: ResolvedTheme, className = `.aether-theme-${theme.id}`): string {
  const vars = (tokens: Record<string, string>) => Object.entries(tokens).map(([name, value]) => `  --aether-${name}: ${value};`).join("\n");
  const classes = [className, ...theme.aliases];
  const dark = `  color-scheme: dark;\n${vars(theme.modes.dark)}`;
  return `${classes.join(",\n")} {\n${dark}\n\n${vars(theme.geometry)}\n\n${vars(theme.font)}\n\n${vars(theme.effects)}\n}\n` +
    `${classes.flatMap((c) => [`${c}.aether-light-theme`, `.aether-light-theme ${c}`]).join(",\n")} {\n  color-scheme: light;\n${vars(theme.modes.light)}\n}\n` +
    `${classes.flatMap((c) => [`${c}.aether-dark-theme`, `.aether-dark-theme ${c}`]).join(",\n")} {\n${dark}\n}\n`;
}
