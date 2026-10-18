# Shared vector coverage — 2026-09-29

This is an implementation inventory, not Adobe/Affinity parity sign-off. The
universal package is `core/sketch` (`@aether/sketch`); Aether UI supplies presentation.
Measured package consumers: Aether Sketch, Aether Map and Aether CAD. Aether Vector
is still a Coming Soon shell and has no authoring engine to migrate yet.

## Shared conceptual model

Jonathan clarified the intended boundary: a surface starts with the same kind of
2D sketch/contour used for a CAD profile. A valid closed contour encloses a **2D
region**, not a 3D volume. Open paths remain editable geometry. A region can have
an outer boundary and inner holes, with an explicit fill rule and tolerance.

```
points / lines / curves → paths → closed contours → validated planar regions
                                                        ├─ CAD: profile → solid/surface features
                                                        └─ Map: projection region → warp + content
```

Shared compound contours and polygon-region Boolean construction now ship in
`core/sketch`, exercised in Sketch. Explicit tolerance, closure/degeneracy checks,
fill rules and holes stay independent of CAD constraints and projection state.
General analytic topology and pathological self-crossing winding remain outside
this drawing-region implementation. Simply connecting a final point does not make every outline a valid region.
CAD retains exact analytic geometry and constraints; do not polygonize its conics
through the current cubic-only path adapter. Product adapters own units, plane/
scene placement, commands, undo, persistence and feature/projection meaning.

## Actual coverage

| Capability | Sketch | Map surfaces | CAD 2D sketch |
| --- | --- | --- | --- |
| Pen/shape creation | Shared gestures | Shared gestures; closed regions for surfaces | Existing product tools; not all shared adapters |
| Editable ellipses | Four cubic arcs | Four cubic arcs for new drawings; existing polygon ellipses preserved | Product analytic ellipses retained |
| Node insertion/curve editing | Shared retained cubic edits | Shared retained cubic edits | Existing product spline/point tools |
| Corner/smooth/symmetric handles | Shared node modes | Same modes, now retained at creation and saved | Product tangent/handle constraints; no common node-mode adapter |
| Alt independent / Shift angle handles | Shared behavior | Shared behavior applied to mask control drags | Existing constraint-aware behavior, not certified identical |
| Point/axis snapping | Shared selection and guides | Shared nearest-point helper plus product weld/bounds policy | Shared nearest point/axis helpers plus product inference |
| Reverse contour | Shared | Shared, exposed in point inspector | Product contour semantics |
| Open paths / break / join | Shared tools | Masks stay closed; open authoring model not implemented | Existing product open/closed profiles |
| Trim / offset | Shared drawing tools with stated approximations | Not exposed as generic profile operations yet | Existing product trim/extend/split/offset, solver-owned |
| Groups / transforms | Nested groups and shared transform math | Scene/component groups; common resize math, projection-owned geometry | Product feature/constraint-aware transforms |
| Vector paint | Shared solid/linear/radial fills; stops, alpha, strokes, appearance sampler, live clipping | Same gradient contract and UI for colour inputs, scene tracks and output; shaders remain product-owned | No change to feature materials or solver profiles |
| Compound regions / holes / Boolean operations | Shared compound geometry and tolerance-based polygon Boolean commands | Combine/release surfaces, holes and fill rules; shared clipping/picking/output and worker commands | Independent Boolean copies of line/Bézier contours; exact conics rejected, source constraints retained |
| Editable text / SVG import | Product text model and supported SVG import, shared pure path parser | SVG closed curves/transforms/compound holes via shared normalization; existing editable visual text and cached-alpha text silhouettes | SVG line/Bézier contours with explicit mm scale, Y inversion and CAD nesting validation; existing retained CAD text |
| Autosave / recovery | Account/project/tab-scoped local browser drafts; v2 document upgrades v1 | Existing product persistence | Existing product persistence |

## This adoption pass

