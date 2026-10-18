# Aether CAD Part-development parity

Assessment: 2026-09-12. Jonathan's order is complete Part development first,
then assemblies, drawings and later analysis. This is a roadmap, not shipped
status. No percentage of parity is asserted: tool counts hide missing workflows.

Post-integration review, later 2026-09-12: the reliability/export implementation
from P0/P1 is integrated and the normal service/build updated. Shared-backend
native and isolated-account browser acceptance passed; authenticated production
document acceptance and Jonathan's real-part sign-off remain open. The table
below has been refreshed from current source while another contributor refactors
the UI. Organizational refactoring is not additional modeling capability.

## Scope and engine strategy

Later preview update (2026-09-12): native previews for all currently available
solid editors are now implemented, with explicit one-region labels, debounced
stale-safe requests and Cancel/Apply separation. The remaining "preview" work
below means richer interaction (handles/opacity) and broader options, not absence
of a rendered solid. New Extrude now supports multiple regions and enclosed holes, and STEP import
persistence plus Part section/interference are implemented; see the latest STATUS
entry for tested scope and current size/geometry limits.

Target practical parametric mechanical-part authoring using FreeCAD's Sketcher,
Part Design and necessary Part capabilities. Aether owns selection, interaction,
document references, persistence and transport. FreeCAD performs the native
operations. Keep new feature investment out of the parked TypeScript solid
engine; use the existing sketch solver until a tested replacement is ready.

