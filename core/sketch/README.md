# @aether/sketch

Shared 2D sketch geometry and drawing gestures. No React, DOM, rendering,
product documents, CAD kernels, solvers or global mutable state.

- Retained `SketchPath`: anchors, optional outgoing cubic controls and node modes, open/closed.
- Exact de Casteljau splitting; adaptive flattening and edge picking.
- Anchor movement carries handles; topology edits retain untouched edges.
- Point/axis/grid snapping; exact cubic bounds; common resize and rotation helpers.
- Smooth/symmetric/independent handles, reverse/break/join, trim and contour offsets.
- Transform, rectangle/ellipse/polygon construction, simplification, containment,
  segment distance and SVG path/three-point arc presentation.
- Pure pen/shape/freehand gesture state machine with explicit tool options.

Coordinates use the caller's document units. No implicit pixel rounding.
Distances, areas, closure and simplification tolerances are adapter policy;
`coordinateStep: 0` retains input precision. `curveTolerance` uses those same
units. SVG consumers own screen transforms and CAD's Y-axis inversion.
Ellipse tools produce four cubic arcs (not exact conics); adapters can request
legacy sampled polygons. Trim samples cubic intersection parameters and splits
the retained curves exactly at those parameters. Offset contours flatten curved
input at the caller tolerance; collapsed/self-crossing offsets reject instead of
attempting Boolean cleanup. These are drawing operations, not CAD constraints.

Consumers:

| Product | Current use |
| --- | --- |
| Aether Sketch | Drawing adapter: gestures, snapping, node/path editing and transforms |
| Aether Map | Same gestures, retained cubic ellipses, node modes/modifiers and reverse outlines; product-owned projection/welds |
| Aether CAD | Sketch picking/containment, point/axis snapping and SVG arc presentation; constraints and exact geometry stay in CAD |

`npm ci && npm test && npm run typecheck` in this directory.
Source exports are compiled by each Vite consumer; there is no independent
bundle to go stale. Each product declares a local package dependency.

This is a vector foundation. GPU painting, pressure/tilt brush simulation,
PSD interchange and complete migration of CAD's authoring adapters are planned
in `dev/docs/roadmap/Aether_Sketch_Standard.md`.

Coverage and the planned contour-to-region boundary are recorded in
`dev/docs/reality/Shared_Vector_Coverage.md`. A valid closed contour defines a 2D
region, not a 3D volume. Compound contours retain their cubic geometry and fill
rule. `regionPolygons` and `booleanPaths` construct polygon regions with holes and
union/difference/intersection/xor at an explicit caller-unit flattening tolerance.
These are drawing-region operations, not exact CAD topology. `parseSVGPath`
normalizes path commands/transforms to retained lines/cubics without DOM access.
The product owns SVG document parsing and sanitization. Dependencies and retained
licenses are recorded in `THIRD_PARTY_NOTICES.md`.

## Vector appearance

`VectorGradient`, `GradientStop`, `VectorAppearance`, `isVectorGradient`,
`gradientVector` and `strokeDash` define portable vector paint without a renderer
or UI dependency. Sketch and Map consume the gradient contract. Aether UI's
controlled `GradientControls` widget presents it without importing this package.
Map owns shader execution, scene placement, projection and content timing.

`svgElementPaths` normalizes inert basic-shape attributes, while `readSVGGeometry`
walks a plain element descriptor tree with inherited transforms/fill rules and
bounded complexity. Neither uses DOM or mounts SVG. Map and CAD supply their own
DOM adapters and scene/plane/unit policies; Sketch shares the geometric factory
under its richer paint/text importer.
