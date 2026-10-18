# Aether application header wordmarks

Nine app identities in the horizontal composition requested on 2026-10-16:
**unique app A + bold Aether + lighter app name**. These are transparent assets
for the upper-left corner of an application header. The existing A PNGs are used
unchanged; no mark has been redrawn, recolored or replaced by the reference A.
All original artwork remains intact.

- `*-light.svg` / `*-light.png`: navy lettering for light surfaces.
- `*-dark.svg` / `*-dark.png`: pale lettering for dark surfaces.
- SVG lettering is outlined Noto Sans Bold/Regular, so no font installation is
  needed. The embedded A is the original raster artwork, not a traced vector.
- PNG exports are 256px high with alpha. At 28, 36 or 40px header height they
  provide more than enough resolution for high-density displays.
- `aether-header-logos.zip` contains all 36 SVG/PNG files and this guide.
- App names are Studio, CAD, Animation, Map, Sketch, Vector, IO, Drive and UI.
  Animation retains its current application name.

React applications should use `AppWordmark` from `@aether/ui/AppWordmark`.
It reuses the same outlines and separately bundled mark resources, avoiding a
large embedded-image SVG in each header. Its default appearance follows Aether's
surface tokens; explicit `light`/`dark` values are available for fixed surfaces.

```tsx
<AppWordmark app="cad" size={36} />
<DocumentBar application={{ id: "cad", name: "Aether CAD", identityStyle: "wordmark" }} />
```

`AppMark` remains the A-only identity. `AppIcon` remains the square launcher icon.
Do not stretch, tile or add a border/shadow to the horizontal wordmark. Preserve
its intrinsic proportions. Use the A-only mark where the full name cannot fit.

`build.py` deterministically creates SVGs and `data.ts` from the original marks
and the bundled, SIL OFL-licensed Noto Sans fonts in `../../fonts/noto-sans/`.
The transparent PNGs are browser renders of those SVGs. `manifest.json` records
source and output hashes; the generation evidence is in
`.verification/app-wordmarks-2026-10-16/` in the repository root.
