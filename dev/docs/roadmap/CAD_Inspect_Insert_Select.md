## Installed update — 2026-10-13

`cad-tools-20261013-r2` is active on localhost:8780. Existing four construction
plane methods now have atomic Apply/Cancel, geometric validity checks and working
historical edge/vertex picking. Remaining construction expansion is still open.
 Select now includes functional
Window/Freeform/Paint, Tools, Body/Face/Edge Priority and Filters. Insert retains
SVG/DXF/CAD/Mesh/Canvas/planar Decal plus guided McMaster STEP import from r3.
Inspect retains native Measure/Section/Interference/Properties. Four dimensioned
primitives now create editable native histories. Unconnected catalogue entries no
longer render in ribbons or menus. See the CAD tools RESULTS evidence and STATUS.

The missing Construct methods and specialty modeling listed below remain required;
removing placeholders does not complete those capabilities. Website download capture
remains a separate shared adapter; McMaster currently requires selecting the downloaded
STEP. No percent-complete claim. Existing historical entries below record earlier slices.

# CAD Inspect, Insert and Select completion audit

User requirement, 2026-10-13: these are functional sections, not placeholder menus.
A screenshot establishes the requested catalog and presentation; it does not prove
that Aether has implemented the underlying commands. Completion requires a real
command, applicability/selection handling, persistence or transient cleanup as
appropriate, undo for edits, failure handling, and browser verification.

## Inspect

| Capability | Current evidence | Remaining acceptance |
|---|---|---|
| Inspect / Measure | Selection panel measures points and topology, including units and angular readouts | Live exact model end-to-end qualification |
| Section | Native part-analysis request, clipping preview, cleanup and error tests | Live multi-body section and close/cancel qualification |
| Physical properties / center of mass | Existing volume, area, center, bounds, mass reporting | Qualify native output and units; avoid duplicate Center of Mass command |
| Interference | Existing part-analysis service action | Live overlapping/nonoverlapping body cases |
| Curvature comb/map, draft, zebra, isocurve, environment map | Not implemented as CAD analysis tools | Native geometry/renderer implementation and numerical checks |
| Accessibility/minimum radius | Not implemented | Define analysis contract and implement |
| Navigator/component colors/mesh face groups/history | Review existing viewport and history controls before adding duplicates | Document distinct behavior or reuse existing controls |
| Sustainability | No assessment data/model | Not a valid numerical analysis until supported inputs/data exist |

## Insert

| Capability | Current evidence | Remaining acceptance |
|---|---|---|
| SVG | Existing Sketch Vector Tools parser, scale, validation and undo; now connected to Insert SVG | Active-sketch and saved/reopened contour browser case |
| DXF | Existing sketch-plane import, units, layers and placement | Saved/reopened drawing acceptance |
| Mesh / CAD | Existing STEP/IGES/BREP and STL/OBJ/PLY/OFF import path | Verify imported feature and save/reopen/export for supported formats |
| Canvas | No persistent plane/image reference model | Implement image assets, calibrated size, placement, visibility, undo and save/reopen |
| Decal | No face-attached image model | Implement attachment, placement, projection, appearance, persistence and undo |
| Component | Assembly insertion exists separately; Part insertion not implemented | Define instance/reference behavior instead of aliasing solid import |
| Fastener | No fastener library/workflow | Implement geometry source, dimensions, placement and persistence |
| Duplicate with joints | Not implemented | Clone instances and joint references atomically with undo |
| Derive | No linked derived-feature lifecycle | Source revision links, update and broken-link behavior |
| McMaster-Carr / manufacturer / TraceParts | No connected catalog adapters | Provider access and format import integration; do not simulate search/results |

Release scope, updated 2026-10-13: unsupported operations are excluded from the
working menu. Import CAD (including mesh formats) and SVG are the two primary
icons; DXF is the third dropdown entry. SVG/DXF require an open sketch. Mesh uses
the existing geometry importer without a redundant menu alias. Canvas, decals,
linked derivatives and provider catalogs remain future work in the table above.

## Select

| Capability | Current evidence | Remaining acceptance |
|---|---|---|
| Body/face/edge/vertex/component filters | Existing selection store, picking and topology IDs | Live applicable-model checks |
| Auto | Currently maps to Body | Implement context-sensitive priority or consolidate; do not claim smart selection |
| Directional selection | Existing left-to-right window / right-to-left crossing | Browser regression |
| Explicit Window / Crossing | Added store-backed mode commands; direction-independent containment semantics and cancellation of in-flight box | Browser drag acceptance |
| Clear selection | Added command clears canonical selection | Browser acceptance |
| Freeform | Missing | Screen-space lasso path, containment/intersection, overlay and modifiers |
| Paint | Missing | Brush radius, sampling, stroke deduplication, add/remove and cancellation |
| Next Filter | Cycles the same filters | Convenience shortcut, not a separate selection mode |
| Selection tools / priority / filters submenus | Current flat filter menu | Group real commands after behavior qualification |

## Integration constraints

Viewer/main and selection hit handling currently have an active viewport-menu
claim; do not overwrite it to implement lasso, paint, Canvas or decals. Request
an explicit handoff of those integration points. New modeling semantics belong
to the product/native adapter, not shared UI or new investment in the parked
browser engine. External catalogs require real provider access, not placeholder
success responses. Inspection UI and Insert/Select work are not yet all deployed.

## Core release scope

