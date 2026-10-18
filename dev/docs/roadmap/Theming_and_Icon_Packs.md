# Theming and icon packs

Direction (Jonathan, 2026-09-10): the suite must be structurally themable —
no hardcoded presentation in app code. Light mode exposed the cost of
inlined palettes; this contract prevents regrowth.

## The contract (shipped)

- **Color flows through variables only.** Core structure uses `--aether-*`
  tokens (`core/ui/tokens/tokens.css`, mirrored from `tokens.json`). Page- or
  product-specific decoration uses scoped variables (`--studio-*`,
  `--setup-*`, `--library-*`) declared in one theme block per stylesheet with
  dark defaults and `.aether-light-theme` overrides.
- **A theme is a variable-override scope.** Dark is `:root`; light is
  `.aether-light-theme` (applied by the shared appearance bootstrap in
  `@aether/ui` StudioChrome — System/Light/Dark, OS-following, cross-tab).
  A future theme pack is another override block/class produced from a token
  set; no rule changes required.
- **Enforcement:** `node dev/check-theme-literals.mjs` fails on raw color
  literals outside variable declarations (var() fallbacks allowed). Wired
  into the studio build. Expansion path: add `Aether CAD/src` and
  `aether-animation/web/src` to its roots after their sweeps.
- **Icon packs:** all interface icons resolve through the `AetherIcon` /
  `ToolIcon` name registries backed by `core/assets/icons/`. The registry map
  is the single swap seam — an icon pack is an alternate module registering
  the same names. Products must not inline icon geometry (existing rule).

## Shipped 2026-09-10: default theme + default icon pack

- **Default theme** `core/assets/themes/aether-default.json` — a theme is a
  JSON manifest shipping BOTH modes (dark + light) plus geometry and type.
  `node dev/build-theme-css.mjs [themeId]` generates `core/ui/tokens/tokens.css`
  from it (parity-verified against the previous hand-written values). A new
  theme is a new manifest + regenerate; widget rules never change. tokens.json
  is superseded by the manifest and kept only for reference.
- **Default icon pack** `core/assets/icons/pack.json` — the pack is the
  artwork directory plus the AetherIcon registry that names it.
  `node dev/check-icon-pack.mjs` guards registry↔artwork drift (68 icons at
  ship). An alternate pack = alternate artwork registered under the same names.
- **Geometry contract tokens** — `--aether-size-row` (36px),
  `--aether-size-icon-slot` (36px), `--aether-size-grid` (4px): the row =
  [icon slot][label] block system (constant in collapsed/expanded states,
  headers become dividers) now driven by tokens. This is the foundation for
  sidebars, toolbars, and tables; the CAD library sidebar is the reference
  implementation.

## Community drop-in flow (shipped 2026-09-10, evening)

Bringing a new theme, VS Code-style:
1. Drop `my-theme.json` into `core/assets/themes/` (same manifest shape as
   the default: id, name, `modes.dark`, `modes.light`).
2. `node dev/build-theme-css.mjs` — installed themes emit side by side as
   `.aether-theme-<id>` scoped classes; the default stays on `:root`.
3. Select at runtime with `setAetherTheme("<id>")` from `@aether/ui`
   (persisted per device, synced across tabs, composes with System/Light/Dark
   because every theme ships both modes). Selection UI in Settings is the
   remaining piece.

Bringing a new icon pack:
1. Ship artwork under the pack's directory with a `pack.json`.
2. Register at runtime: `registerIconPack({ name: svgMarkup, … })` from
   `@aether/ui` — partial packs fall back per icon to the default artwork.
   Build-time compilation of a pack directory into that object is the listed
   codegen follow-up; `dev/check-icon-pack.mjs` guards the default pack.

Proven end-to-end: a test manifest generated its scoped classes and was
removed cleanly; runtime selection and icon override are unit-tested.

## Asset layout + hot swap (shipped 2026-09-10, late)

```
core/assets/
  themes/            # one manifest per theme (aether-default.json is built in)
  icons/             # the default icon pack (pack.json + 68 SVGs)
  icon-packs/        # one directory per additional pack (pack.json + SVGs)
  branding/          # identity artwork (originals preserved — standing rule)
```

Hot swap is live, VS Code-style: `installAetherTheme(manifest)` injects a
theme's scoped CSS at runtime (no build) and `setAetherTheme(id)` activates
it instantly; `registerIconPack({...})` re-renders every mounted icon
immediately via the pack store. Both paths are unit-tested; READMEs in the
asset directories carry the contributor recipes.

## Shipped 2026-09-28: one theme engine, the pack consolidated

