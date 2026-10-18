## Application header wordmarks — 2026-10-16

All nine identities now have transparent horizontal wordmarks in
[`wordmarks/`](wordmarks/README.md): their original unique A, bold **Aether**, and
lighter app name. Light/dark SVG and PNG variants share outlined Noto Sans
lettering. AppWordmark composes these assets for headers, with an opt-in
ApplicationIdentity wordmark style. Square app icons and original marks remain
unchanged. Review the whole family in Aether UI → Overlays → Header bars →
Application header logos, including 28/36/40px samples and downloads.

# Aether application artwork

## Standalone A assets — 2026-10-13

All nine identities have a separate transparent A in [`marks/`](marks/README.md).
Use shared `AppMark` for these letters and `AppIcon` for the existing square icons.
The mark assets bundle independently and work without a Studio server.

## New Aether identity — 2026-09-13

[`new-aether-2026-09/`](new-aether-2026-09/) contains the five new application
marks generated from Jonathan's supplied design sheet: Studio, CAD, Sketch,
Vector and Animate. See the [visual branding guide](../../../dev/docs/roadmap/Aether_Branding.md)
for previews, names and usage, and [generation prompts](new-aether-2026-09/PROMPTS.md)
for provenance. The individual masters are 1254 × 1254 RGB PNGs with their
intended backgrounds. Matching `*-named.png` variants add AETHER and the app
name below the mark. `*-hero.png` supplies wide CAD, Animate and UI artwork;
optimized `*-hero.webp` copies are used by the Studio application cards.
See [variant prompts](new-aether-2026-09/VARIANT-PROMPTS.md).

## Existing application integration

All eight products use the current masters in `new-aether-2026-09/`.
`core/host/build-web-icons.py` renders 512px PNGs with transparent rounded
corners and writes their content-versioned URLs into `apps/sources.ts`.
Shared AppIcon, Apple-touch icons, manifests and desktop shortcuts
consume the same active PNGs. Safari tab icons use 16/32/48px ICO derivatives
packaged by `core/host/build-favicons.py`, which the icon builder and installer
invoke. Each hosted tab gets an app-specific content-hashed ICO filename;
Vite also bundles that app's ICO for development, preview and offline use.
Legacy SVG and conventional favicon URLs resolve to the current identity.
Full masters remain available for large home
welcome panels. Sketch/Vector now have real wide card heroes; Map's active
hero is `aether-map-hero-v2.png`. See [final prompts](new-aether-2026-09/HOME-ART-PROMPTS.md).

`fancy/` and `simple/` contain scalable SVG renditions of Jonathan's supplied app-icon design sheets. These are vector reconstructions of the references, not the original raster source files. Each set contains distinct Studio, CAD (drafting grid/handles) and Animation (motion/timeline) artwork.

The default icon build selects the new identity. `--variant fancy` and
`--variant simple` explicitly select historical alternatives for the older
products. Rebuild web products and browser launchers after changing sets.
Shared `AppIcon` displays product branding; `AetherIcon` remains the monochrome
toolbar vocabulary. Do not regenerate product branding from toolbar icons.

`originals/` preserves the original CAD/Anima artwork with its original hashes. `previous-browser-icons/` preserves the former generic browser icons. Never delete either archive when replacing the current artwork.


## Aether IO — 2026-10-01

IO inherits the Studio master's exact faceted A silhouette, angled crossbar,
triangular negative space and wide feet. Cyan/teal circuit traces distinguish
its electrical identity. Master: `new-aether-2026-09/aether-io.png`; provenance:
`new-aether-2026-09/IO-PROMPTS.md`. The rejected initial SVG is archived under
`previous-browser-icons/io-initial-draft.svg` and is not active.

Rebuild only IO without regenerating other products:

```sh
python3 core/host/build-web-icons.py --apps io
```

This updates `apps/io.png`, the content-versioned shared source URL, ICO frames,
and generated IO public copies for standalone development. Shared `AppIcon`
uses the same source registry as every other product; hosted app metadata,
launcher, home, showcase and browser tabs all resolve that identity.

### Aether Drive — 2026-10-03

`new-aether-2026-09/aether-drive.png` uses the faceted Studio A, including its
diagonal crossbar, asymmetric apex and broad feet, with a cyan cloud behind it.
It replaces the rejected simplified SVG A (archived in
`previous-browser-icons/drive-initial-draft.svg`). `apps/drive.svg` is a compatibility
wrapper of the corrected master, not a separately drawn mark.
`apps/drive.png` and `apps/drive.ico` are its generated browser/shortcut assets.
Drive is registered in the web-icon, favicon and macOS shortcut builders; the
shared AppIcon/AppLauncher use its versioned `/icons/drive.png` source. Original
archived branding is unchanged.

IO and Drive now also have dedicated `aether-io-hero` / `aether-drive-hero`
landscape artwork in `new-aether-2026-09/` (PNG masters, WebP delivery). Studio
application cards and each product’s wide welcome area use these heroes; app
icons, square marks, favicons and desktop shortcuts keep their separate assets.


### Browser artwork derivatives (2026-10-03)

The active welcome/card PNG imports now use quality-90 WebP siblings in
`new-aether-2026-09/`. `web-derivatives.json` records the 11 converted sources,
output hashes, sizes, and the cwebp regeneration command. Dimensions are unchanged;
18,921,217 source bytes become 1,415,094 served bytes. Keep the PNG masters and all
`originals/` archives: native/browser icon generation still uses the masters.
This optimizes delivered artwork without redrawing logos or rewriting git history.

## Illustrated file artwork — 2026-10-03

Part, Assembly and Project files use the folded-page reference supplied by
Jonathan: a gold solid, interlocking gold/blue/silver solids, and stacked project
sheets. The scalable drawings are `../icons/file-part.svg`, `file-assembly.svg`
and `file-project.svg`. Their silver and charcoal palettes follow the application's
light/dark color scheme. These are document illustrations, not new app identities.

`FileIcon` overlays the existing official CAD PNG through `AppIcon`; no concept
letter A is traced or substituted, and original branding is unchanged. Use this
shared component in Drive, file pickers, app homes and previews so the document
artwork and the correct application badge travel together. See the light/dark
file-icon specimens in Aether UI → Icons & Assets.

The full file registry now follows that same material and folded-page design.
Drawing, Show, Character, Clip, Workspace, Sketch, Circuit and Vector each have
their own illustrated object with their official application badge. Office
documents, PDF, image, video, audio, archive, imported model, code, text and unknown
files use distinct content illustrations without an Aether app badge. Folders
retain a gold folder silhouette with shaded surfaces and silver contents. Shared
SVG sources are `../icons/file-*.svg`; no bitmap logos are embedded in the SVGs.
Every document page follows the inherited light/dark scheme, and the gallery
shows all registered types at 144, 40, 24 and 18 pixels in both themes.
