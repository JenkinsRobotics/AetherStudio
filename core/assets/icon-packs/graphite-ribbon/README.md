# Graphite Ribbon

An additive illustrated tool theme based on Jonathan's dark ribbon reference:
fine silver outlines, graphite facets, small azure action accents, and softly
shaded solids. The light palette uses slate outlines and pale silver faces.
The original illustrated pack in `core/assets/icons/tools/` is unchanged.

## Contents

- **123 tool icons**: all 121 original tool names, plus `cylinder` and `sphere`.
- `adaptive/`: SVGs with `--graphite-*` palette variables and dark fallbacks.
- `dark/`, `light/`: complete, standalone SVG packs; no external styles/fonts.
- `masters/`: 123 purpose-drawn SVG body fragments, one for every icon.
- `pack.json`: complete icon-name catalog, palette values and pack metadata.
- `artwork.ts`: generated raw-SVG registry consumed by `@aether/ui`.
- `preview.png`: inspected contact sheet, both palettes at toolbar sizes.
- `review.py` and `review/`: reproducible, labelled review plates at 24px/40px.

All icons use a 32 × 32 viewBox, with fine 1.15-unit primary outlines. Every
icon now has a deliberate Graphite master: no inherited geometry, recoloring
fallback, or dependency on the original pack. Silver outlines identify the
shape; azure identifies the action, constraint, or selected face. Simplified
joints, sketch constraints and utility symbols remain legible at toolbar size.
No app, CAD engine, font, raster texture or network dependency is required.

## Use in Aether UI

```tsx
import { ToolIcon, ToolIconTheme } from '@aether/ui';

<ToolIconTheme pack="graphite-ribbon">
  <ToolIcon name="extrude" />
  <ToolIcon name="select" />
</ToolIconTheme>

// Explicit standalone choice, useful in palette comparisons:
<ToolIcon name="part" pack="graphite-ribbon" palette="light" />
```

`palette="auto"` (default) inherits the nearest `data-aether-theme` palette.
The provider is local to its React subtree; separate projects can use different
packs simultaneously. Omitting the provider/pack keeps classic artwork.
`toolIconNames` retains the original catalog; `graphiteToolIconNames` exposes
all 123 names. The two new primitives use Graphite even without a pack prop,
since the classic pack does not contain them. Small interface glyphs rendered
by `AetherIcon` and its existing registry are unaffected.

Gallery: **Icons & Assets → Illustrated ribbon tools — Graphite Ribbon**. Both
packs and both palettes remain visible as labelled icon grids, without a
toolbar tray or interactive ribbon preview.

## Rebuild

```sh
python3 core/assets/icon-packs/graphite-ribbon/build.py
```

This regenerates only this pack's SVGs and registry, from the palette manifest,
its own master fragments. Undefined materials or missing masters fail the build. If changing palette
values, keep `core/ui/src/ToolIconTheme.css` in sync. The build never edits the
original icon pack. `ToolIcon` namespaces gradient IDs per mounted instance,
so repeated ribbons can safely share these vectors.


## Visual review

```sh
python3 core/assets/icon-packs/graphite-ribbon/review.py /tmp/graphite-review
rsvg-convert /tmp/graphite-review/preview.svg -o /tmp/graphite-preview.png
```

`review-1.svg` through `review-4.svg` cover every name in both palettes, with
40px and 24px versions next to one another. Review these individually: a tiny
unlabelled all-icons sheet can hide malformed silhouettes. Checked-in PNGs
record the latest review; rebuild them when changing any master.
