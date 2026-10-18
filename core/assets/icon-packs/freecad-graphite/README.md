# FreeCAD Graphite

A **new, separate** icon theme adapting FreeCAD's CAD artwork to silver outlines,
graphite faces and blue feature highlights. Both dark and light editions are
included. Aether Classic and Graphite Ribbon remain independent and unchanged.

## Scope

1,707 SVG icons from every bundled FreeCAD workbench/resource group and the
main application, plus 24 original Aether additions: **1,731 icons / 3,462
light-and-dark variants**. Upstream categories:
Application, Assembly, BIM, CAM, Draft, Fem, Inspection, Material, Measure, Mesh,
MeshPart, OpenSCAD, Part, PartDesign, Points, ReverseEngineering, Robot, Sketcher,
Spreadsheet, Start, Surface, TechDraw, Test, and Tux.

This includes toolbar tools, workbench icons, overlays and source variants.
The local snapshot also has 60 bitmap PNG resources; those are not vector icons
and are not included in this SVG theme. Source silhouettes remain recognizable;
this is a vector material/outline adaptation, not a claim that every icon is
manually redrawn. FreeCAD trademarks remain the property of their owners.

- `masters/` and `extensions.json`: 24 original Aether illustrations, distinct from upstream artwork.
- `tool-map.json` / `tool-map.ts`: complete semantic mapping of all 123 illustrated Aether tool names.
- `COVERAGE.md`: each tool mapped to its exact FreeCAD equivalent or an Aether addition.
- `originals/`: unmodified FreeCAD source SVGs with all embedded credits.
- `pack.json`: full inventory, source paths/URLs, SHA-256, authors and license notices.
- `light/`, `dark/`: complete derived SVGs, displayed at 32px with transparent backgrounds.
- `build.py`: material/outline adaptation and unused-definition cleanup.
- `accent-overrides.json`: deliberate feature highlights on selected source shapes.
- `sources.zip`: downloadable originals, license texts and editable transformation source.
- `catalog.ts`: generated stable workbench-qualified IDs for UI consumers.
- `ATTRIBUTION.md` and `LICENSE-*`: redistribution notices and per-icon credits.

Do not flatten all artwork to one license: individual SVG metadata includes
LGPL and Creative Commons variants. Retain originals, credits, license notices
and the editable transformation source with distributions of this pack.

## Use

```tsx
import { FreeCADIcon } from '@aether/ui';
<FreeCADIcon name="PartDesign/PartDesign_Pad" palette="dark" />
```

Tool aliases also work: `<FreeCADIcon name="extrude" />` selects the upstream
extrusion artwork; `<FreeCADIcon name="transparent-png" />` selects the new Aether
illustration. `freecadToolIconMap` exposes all 123 aliases. Aliases reuse assets;
they do not create duplicate icons.

`palette="auto"` follows the nearest `data-aether-theme`; explicit light/dark
choices are available. SVGs load as separate assets, not embedded markup, so
FreeCAD's style/gradient IDs cannot affect another icon or application widget.
Images are lazy-loaded in the gallery, with 96 icons per page. Existing ToolIcon names/defaults do not
change; choose this component explicitly where FreeCAD artwork is desired.

Gallery: **Icons & Assets → Illustrated ribbon tools — FreeCAD Graphite**.
The page offers all 25 category filters, text search and pagination, and flat labelled icon grids in both
palettes. There is no decorative toolbar tray. `TechDraw/none` is an intentionally blank
upstream sentinel for “no decoration”; it remains available under its original ID.

## Rebuild

```sh
python3 core/assets/icon-packs/freecad-graphite/build.py
```

Requires Python with Pillow (colour parsing). No FreeCAD runtime or ignored
checkout is needed: inputs are preserved here. Original hashes are checked
before generating derivatives. Upstream source was read from the repository's
local `FreeCAD-main/` reference snapshot, not from an assumed current release.

## Aether additions

24 original designs cover mapping, smart tools and modeling actions with no
suitable equivalent in the imported collection. These are original Aether
artwork, not FreeCAD contributions, and are labelled separately in `extensions.json`
and in each generated SVG. The unchanged upstream files retain their original
licenses and notices. Shared monochrome UI glyphs are a separate icon collection;
this coverage audit targets the complete illustrated ToolIcon collection.

See `review-aether-additions.png` for all additions at 24px and 48px in both palettes.
