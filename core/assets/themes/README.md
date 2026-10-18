# The theme pack

One theme type. A theme is one JSON manifest here (`$schema: aether-theme/v1`)
that defines everything a widget may read: both colour modes, geometry, type,
effects and the viewport look. Widget CSS consumes only the emitted
`--aether-*` tokens, so a new theme is a new manifest — no rule changes.

```
{ "id": "my-theme", "name": "My Theme", "description": "…",
  "extends": "aether-studio",              // optional: inherit, override some
  "aliases": [".my-scope"],                 // optional: extra selectors
  "modes": { "dark": { "color-…", "viewport-…" }, "light": { … } },
  "geometry": { "radius-…", "size-…", "space-…" },
  "font": { "font-family", "font-mono", "font-size-…" },
  "effects": { "shadow-1…3", "material", "motion-…" } }
```

- `aether-default.json` is the built-in theme: `:root` + `.aether-light-theme`.
- Every manifest also emits side by side as `.aether-theme-<id>` (plus
  `.aether-light-theme` / `.aether-dark-theme` forms for a subtree preview).
  A manifest may `extends` another; the resolver fills every hole from the
  default, so a theme always covers the full token set (the build fails if not).
- `viewports/*.json` (`aether-viewport/v1`) set only the `viewport-*` tokens
  and emit as `.aether-viewport-<id>`, chosen independently of the interface
  theme — the stage can change without the chrome changing.
- Build: `node dev/build-theme-css.mjs` → `core/ui/tokens/tokens.css`.
  Runtime: `aetherThemes` / `aetherViewportThemes` list the pack;
  `setAetherTheme(id)`, `setAetherViewportTheme(id | null)` and
  `setAetherAppearance(mode)` persist per device and sync across tabs;
  `installAetherTheme(manifest)` hot-installs one without a build;
  `useScopedAetherTheme(id, mode?)` lets a concept app present in a theme
  for its lifetime. `ThemeMenu` is the header control.
- Guard: `node dev/check-theme-literals.mjs` fails on a raw colour in
  `core/ui/src` or a token no theme defines.

## The pack (2026-09-28)

| Theme | Origin |
| --- | --- |
| Aether Default | the CAD workbench, bright and dark |
| Aether Studio | the ported native studio palette (was the demo kit's own `--ad-*` engine) |
| Aether Teal / Indigo / Orange, Graphite | its accent variants (were the kit's accents and the Atlas demo's themes) |
| Midnight | the near-black variant (was Anima Midnight / the native High Contrast preset) |
| Neon | the UI Dev theme lab's neon |
| Studio Home | the library and admin home greys (was `tokens/home.css`), alias `.aether-home-theme` |
| Viewports: Midnight, Graphite, Blueprint, Paper | the native PreviewAppearance stages |

### Unified selection cells

`selection-cell-inset`, `selection-cell-gap` and `selection-cell-radius` are geometry
values. All current themes use `0px`: the selected cell fills its zone to the
container edge, with only the outer container owning rounded corners. A derived
theme can explicitly supply nonzero values for an inset treatment. Existing
selection/accent color tokens determine the fill. Attachment is a surface choice,
not a density choice, and must not override these values or change icon dimensions.

### Aether Slate — workflow reference standard

`aether-slate` supplies soft-white and neutral-charcoal modes with cobalt actions,
quiet borders and compact rounded geometry, based on the user-supplied workflow
reference. `color-bg-segment-selected` / `color-text-segment-selected` separate
segmented selection from action accents. The default aliases these tokens to the
previous selection/text colors, preserving every existing theme. The gallery
exposes Slate through the ordinary theme menu and a scoped light/dark comparison.