The user prioritizes useful working core tools over placeholder breadth. Inspect
retains measurement, Section, physical properties and interference; the panel no
longer advertises unavailable curvature analysis. Select retains real selection
modes, filters and Clear; the redundant Next Filter menu entry is removed (its
command remains available). No numerical completion percentage is asserted.
The end-to-end acceptance gaps above remain explicit; catalog cleanup alone is
not proof that every workflow has passed live native persistence qualification.

## Construction scope — 2026-10-13

Jonathan's Construction reference establishes the intended functional scope,
not merely menu labels. Keep one Construction ribbon control and group its menu
by coordinate system, planes, axes and points. Existing authoring supports Offset,
Midplane, Three Point and Angle; editing must retain method and angle. These
existing document contracts currently live in the legacy CAD document package;
new semantics must be developed in the owning native product adapter instead of
expanding that parked engine.

Required additional workflows:
- User coordinate system: origin, orientation and downstream reference use.
- Planes: tangent, perpendicular, through two edges, along path.
- Axes: cylinder/cone/torus centerline, face-normal, two-plane intersection,
  through two points, through an edge.
- Points: vertex, two-edge intersection, three-plane intersection, analytic
  circle/sphere/torus center, edge-plane intersection, along path.

Every operation requires typed persistent references, geometric applicability
checks (including parallel/skew/degenerate cases), preview, undo/cancel, tree and
viewport presentation, edit/recompute and save/reopen tests. Never represent an
axis/point as a hidden solid or disconnected visual decoration. Native capability
contracts and renderer integration are prerequisites; the viewer/main lane is
currently actively claimed. This audit and the saved-plane edit repair do not
implement those additional operations.

## Insert help and supplier access — 2026-10-13

Implemented a catalog-assisted McMaster-Carr workflow: open the official catalog,
download a STEP file, choose that file in the CAD dialog, then use the normal
validated atomic importer. This is not an embedded catalog, API integration or
assembly component insertion. Official API documentation requires approved-customer
credentials and a client certificate: https://www.mcmaster.com/help/api/ . CAD
models/downloads are described at https://www.mcmaster.com/cad-models . No supplier
credentials are collected, scraped or stored by this workflow. API-based automatic
integration needs approved credentials and a host-side secret/certificate adapter.
That requirement does not apply to the separate planned browser/download-capture
path Jonathan requested on2026-10-13. See
[shared website integrations](Aether_Architecture_Integration.md#website-integrations--jonathan-2026-10-13-planned):
the real McMaster site opens in Aether, completed STEP downloads are saved into the
initiating project, then handed to the existing validated importer. Reuse the same
browser/download service as Map's media integrations; keep CAD import semantics
in CAD. This is planned, not implemented by the current manual-selection dialog.
No supplier credentials should be pasted into chat.

Shared ToolHelp provides delayed pointer and immediate focus instruction cards
for ribbon/menu entries. CAD supplies initial operation instructions. Canvas and
Decal remain missing: requires document asset schema, bounded image decoding,
plane/face reference placement, scale/opacity, preview, history/undo, persistence
and renderer tests. Current environment lane owns the relevant viewer/plane files;
coordinate integration rather than inserting an unsaved viewport-only image.

Select presentation, 2026-10-13: implemented method rows, Selection Tools/Clear
and Selection Filters submenu using shared selection-style icons. Priority is
intentionally not an alias for exclusive filters. True priority, Freeform/Paint
and their shortcuts remain functional implementation work, omitted from this
working menu under the user's no-placeholder requirement.

Construction correction, 2026-10-13: removed unconnected Align/Path/Profile/Reuse/
Curve/Point/Coordinates placeholders. The four existing plane methods are now
individual menu commands opening the correct editor mode. This is the working
subset; the requested additional axes/points/UCS/plane methods above remain the
implementation target, not a completed capability or a placeholder menu.


### CAD Insert tools —2026-10-13

Insert now exposes SVG and Canvas as its two primary icons and seven connected commands: SVG, Canvas, planar Decal, CAD import, Mesh, McMaster-Carr and DXF. SVG/DXF create editable profile features on a selected principal plane with explicit source-unit scaling; no pre-opened sketch is required. Mesh uses the existing native STL/OBJ/PLY/OFF importer and unit/solid-conversion controls. McMaster remains catalog-assisted STEP import, not automatic authenticated downloads.

Canvas/Decal images are embedded optional `imageCanvases` Part presentation metadata, validated on parse/save. PNG/JPEG/WebP, principal-plane canvas placement, size/position/rotation/opacity, edit/hide/remove, stale-editor refusal and normal undo are supported. Images do not rebuild solids. Planar decals resolve a body/normal/optional face anchor and clip against the actual face triangles; missing/ambiguous faces are not substituted. Curved-face wrapping is not implemented. Images are cosmetic/reference presentation, not STEP geometry.

Verification:61 focused tests; SVG+DXF save/reopen/extrude native acceptance with exact6000/1000mm³ volumes; typecheck/Vite build. Full CAD run1098 passed with one stale environment-panel assertion; corrected to current Presets/Advanced controls and its23-test shell/environment rerun passes. Existing native integration tests in the default full suite remain opt-in; the new vector native check ran explicitly. Browser verified seven menu commands, actual canvas upload/render, reopening, removal and normal undo. No user document was used.

CAD-only immutable frontend `cad-insert-20261013-r3` is installed on8780. Initial launchd registration failed; the previous service was restored, then the bounded retry succeeded. Healthy service and exact installed configuration verified. Native binary, product workers, shared session, other apps and database retained; database process not restarted. An already-open CAD page must reload to acquire the new frontend. Construction expansion and broader feature parity remain unfinished.
