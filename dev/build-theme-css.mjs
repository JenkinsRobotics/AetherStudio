#!/usr/bin/env node
// Generates core/ui/tokens/tokens.css (and tokens.json) from the theme pack in
// core/assets/themes. One manifest type, resolved the same way at build time
// and at runtime (core/ui/src/themes.ts): a theme is data — both colour
// modes, geometry, font, effects and the viewport look — and a manifest may
// `extends` another, so an accent variant is a few lines. Widget CSS
// consumes only the emitted variables, so a new theme is a new manifest.
//
// Emitted per UI theme (the default also gets a scoped copy so previews can
// show it inside another theme):
//   :root                                     default dark + shared tokens
//   .aether-light-theme                       default light
//   .aether-theme-<id>                        dark + shared
//   .aether-theme-<id>.aether-light-theme,
//   .aether-light-theme .aether-theme-<id>    light (root switch or subtree)
//   .aether-theme-<id>.aether-dark-theme,
//   .aether-dark-theme .aether-theme-<id>     forced dark inside a light page
// Viewport themes (core/assets/themes/viewports) emit the same shape as
// .aether-viewport-<id>, after the UI themes so they win on the viewport
// tokens alone.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const themesDir = join(repoRoot, "core/assets/themes");
const viewportsDir = join(themesDir, "viewports");
const DEFAULT = "aether-default";
const ids = (dir) => existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith(".json")).map((n) => n.replace(/\.json$/, "")) : [];
const load = (dir, id) => JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8"));

// Same algorithm as resolveTheme() in core/ui/src/themes.ts — keep in step.
const manifests = Object.fromEntries(ids(themesDir).map((id) => [id, load(themesDir, id)]));
function resolve(id, seen = []) {
  const m = manifests[id];
  if (!m) throw new Error(`theme ${id} not found`);
  if (seen.includes(id)) throw new Error(`theme ${id} extends itself`);
  const base = id === DEFAULT ? null : resolve(m.extends ?? DEFAULT, [...seen, id]);
  const merge = (a, b) => ({ ...(a ?? {}), ...(b ?? {}) });
  return {
    id, name: m.name, description: m.description ?? "", aliases: m.aliases ?? [],
    modes: { dark: merge(base?.modes.dark, m.modes?.dark), light: merge(base?.modes.light, m.modes?.light) },
    geometry: merge(base?.geometry, m.geometry), font: merge(base?.font, m.font), effects: merge(base?.effects, m.effects),
    touch: merge(base?.touch, m.touch),
  };
}

const line = ([name, value]) => `  --aether-${name}: ${value};`;
const notes = {
  "focus-halo": `  /* Focus halo — disabled suite-wide (Jonathan, 2026-09-10): fields glowed,
     buttons never did. Every application point references this token;
     \`grep aether-focus-halo\` lists them. Re-enable per subtree by overriding. */`,
  "color-shadow": `  /* Elevation shadows are always shadow-dark; never derive them from bg-app
     or they invert into light-mode halos over dark surfaces. */`,
  "size-topbar": `  /* Jonathan 2026-09-10: home-style bar is the standard */`,
  "size-row": `  /* Constant-geometry contract: rows are size-row tall with a fixed
     size-icon-slot leading column on a size-grid rhythm — sidebars, toolbars,
     and tables build from these same blocks. */`,
  "viewport-bg-top": `  /* The viewport look. A viewport theme (core/assets/themes/viewports) overrides
     only these, so the stage can change without touching the interface. */`,
};
const emit = (tokens, withNotes = false) => Object.entries(tokens).map((e) => (withNotes && notes[e[0]] ? `${notes[e[0]]}\n${line(e)}` : line(e))).join("\n");
const shared = (t, withNotes) => `${emit(t.geometry, withNotes)}\n\n${emit(t.font, withNotes)}\n\n${emit(t.effects, withNotes)}`;
const dark = (t, withNotes) => `  color-scheme: dark;\n${emit(t.modes.dark, withNotes)}`;
const light = (t) => `  color-scheme: light;\n${emit(t.modes.light)}`;