Map no longer discards the shared pen's node modes. Its new ellipses retain four
anchors, eight handles and smooth-node modes rather than 48 line segments. The
surface adapter uses exact cubic extrema for its enclosing warp quad, preserving
authored controls and modes. Existing v3 documents remain unchanged on load.
Alt-drag decouples a handle, Shift constrains its angle, and reversing/straightening
an outline goes through common path operations. Straightening resets the affected
node modes to corner so the displayed mode matches the geometry.

Evidence: `aether-map/src/mask/{tools,curves,shape-surface}.ts`, `SurfaceCanvas.tsx`,
`useSurfaceInteraction.ts`, `MappingControls.tsx`, `App.tsx`; product unit and browser
coverage. CAD audit references `src/sketch/{tool-instructions,constraint-panel,
spline-handle-controls,drag-snapping,picking,svg-geometry}.ts`. CAD's capabilities
listed as existing product tools were inspected, not newly certified end-to-end.

Limits inherited from the current drawing engine: cubic conic approximations,
sampled cubic trim crossing parameters, polygonized offsets that reject complex
crossings. The polygon region contract must not advertise these as exact CAD geometry.

## Vector paint adoption

Both products consume `core/sketch/src/paint.ts`; `core/ui/GradientControls`
is presentation-only. Sketch keeps editable clipping boundaries in its existing
group tree and exports retained SVG paths/defs. Map persists optional gradient
metadata in both continuous and timeline sources; colour, shader and media remain
alternative inputs of the same mapped surface. Preview and output share rendering;
Mapping mode continues to suppress visual sources. Sketch now exposes compound holes, polygon Booleans, editable text and supported
SVG import. Map and CAD now adopt applicable contour operations through their own adapters.
Raster brushes, exact analytic Booleans and complete SVG fidelity remain unfinished.

## Map/CAD integration — 2026-09-29

Map: select surfaces (or a group) in Layers, then Properties → Combine vector
surfaces. Union/Subtract front/Intersect/Exclude replace the selection in one
undoable edit; the backmost source supplies content. Make compound retains curves,
fill-rule controls holes, and Release compound preserves the original projection
for each piece. Node handles edit every contour. Static transforms are baked into
the operation; locked/hidden surfaces, cross-scene selections, alpha silhouettes,
bends and animated operands reject rather than silently lose their meaning.
Clipping and picking share the fill rule; preview/output/reload retain holes.
The optional v3 `maskFillRule` preserves old documents' independent-union behavior.

CAD: Sketch → Vector tools imports SVG through the same pure shape/path parser.
The adapter creates existing CAD line/Bézier entities, normalizes the viewBox
origin, flips SVG Y-down to sketch Y-up, and applies an explicit mm/source-unit
scale (96-DPI default). CAD's existing exact nesting helper rejects touching or
ambiguous compound boundaries. Even-odd and nonzero nesting retain appropriate
holes without flattening imported Bézier contours. SVG arcs become cubic curves,
which the panel states; native analytic entities are never routed through this
conversion. Editable CAD text and autosave remain native product workflows.

Select contours on the canvas or in the Vector tools list for Union/Subtract/
Intersect/Exclude copies. Outputs are independent polygon contours at an explicit
mm tolerance; input entities, IDs and constraints remain untouched. Exact conics,
construction geometry and preexisting hole operands reject these vector-copy
commands. Use CAD modeling features for analytic Boolean operations. Both products
run Boolean work in bounded workers and refuse stale results after document edits.

Geometry import is not a visual SVG renderer: text must be outlined in the source
or authored with the destination's Text tool; external resources, nested SVG
viewports and clipping/filter/mask effects require expansion and report warnings.
Sketch retains its richer text/paint importer over the same geometric factory.
No new shared product storage, font engine or solver was introduced.

## Immediate drawing refinements — 2026-09-29

Sketch provides numeric X/Y editing for anchors and handles, using shared point
translation and coupled-control helpers. Compound closing-handle selection uses
the active contour's node count. A two-screen-pixel selection drag threshold
prevents click-only geometry drift and undo pollution. Shared trim intersections
now include compound cutter holes; Sketch excludes editable text bounding boxes
from cutters. Precision editing, coupling, undo/redo and save/reopen are browser
verified. General trimming of a compound target is still not exposed.
