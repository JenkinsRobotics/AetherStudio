# Sketch parity finish gates

Owner: CAD. Updated 2026-10-14. Goal is active; full Onshape sketch parity is **not complete**.
This compact matrix supersedes stale architecture/remaining-work statements in
older dated entries of `CAD_Sketch_Parity.md`; those entries retain detailed evidence.

## Acceptance rule

A row closes only after canonical geometry/constraints, mounted interaction,
actual browser operation, undo/cancel, local-file save/reopen, and downstream
native feature rebuilding pass for its supported variants. A visible command,
unit-test count, or successful browser mesh alone does not close a family.
Failure must leave the previous drawing intact and explain the affected entity.
Shared Aether UI supplies presentation; CAD owns geometry and command meaning.

## Current matrix

| Workflow | Implementation/evidence today | Work to close the row |
| --- | --- | --- |
| Plane/face selection and continuous workspace | Plane/face/datum frames and same environment implemented; prior native fixture checks | Requalify reattachment and source-face edits with a populated part |
| Line, midpoint line and nodes | Chaining, midpoint construction and constrained nodes implemented | Browser chained/closed, center dimension, branch snap and reopen cases |
| Corner, center and aligned rectangles | Constrained shape, persistent center, optional square and numeric width/height; installed October 13 | Browser actual drag and aligned variant, snapped attachment edits |
| Circle and three-point circle | Canonical centers and three defining points; circle constraints/native cylinder round trip verified | Browser three-point dragging, snap/driver coverage |
| Circular and elliptical arcs | Three-point, center-point, tangent and elliptical variants implemented | Browser each gesture/direction, continuation, radii/axis edits and retained snaps |
| Ellipse | Exact ellipse, persistent center/axis dimensions and native ellipse/arc translation; source full-ellipse center/primary/secondary/rotation handles preserve untouched shape and constraints with undo/cancel/snapping/file/native proof (514 regression cases) | Actual browser/oblique-view/visual acceptance and installation; remaining annotations, partial-arc direct controls and complete driver/pairing variants |
| Conic | Source Part20 exact rational segment, automatic rho entry/Enter and early formulas in the existing Aether editor; real nodes, derived rho handle with scalar snapping, literal/linked driver edits (including same-contour followers), formula/Fix protection, undo/cancel/save/native proof; conic box references and control colors corrected. Exact transforms/projection/intersection remaps retained | Live browser/visual/oblique-view acceptance and installation; complete constraint pairings, driving-constraint-preserving split/trim, extension/offset and reference-lifecycle acceptance remain open |
| Fit and control splines | Cubic and interpolated open/periodic curves, insertion, dimensionable controls; installed finish/history improvements. Source Part18 adds independent open-spline end tangents, preserved fit knots/opposite handle during drag, ordinary dimensions/Fix, insertion/copy/undo/reopen and native swept-solid checks | Live browser/install qualification of end tangents; interior fit-point tangent editing, degree/knot/control editing, curvature display and remaining topology edits |
| Point, construction and text | Persistent point/construction and editable font-backed text implemented | Browser construction toggling, frame edits, copy/mirror/variables, font/script cases |
| Preselected constraints | Complete compatible sets; atomic solve and undo verified | Remaining entity pairings and external plane/axis references |
| Tool-first constraints | Repeated picks, cancel, retries, undo and projected targets implemented October 14 | Browser qualification for remaining constraint kinds, tangent/contact choice discoverability |
| Coincident/H/V/Equal/Parallel/Concentric | Sets compose canonical constraints; dimension drivers retained | Complete source-update, degeneracy and large-set acceptance |
| Perpendicular/Tangent/Midpoint/Normal/Symmetry/Curvature | Existing canonical pair relationships; symmetry third-axis picking | Full pairing matrix, finite-contact and singular/branch robustness |
| Fix/unfix whole entities | Source: whole geometry targets, native Block, common Unfix, copy/undo/file paths and Part17; 1,114 distinct regression cases pass | Live browser qualification and matching frontend/worker installation; continue complete entity/driver pairing matrix |
| Pierce | Source Part21 canonical sketch-curve/branch constraints, native B-rep/target validation and STEP. Interactive shared-window Shift+G/menu, preselection/repeated picks, exact source/branch markers, units, source repair/removal and source+target Undo/Redo/cancel/save now pass1,438 checks; ten real editor outputs rebuild and three STEP reopens verify location. Codec18 retained | Exact local target split/trim now qualified; saveable recovery after upstream source-edge/branch loss, solid curved-edge identity, actual browser/visual and installation acceptance remain open. Native validation is not full native equation solving |
| Dimensions and expressions | Driving/reference, unit conversion, formulas and linked dimensions implemented | Arc/ellipse/tangent/center spacing variants, full browser editing and overconstraint recovery |
| Snap/inference and dragging | Origin, points/centers/midpoints/quadrants/loci and projected snaps implemented | Every creation/drag pairing, suppression controls, overlapping-node priority, conflict recovery |
| Constraint management/diagnostics | Marks, selection/deletion, saved list and DOF diagnostics implemented | Filters, conflicting/redundant sets, per-entity colors and native-solver equivalence |
| Trim/extend/split/fillet/chamfer | Exact operations and substantial constraint remapping exist | Remaining finite-contact/control/topology remapping and browser batches |
| Offset/slot/mirror/pattern/transform | Associative common line/arc workflows exist | Ellipse/spline offsets/slots, topology changes, manipulators and remaining transform constraints |
| Use/intersection and references | Mixed projected/authored sketches and stable refs implemented | Cross-plane/solid edge/vertex sources, removal/relinking, intersecting topology and browser rebuilds |
| Copy/paste, DXF/DWG/image | Internal clipboard, DXF and product insertion exist | OS clipboard acceptance, partial edges, remaining import entities/formats and retained references |
| Sketch to Extrude/Revolve | Single/open-profile and all-region handoff; Part19 source integration adds saved contributor groups, shared Extrude/Revolve/Sweep/Loft controls, filled2D/3D picking, atomic cancel/undo/reopen and exact packaged native solids;1,015 distinct regression cases pass | Actual browser acceptance and matching frontend/worker installation pending Mac unlock. General intersecting/shared-edge regions and multi-region Revolve remain limited |
| Stress/regression and recovery | Existing deterministic corpus and focused native/browser proofs | Representative large constrained sketches, failure diagnostics, recovery and complete workflow regression |