const scoped = (cls, t) => `
/* ${t.name} (${t.id}) */
${[cls, ...t.aliases].join(",\n")} {
${dark(t)}

${shared(t)}
}
${[cls, ...t.aliases].flatMap((c) => [`${c}.aether-light-theme`, `.aether-light-theme ${c}`]).join(",\n")} {
${light(t)}
}
${[cls, ...t.aliases].flatMap((c) => [`${c}.aether-dark-theme`, `.aether-dark-theme ${c}`]).join(",\n")} {
${dark(t)}
}`;

const base = resolve(DEFAULT);

/* A coarse pointer changes the geometry tokens, not the widgets: a finger needs
   about 44px and this suite's controls are 28px. Because widget CSS reads only
   these variables, raising them here grows every control, row and rail at once.

   Reduced motion collapses the duration tokens to 1ms for the same reason —
   every transition in the system is expressed in them, so one block turns the
   whole suite still without a rule per component. */
const adaptations = (t, selector) => {
  const out = [];
  if (Object.keys(t.touch ?? {}).length) {
    out.push(`@media (pointer: coarse) {\n${selector} {\n${emit(t.touch)}\n  }\n}`);
  }
  const still = Object.keys(t.effects).filter((k) => /^motion-(fast|base|slow)$/.test(k));
  if (still.length) {
    out.push(`@media (prefers-reduced-motion: reduce) {\n${selector} {\n${still.map((k) => `  --aether-${k}: 1ms;`).join("\n")}\n  }\n}`);
  }
  return out.join("\n");
};

let css = `/* GENERATED from core/assets/themes/*.json — do not edit by hand.
   Edit a manifest and run: node dev/build-theme-css.mjs
   Widget CSS consumes ONLY these variables; apps may re-theme by overriding
   them on :root or any subtree. */
:root {
${dark(base, true)}

${shared(base, true)}
}

/* Light mode of the ${base.name} theme. Colours only — geometry, type and
   effects are shared between modes. The appearance bootstrap applies this class. */
.aether-light-theme {
${light(base)}
}
`;
css += `\n${adaptations(base, ":root")}\n`;
const themes = [DEFAULT, ...Object.keys(manifests).filter((id) => id !== DEFAULT).sort()].map((id) => resolve(id));
css += themes.map((t) => scoped(`.aether-theme-${t.id}`, t)).join("\n");

const viewports = ids(viewportsDir).sort().map((id) => {
  const m = load(viewportsDir, id);
  return { id, name: m.name, description: m.description ?? "", aliases: [], modes: { dark: m.modes?.dark ?? {}, light: m.modes?.light ?? {} }, geometry: {}, font: {}, effects: {} };
});
css += "\n\n/* Viewport themes: the stage alone, selectable independently of the interface theme. */";
css += viewports.map((v) => scoped(`.aether-viewport-${v.id}`, v).replace(/\n\n\n\}/g, "\n}")).join("\n");

writeFileSync(join(repoRoot, "core/ui/tokens/tokens.css"), css + "\n");
writeFileSync(join(repoRoot, "core/ui/tokens/tokens.json"), JSON.stringify({
  "$description": "Resolved default theme, mirrored from core/assets/themes/aether-default.json by dev/build-theme-css.mjs.",
  ...base,
}, null, 2) + "\n");

// Every theme must resolve to the default's full token set — no holes.
const keys = (t) => [...Object.keys(t.modes.dark), ...Object.keys(t.modes.light), ...Object.keys(t.geometry), ...Object.keys(t.font), ...Object.keys(t.effects), ...Object.keys(t.touch ?? {})].sort().join();
for (const t of themes) if (keys(t) !== keys(base)) { console.error(`theme ${t.id} does not cover the default token set`); process.exit(1); }
console.log(`tokens.css generated: ${themes.length} interface themes (${Object.keys(base.modes.dark).length} dark, ${Object.keys(base.modes.light).length} light tokens), ${viewports.length} viewport themes.`);