FreeCAD's broader application includes separate workbenches and dependencies;
loading its headless process does not expose all application commands through
our JSON boundary. Assemblies, drawings and FEM each need their own data,
commands and acceptance. See [FreeCAD's feature inventory](https://www.freecad.org/features.php)
and [PartDesign API](https://freecad.github.io/SourceDoc/df/d14/namespacePartDesign.html).
For Aether Animation, retain the separate aether_animation ownership in AGENTS.md.

## Current-source findings

| Area | Evidence today | Remaining gap |
|---|---|---|
| Sketching | Drawing tools, dimensions, constraints and contour selection; interactive solving remains Aether's solver with a PlaneGCS comparison hook. | Complete supported-geometry/constraint mapping and user diagnostics. Elliptical arcs and projected profiles are explicitly refused by the FreeCAD translator. |
| Regions | Stable IDs; new Extrude supports several regions, enclosed holes and independent disconnected bodies, with native previews and save/reopen. | Crossing/intersecting arrangements; output identity repair after topology changes; equivalent compound selection for Revolve/Sweep and multi-solid import splitting. |
| Extrude/revolve/cut | Extrude: blind, total-depth symmetric, through-all Remove, signed starting offset, opposite blind depth, live preview and direct Cut ribbon. Native reversal/new/add/cut/body targeting. | Up-to-face/next, symmetric through-all, non-blind opposite ends, draft and richer preview handles. |
| Native backend | Independent body IDs, validation, frames, native Sweep/Shell, worker timeout/restart and robust JSON framing integrated. | Broader pathological geometry/long-session acceptance and capability-driven toolbar gating. Do not relist the former single-body/missing-Sweep bugs as current gaps. |
| Sweep/Shell | Native execution and dialogs exist; shell and failure recovery have browser acceptance. | Sweep path-contour picker and broader path/orientation options; direct shell face selection. No complete browser-authored sweep acceptance claimed. |
| Face/edge references | New face-picked sketches reference a body/history snapshot and follow a unique oriented planar face; native resolved frames persist and attached sketches can reselect support. Legacy frames stay fixed. | General topological naming across rotations/splits/merges, multiple parallel faces, broader projected geometry dependencies and richer repair. Directional planar matching is not universal face identity. |
| Modification tools | Fillet/chamfer all-edge or plane filters, shell plane selection, partial mirror support. | Direct edge/face selection, Hole/counterbore/countersink, solid-feature patterns, Loft, Draft and body Boolean/split tools. Sketch patterns do not provide solid-feature patterns. |
| History/recovery | Edit, rollback, native save/reopen, session undo/redo, strict rebuild errors and tested same-worker invalid-fillet recovery. | Broader dependent-feature edits, suppress/delete/reorder fixtures and long-session resilience. Undo is session-local. |
| Delivery | Saved original STEP import features and native history, plus exact STEP and closed STL exports; all/one body selection, mm units and mesh tolerance; native roundtrip checks pass. | Jonathan's actual manufacturing-part acceptance; drawing/PDF/DXF outputs and broader interchange remain separate work. |

Part analysis now provides principal-plane capped sections and pairwise native volume interference across body features. Assembly placements, compound-internal pairs and broader analysis are separate work. Embedded imports currently cap at 3 MiB/file and 4 MiB serialized Part.

Source anchors: `Aether CAD/src/freecad-translate.ts`,
`src/features/{extrude,sweep,shell,edge-finish}.ts`, `src/sketch-workspace.ts`,
`src/react/CADPartExportDialog.tsx`, `src/tools/solid.ts`,
`aether-engine/src/sketch/solver/solve.ts`, and
`freecad-engine/aether_freecad/{worker,engine,topology,exporting}.py`.

The prior isolated acceptance report is at
[`2026-09-12-cad-modeling-review.md`](../../briefings/tasks/2026-09-12-cad-modeling-review.md).
Its patch is historical: the shared backend already contains the reconciled
implementation. The report's original pending-integration wording is superseded.

Refactor snapshot: toolbar definitions live under `src/tools/`; panel components
under `src/react/panels/`. The shell still has about 1,200 lines, main about 1,400,
and viewer about 2,000. Finish the bounded refactor with unchanged-behavior tests;
future extractions should follow actual subsystem boundaries, not line counts.
Do not mix this review's future feature work into another contributor's active
refactor files.

## Delivery order and acceptance gates

### P0 — One trustworthy modeling loop

Reconcile current worker changes with the isolated candidate, preserving the
new wire/closed-profile work. Integrate body IDs/targets, strict diagnostics,
frame handling, Sweep/Shell and timeout/restart. Drive toolbar availability
from an explicit engine capability contract so an enabled button cannot imply
a missing operation. Keep unsupported operations visibly unavailable.

Acceptance: from the normal host, draw two regions, make two bodies, cut only
one, edit the first extrusion, shell, save/reopen, rollback, undo/redo and
recover from an invalid operation. Assert body IDs, solid count and dimensions;
no silent partial rebuild, wrong target or indefinite busy overlay.

### P1 — Deliver one real part

Add native STEP and STL export through FreeCAD, with chosen bodies, units and
mesh tolerance. Export rebuilds from the same saved feature definition and
does not export a stale display mesh as an exact part.

Acceptance: a dimensioned mounting plate with four independently cut holes
exports and reimports with expected dimensions, solid count and volume; STL
is closed/manifold within the chosen tolerance. Change dimensions, export
again, verify the change and reopen the native document. This is the first
practical-use milestone, not full feature parity.

### P2 — Repeated parametric modeling

Add persistent sketch support references, projected/external geometry links,
direct face/edge selection and repair of missing/ambiguous references. Add
compound regions with holes and multiple selected regions; preserve region
identity through non-destructive sketch edits. Add extrusion preview,
through-all, up-to-face and symmetric modes using the same native evaluator.

Acceptance: sketch on a boss face, cut through it, increase the base thickness
and move the supporting face. The sketch follows its support and the cut
remains through-all. A deleted support requests repair. A washer extrudes with
its central hole in one feature; disjoint and intersecting-region cases have
explicit, tested behavior. Preview and Apply agree; Cancel leaves no feature.

### P3 — Common mechanical feature coverage

Add Hole with counterbore/countersink, linear/circular feature patterns,
complete mirror, selected fillet/chamfer/shell, and body union/cut/intersection.
Then Loft, Draft and broader Sweep/Revolve options. Specify thread needs
before implementing cosmetic or modeled threads. Make parameters/expressions
drive features consistently; finish the solver mapping against the existing
constraint corpus without changing the meaning of saved sketches.

Acceptance: flange, mounting bracket, enclosure/lid and swept duct fixtures;
each can be created, dimension-edited upstream, recovered after an invalid
edit, saved/reopened and exported. Add feature/schema/native/browser checks
per tool; a worker-only success is insufficient.

### P4 — Part parity sign-off, then assemblies

Publish a capability matrix for the chosen FreeCAD mechanical-part scope.
Include imported-body modification, datum/reference geometry, measurements,
mass properties, units, visibility, dependency changes and failure repair.
Mark unsupported advanced/surface/sheet-metal workflows explicitly; do not
silently redefine full FreeCAD parity as the small initial tool set.

Promote to assemblies when the agreed Part fixture corpus and Jonathan's
actual part pass on the normal installation. Assembly work then covers linked
parts/revisions, occurrences/transforms, constraints/joints, updates and BOM.
Drawings cover associative views/sections/dimensions and export. FEM is a later
project with materials, loads, mesh, solver integration and result validation;
it does not follow automatically from having solid geometry.

## Immediate next packet

**P2: reliable face-attached sketch → cut → upstream edit.** Save support
references, resolve them during rebuild, preserve selected-face intent and show
repair when a reference disappears. Extend the same reference contract to
projected geometry and up-to-face extrusion. Add through-all/symmetric depth
and preview with explicit acceptance tests. Compound regions with inner holes
are the next closely related slice; begin with nested closed loops before
arbitrary intersecting-region subdivision.

Acceptance: sketch on a boss face, make a through-cut, change the base thickness
and the supporting face position, then save/reopen and export. The sketch stays
attached and the cut remains correct; deleting support prompts repair rather
than quietly using an old world-space frame. This is the strongest next step
toward daily primary-CAD use. P0/P1 are implemented; do not restart them because
of the historical planning text above. Full Part and full-suite parity remain
open.
