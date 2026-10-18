# FreeCAD mechanical CAD parity and reference retirement

Assessment: 2026-10-03. **Not complete; do not retire the reference as evidence
that inheritance is finished.** Jonathan requires full CAD, Assembly and Drawing
workflows, not matching icons, tool counts, or an installed kernel.

This is the suite-wide acceptance index. Existing detailed Part, Sketch,
Assembly and Drawing roadmaps remain the implementation contracts. Their old
dates and completed individual packets must not be mistaken for whole-workbench
completion. Shipped behavior remains in `../reality/STATUS.md`.

## Baselines and what “remove the reference” means

- Installed executable: FreeCAD **1.1.3**, exercised through our native worker.
- Local source reference: `FreeCAD-main/version.json` says **26.3.0 dev**.
  It is an extracted, ignored source tree, not a pinned release checkout. It
  must not silently define the same baseline as the installed executable.
- `FreeCAD-main/` and `FreeCAD-main.zip` are development reference material.
  Our worker launches installed `freecadcmd`; it does not execute this checkout.
- `Aether CAD/freecad-engine/` is our active adapter, **not disposable reference**.
  Installed FreeCAD, its replacement override, and attribution remain required.
- FreeCAD-derived artwork has its own sources and notices under
  `core/assets/icon-packs/freecad-graphite/`; reference cleanup must preserve them.

Freeze both runtime and source baselines before a final parity comparison.
These SHA-256 fingerprints identify the source read during this audit:

| Reference file, relative to `FreeCAD-main/` | SHA-256 |
|---|---|
| `src/Mod/PartDesign/Gui/Workbench.cpp` | `63356d589386086072885e1ecdee130835a089d2e3c867f2e30b6b1dcbe14333` |
| `src/Mod/Assembly/JointObject.py` | `bb1d917360b973c1e3b3a8aad0fbb9484571508670fb8f395c223dd734d52d83` |
| `src/Mod/TechDraw/Gui/Workbench.cpp` | `08acec3ed8d85a1a2ea09fabd6b1fa37036d475ca5bb1d3bf132b97ac50128ec` |

## Completion rule

Each capability must pass **author → preview → commit → edit upstream → rebuild
→ save → reopen → export/reimport**, including invalid-input recovery and stable
references where applicable. A native test proves only the native portion.
Frontend projection fixtures prove rendering/decoding, not a real backend.
Disabled ribbon entries and unsupported workbenches are open gaps.

Every completed item needs canonical persistence, product-owned translation,
native numerical acceptance, and an app-level workflow fixture. Cross-platform
installation and native release checks must run without silently skipping
FreeCAD-dependent tests. No percentage of parity is asserted.

## Part and Sketcher