Jonathan: *"standardize the theme pack to a single type and consolidate the
current list of themes we developed for different demo apps — most apps
wouldn't have five different theme engines."* Before this the showcase had
four self-driving theme systems beside the manifest: the demo kit's `--ad-*`
tokens with appearance/accent/variant attributes, the Atlas demo's seven
attribute combinations, the ported studio session's hand-written
`AnimaTheme.css` overrides, and the UI Dev theme lab's five literal classes,
plus `tokens/home.css`. None read the manifest; the kit even overrode the
shared tokens inside its scope.

- **One type.** `core/assets/themes/*.json` (`aether-theme/v1`) now carries
  colour modes, geometry, type, **effects** (shadow levels, material, motion)
  and the **viewport** look (`viewport-*` tokens: stage gradient, grid,
  part, cavity, sketch, selection). A manifest may `extends` another and may
  declare `aliases`. The build and the runtime share one resolver; every
  theme resolves to the default's full token set or the build fails.
- **The pack.** Aether Default, Aether Studio, Aether Teal, Aether Indigo,
  Aether Orange, Graphite, Midnight, Neon, Studio Home — every look the demo
  apps had, under Aether names. Viewport themes Midnight, Graphite,
  Blueprint, Paper (`themes/viewports/`, `aether-viewport/v1`) set the stage
  alone and are chosen independently, persisted under their own key.
- **Widgets read tokens only.** The kit's `--ad-*` family is gone (615
  references rewritten to `--aether-*`; `theme.css` deleted); `AD` constants
  map to tokens; the shared stylesheet's drifted names (`color-danger`,
  `color-warning`, `color-focus`) now hit real tokens; 98 literal colour
  lines in `core/ui/src` went to tokens or `color-mix` on `--aether-color-shadow`
  / `--aether-color-text` (three `literal-ok` lines remain: macOS traffic
  lights, a hue wheel, a material render). The guard now covers `core/ui/src`
  and fails on a token no theme defines.
- **Selection.** `ThemeMenu` in the header (interface theme + viewport
  theme), `setAetherTheme` / `setAetherViewportTheme` / `setAetherAppearance`
  persisted and cross-tab, `useScopedAetherTheme` for a concept app that
  presents in its own theme. The demo apps use it: the studio session scopes
  Aether Studio or Midnight (High Contrast), the Anima demo maps its accents
  to the pack, the Atlas demo's seven themes are pack ids and its tiles read
  the resolved tokens.
- **Showcase.** Icons & Assets → *Themes — the theme pack*: tiles in both
  modes, viewport tiles, the active theme's token table by category, and the
  shared widgets once per theme. The UI Dev theme lab picks from the pack.

**How the neighbours do it, for the record.** Blender keeps one theme file
with a section per editor (the 3D viewport's colours included) and lets a
viewport override its background locally; SolidWorks has one colour scheme
for interface and viewport colours, with render *scenes* separate; Rhino's
display modes are viewport themes chosen per view; Adobe has an interface
brightness plus a per-document canvas colour; Onshape only light/dark plus
per-account viewport colours. The convergence is two layers — interface
theme, viewport look — with the viewport overridable without touching the
chrome, which is what the `viewport-*` category plus viewport themes gives.
Render environment (lights, HDRI, matcaps) stays app render settings.

## Scope split: suite themes vs app render settings

Interface themes style the chrome of every app. The viewport look is a
category of the theme (`viewport-*` tokens) that a **viewport theme**
(`themes/viewports/*.json`) can override on its own — since 2026-09-28 the
native PreviewAppearance stages (Midnight / Graphite / Blueprint / Paper)
are viewport themes in the pack. Aether CAD's renderer still reads its own
`aether-cad-appearance` setting today; pointing it at the `viewport-*`
tokens is the open item below. Render environment (lights, HDRI, matcaps)
stays app render settings, never a theme.

## Open items

- Tokenize `Aether CAD/src` and `aether-animation/web/src` stylesheets, then
  add them to the checker roots.
- Light palette polish pass (decorative overlays, chip tints) with Jonathan.
- Point Aether CAD's renderer and the kit's viewport mock at the
  `viewport-*` tokens so a viewport theme reaches the real stage.
- Discrete control styles (flat / raised / outline) as a theme field the
  widget CSS branches on, if a theme needs more than tokens can express.
- Tokenise the gallery's remaining literal lines (`AnimationStudioDemo.css` 43,
  `AnimaUIDevSpecimens.css` 19) and add `core/ui/gallery` to the guard.
- Icon-pack codegen for the AetherIcon registry (today the registry is the
  hand-maintained seam; the checker keeps it honest).
- Adopt the geometry tokens in the CAD workspace toolbar/panels and the
  library tables.