## Architecture gate

FreeCAD is the default feature engine. Interactive sketch solving still uses the
existing browser solver; a native solid rebuild does not prove native sketch
solver equivalence. The PlaneGCS spike is not production and its mapping is
incomplete. New parametric algorithms belong in CAD's FreeCAD adapter, not new
investment in the parked engine. Existing operations can be composed at the
validated CAD command layer. Keep one saved geometry/constraint model and one
undo transaction path; never invent a second UI-only representation of a center,
relationship, or dimension. Any native extension needs explicit mapping of saved
references and backward compatibility before UI exposure.

## Work sequence

1. Finish qualification/installation of continuous tool-first constraints and
   all-region Extrude handoff. Keep explicit A/B editing and approved FeatureWindow.
2. Complete whole-entity Fix/unfix through the native-backed sketch contract;
   inspect the existing PlaneGCS mapping and its unsupported corpus first.
3. Close spline/conic/Pierce capability gaps through that same contract.
4. Qualify remaining creation, snap/dimension/reference and modification families.
5. Run the complete create → constrain → dimension → edit → extrude/cut → reopen
   corpus, including realistic multi-sketch parts and failure recovery. Only then
   consider the goal complete; open rows are not silently waived.

## Official references checked October 14

- [Sketch tools and sketch-to-feature behavior](https://cad.onshape.com/help/Content/Sketch/sketch_tools.htm)
- [Constraint workflows and catalog](https://cad.onshape.com/help/Content/Sketch/working_with_constraints.htm)
- [Equal](https://cad.onshape.com/help/Content/Sketch/equal.htm)
- [Fix](https://cad.onshape.com/help/Content/Sketch/fix.htm)
- [Conic](https://cad.onshape.com/help/Content/Sketch/conic.htm)
- [Pierce](https://cad.onshape.com/help/Content/Sketch/pierce.htm)
- [Spline](https://cad.onshape.com/help/Content/Sketch/spline.htm)

## October14 spline interaction qualification

Double-click, in-world Enter, viewport Confirm spline and unfinished-point
Backspace/undo/redo are installed.350 distinct tests and actual production
browser/FreeCAD closed-spline edit/rebuild pass. Native volumes agree with an
independent integral of the cubic curves. This closes those gesture gaps only.
Existing fit-spline tangent dragging can move other unconstrained fit points;
independent tangent parameterization remains open. Whole-curve Fix still needs
the native-backed contract: solved-wire native rebuilding is not native
constraint solving, and the incomplete PlaneGCS spike is not production.
Evidence: `../Aether-CAD/.verification/sketch-spline-2026-10-14/RESULTS.md`.

## October14 whole-entity Fix / native ellipse source qualification

Whole curve Fix, common Unfix, whole fit-spline/full-ellipse selection, exact native
ellipse/arc mapping and Part17/codec14 are implemented.1,114 distinct tests, types,
frontend/worker builds and scoped lint pass. Actual native Block constraints,
analytic geometry and isolated file/project roundtrip are verified. The Mac is
locked, so live browser acceptance and installation remain pending; this row is
not closed. Frozen frontend/worker and resume instructions:
`../Aether-CAD/.verification/sketch-fixed-geometry-2026-10-14/RESULTS.md`.

## October14 interactive sketch-curve Pierce qualification

Source/branch selection and repair now use the approved shared window and ordinary
sketch transaction. Tests cover real selected/repeated targets, overlapping contacts,
center/edge/control distinction, units, missing-source repair, native source updates,
and reparented 3D surface picking. A valid support face stays attached during unrelated
Pierce repair.1,438 distinct checks/types/build/scoped lint pass. Frozen candidate:
`../Aether-CAD/.verification/sketch-pierce-ui-2026-10-14/RESULTS.md`. Actual CUA is
locked; visual/browser qualification and installation remain pending. Source scope
is earlier sketch curves; solid curved-edge reference identity remains open.

## October14 Pierce target topology qualification

Finite Pierce targets now remap through exact Split/Trim across line, arc, ellipse,
cubic and conic pieces. Circle contacts attach to the actual retained arc; centers
and scaled controls retain their semantics. Shared editor Undo/Redo/cancel/save
and36 saved native fixtures pass.1,446 distinct checks/types/build/scoped lint pass.
Evidence: `../Aether-CAD/.verification/sketch-pierce-topology-2026-10-14/RESULTS.md`.

Upstream source-edge replacement still refuses orphaned dependencies. Complete
saveable error/repair lifecycle and solid-edge identity remain open; local target
remapping does not close reference parity. Actual browser/install await Mac unlock.
Bezier degree/control editing is also a substantive gap: canonical controls remain
cubic-only, whereas the official reference permits degree15. A real extension needs
exact adapter, node/constraint and guarded persistence/native support. References:
[Bezier](https://cad.onshape.com/help/Content/Sketch/bezier.htm),
[Trim](https://cad.onshape.com/help/Content/Sketch/trim.htm).