| Capability group | Evidence in current source | Remaining acceptance |
|---|---|---|
| Interactive sketch geometry/constraints | CAD sketch implementation and solver tests; PlaneGCS comparison spike | Full supported-curve/constraint mapping, conflict/redundancy/DOF diagnostics; PlaneGCS is not the default |
| Profiles and holes | Native closed wire, circle, rectangle, compound region extrusion | General intersecting regions; elliptical arcs/projected geometry; consistent profiles for every feature |
| Pad/Pocket | Native independent bodies, region selection, supported extent modes | Complete end conditions, taper/draft options, direct manipulation and all upstream-edit fixtures |
| Revolution/Groove | Native revolve adapter, cut flag and frontend editor | Compound profiles, reference-axis selection and complete option/workflow corpus |
| Additive/subtractive pipe | Native sweep and editor | Complete path authoring, orientation/transition/multisection options and browser fixture |
| Fillet/Chamfer/Thickness | Native edge finish and shell | Direct edge/face reference authoring and repair; variable/face fillet variants |
| Mirror | Native adapter and editor | Complete feature/body choices and reference/identity behavior |
| Hole | Native plain/counterbore/countersink; blind/through-all; direction/target, persisted circular-region selection; native numerical/STEP/recovery tests and Chrome create/edit/reopen | Threads and drill-tip options, standard fastener tables, multiple centers, full upstream-face repair corpus |
| Loft | Native additive/subtractive ordered-section Loft; new/add/cut, smooth/ruled, stable contour/body identities; native numerical/STEP/edit tests and Chrome create/order/edit/reopen | Closed-loop lofts, compound-wire sections, broader profile matching/twist/attachment and upstream-repair corpus |
| Draft | Native planar-face Draft, geometric face/neutral-plane references, angle/direction/target; numerical/STEP/error tests and Chrome create/edit/reopen | Arbitrary/curved/multiple face picking, independent pull direction, broader topology/upstream repair |
| Linear/polar/multi-transform patterns | Native linear/polar feature patterns, principal axes, count/spacing/angle/direction, additive/subtractive sources; numerical/STEP/recovery and Chrome edit/reopen fixtures | Arbitrary datum axes, skipped occurrences, multiple sources, multitransform and broader upstream repair |
| Boolean/split/body transformations | Native multi-body union/cut/intersection, keep/consume tools, stable target/tool IDs, history snapshots; native/STEP/recovery/Chrome edit/reopen | Split; Move/Copy/Rotate/Scale with persistent intent; broader topology repair |
| Datums/attachments/external references | Reference planes and limited planar support resolution | Broader datum axes/points, associative projections, reference repair across splits/merges |
| Topological naming | Geometric native IDs and limited support resolution | Durable identity under ambiguous faces, topology changes, imported changes and downstream mates/dimensions |
| Expressions/configurations | Existing product metadata/controls are not full expression parity | One persisted dependency graph driving native parameters, cycles/errors, units and configuration fixtures |
| Imported geometry | Saved STEP bytes, native rebuilding and STEP/STL export | Broader file formats, assembly structure/colors/units, healing, per-solid import identity and round-trip corpus |
| Analysis | Native principal sections, body interference, exact volume/area/centroid/bounds and optional explicit-density mass/centroidal inertia; numerical and browser inspection tests | General section planes, assigned/mixed materials, assembly-aware interference and measurement authoring |

Evidence: `Aether CAD/src/{freecad-translate.ts,tools/solid.ts,features/}`,
`Aether CAD/freecad-engine/aether_freecad/{worker,modeling,regions,topology,
sketch_support,extrusion_extent,importing,exporting,analysis}.py`.
Detailed plan: [Part parity](Aether_CAD_Part_Parity.md) and
[Sketch parity](CAD_Sketch_Parity.md).

## Assembly

| Capability group | Evidence in current source | Remaining acceptance |
|---|---|---|
| Native solving | FreeCAD Assembly/Ondsel adapter; 13 joint-kind names | Every kind's parameters, limits, offsets/reversal and numerical/recovery fixtures; names alone do not prove parameter parity |
| App mate creation | Fastened, revolute and prismatic authoring | Cylindrical, ball, distance, parallel, perpendicular and angle remain disabled in the app catalog |
| Motion relations | Native rack/pinion, screw, gears, belt names | Persist and transmit complete relation parameters, ratios, radii and motion/limit semantics |
| Connector frames | Meter-to-mm/native detached frames; missing, suppressed, wrong-part and degenerate frames are rejected instead of relocated to part origins | Interactive repair of deleted/topology-changed connectors; broader assembly revision/link update corpus |
| Complete solve contract | This audit fixes error diagnostics/return codes being reported as OK; browser rejects partial/invalid results before replacing geometry | Residual/constraint satisfaction checks and comprehensive overconstraint/redundancy cases |
| Repeated constraints on one pair | Fixed-frame and vertex/vertex distance residual checks now reject reproduced false successes; native frame matching fixes quarter/half-turn initialization; native conflict/recovery fixtures pass | Residual acceptance for other joints, geometry-specific distances and all motion/limit semantics |
| Nested assemblies | Translator explicitly reports “sub-assemblies are not solved yet” | Hierarchy flattening/identity, rigid/flexible behavior and save/reopen/link-update fixtures |
| Linked parts and updates | Existing canonical workspace/component projections | Revision-pinned links, update/replace/make-independent and missing-access/source repair across Drive |
| Instance editing | Ground, suppress and remove commands exist | Component patterns, constrained drag, edit-in-context and assembly features remain incomplete/disabled |
| BOM/exploded states/export | Presentation contracts and partial workspace functionality | End-to-end authoritative BOM quantities, configurations, exploded views and exported assembly structure |

Evidence: `Aether CAD/src/{assembly-job.ts,startup/assembly-solve.ts,
tools/assembly-mates.ts,tools/assembly-build.ts,tools/assembly-relations.ts}`,
`Aether CAD/freecad-engine/aether_freecad/{assembly,protocol}.py`.
Detailed contract: [Assembly projection](Aether_CAD_Assembly_Projection.md).

## Drawing / TechDraw

**The largest missing vertical subsystem.** `DrawingWorkspace`, sheet rendering,
strict TypeScript decoders and fixture tests exist. The client calls
`describe_drawing`/drawing mutation verbs, but the Python producer is absent.
The OCCT hidden-line utility does not make the Drawing app operational.

| Required capability | Work still required |
|---|---|
| Drawing documents/sheets | Canonical persisted definitions, templates/title blocks, units, scales and sheet order; real create/open/save path |
| Base/projected/isometric views | Product-owned native projection, first/third-angle rules, exact visible/hidden/tangent edges and cached rebuild |
| Section/detail/auxiliary/broken views | Associative view dependencies, exact sections/hatching and parent/source edits |
| Dimensions | Exact linear/angular/radial/diameter references, tolerances, annotation placement and dangling-reference repair |
| Annotations | Center lines/marks, leaders, symbols, notes and engineering formatting |
| BOM/balloons | Authoritative assembly item/quantity references, updates and numbering consistency |
| Delivery | Real PDF/DXF/SVG exporters from the same canonical primitives, parsed-output fixtures and printing scale checks |
| Resilience | Stale-source detection, rebuild ordering, missing-source/read-only states, invalid edits and save/reopen recovery |

Detailed producer/consumer contract and 12 acceptance gates:
[Drawing projection](Aether_CAD_Drawing_Projection.md). Implement the producer in
the CAD product; do not move new CAD semantics into shared UI or Animation.

## Other FreeCAD workbenches

“Full FreeCAD parity” also encompasses capabilities beyond the named mechanical
scope. Surface, Mesh, Draft, FEM, CAM, BIM, Spreadsheet and material workflows
need separate inventories/acceptance. Sheet Metal add-ons must be identified
separately from bundled FreeCAD. Current disabled Surface/Mesh/Sheet Metal tabs
are not implementations. These are **unassessed/open**, not silently excluded
or declared complete by this mechanical audit.

## Delivery sequence

1. Reliability: truthful native/translation errors, retain last valid geometry,
   topology/connector repair and exact save/reopen/export fixtures. This audit
   closes the identified assembly status/publication bugs; repeated-pair
   constraint satisfaction remains open.
2. Part: complete common mechanical features and options with one feature's
   schema/translation/editor/native/browser fixtures together, then broaden
   curve, datum, imported-body and reference stability coverage.
3. Assembly: complete mate authoring and parameter transport, linked updates,
   nested assemblies, motion validation and BOM/export workflows.
4. Drawing: implement the canonical producer and base-view/sheet persistence
   first; then derived views, associative dimensions/BOM and exact exports.
5. Integrated fixture corpus: dimensioned flange, bracket, enclosure/lid,
   multi-part mechanism and a multi-sheet manufacturing drawing. Modify a part
   dimension and verify the assembly, dimensions and BOM update after reopen.
6. Validate Mac/Linux/Windows installs and native test jobs; catalogue and finish
   remaining required workbenches before making any whole-FreeCAD parity claim.

## Reference-retirement gate

- [ ] Freeze the FreeCAD runtime and upstream-source baselines.
- [ ] Map the complete required command/option inventory to actual workflows.
- [ ] Close every Part, Assembly and Drawing acceptance item above.
- [ ] Close or explicitly decide the remaining workbench scope; no blanket parity claim while unassessed.
- [ ] Native, UI, persistence and export fixtures pass on clean installations; no missing-engine skips.
- [ ] Prove normal builds and application workflows work without the reference checkout.
- [ ] Preserve source provenance, upstream URLs, licenses and asset notices.
- [ ] Record final evidence and remove only the redundant reference material.

Current verdict: **retain the reference; full parity remains open**. Removing
the checkout would not remove the installed engine dependency or supply any of
the missing functionality.

Native acceptance command from the repository root:

```sh
.venv/bin/python -m pytest 'Aether CAD/freecad-engine/tests' --require-freecad -q
```

`--require-freecad` first starts the real worker and verifies the protocol;
a missing/broken executable fails immediately. It is an engine-availability
gate, not automatic proof of the full parity checklist.
