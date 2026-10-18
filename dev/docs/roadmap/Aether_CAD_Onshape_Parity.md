# Aether CAD independent Onshape parity

Jonathan's product target, recorded 2026-10-09. **Full parity is open.** This is
an initial gap inventory, not a complete feature audit or a percentage estimate.
Work happens in the sibling `aether-cad` repository; Studio remains the host.
Map and CAD remain the first release products.

## Reference and implementation boundary

Use public documentation and independently observed user behavior to specify
outcomes, then implement with Aether's own product code, Aether UI, and the
licensed FreeCAD/OCCT runtime. Do not import Onshape implementation code, copied
artwork, private protocols, or credentials. Preserve dependency attribution.
Existing Aether work predates this record: this does not certify a retrospective
formal clean-room process. Record references, independently authored fixtures,
implementation ownership, and acceptance evidence for each new capability.

Public reference baseline: documentation reviewed 2026-10-09. Onshape is a
changing service; no complete version/edition comparison has yet been frozen.
Newly discovered features expand this inventory instead of disappearing from
scope. Advanced offerings below are unassessed, not silently excluded.

- [Extrude behavior](https://cad.onshape.com/help/Content/PartStudio/extrude.htm):
  result operations, extent and profile options.
- [Assemblies](https://cad.onshape.com/help/Content/Assembly/assembly.htm) and
  [mates](https://cad.onshape.com/help/Content/Assembly/mates.htm).
- [Configurations](https://www.onshape.com/en/features/configurations):
  parameterized parts and assemblies.
- [Platform overview](https://www.onshape.com/en/platform) and
  [release management](https://www.onshape.com/en/features/release-management):
  CAD, drawings, data management and extended product capabilities.
- [Render Studio](https://www.onshape.com/en/features/render-studio) and
  [PCB Studio](https://cad.onshape.com/help/Content/PCBStudio/pcb_studios.htm).

## Completion rule

Every feature needs authored inputs, preview/cancel, commit, upstream edit,
rebuild, save/reopen, undo/history and exchange where applicable. Test numerical
geometry and stable identity, not just presence of an icon or a successful HTTP
response. Include invalid selections, deleted/suppressed references, units,
concurrency, large models and recoverable failures. Native-dependent acceptance
must execute FreeCAD; skips cannot count as passes. A frontend projection fixture
is not evidence of a native producer. A kernel capability is not an authoring UI.

Keep `aether-engine` green, but implement new feature geometry in the native
FreeCAD adapter. Changes there are limited to existing persistence/validation
contracts and explicit refusal of unsupported fallback operations. Do not create
a second solver or feature engine. Product semantics stay in CAD; host accounts,
storage and revision services stay in platform. UI and assets use pinned shared
packages. AI editing must use the same commands, revision checks and validation
as human editing; no direct writes around those boundaries.

## Workstreams and current gaps

| Workstream | Existing evidence | Open acceptance |
|---|---|---|
| Sketching | Product sketch tools, constraints, region/identity tests | Complete curve and constraint mapping; conflict/redundancy feedback; projected/elliptical region coverage; dense-sketch budgets |
| Solid modeling | Native extrude/revolve/sweep, Hole, Loft, Draft, pattern and Boolean paths; explicit and automatic Add merge scopes; planar face and ordinary sketch-support repair; curved Up-to-face and selected-face offsets with native/browser/file acceptance | Complete options, folded/singular stopping boundaries, broader direct face editing, split, thread, robust topology naming and projection-reference repair |
| Extrude Intersect | Native common, explicit and automatic multiple-target scopes; save/reopen/edit and exact exchange; selected-solid planar/curved Up-to-part and checked solid/sketch Up-to-vertex stops, independent ends, parallel solid-face and principal-derived datum starts | Whole-part/mate/surface starts and captured-datum association, surface mode/stops, broader thin curves/corners and direction references, oblique draft, folded Next/face boundaries and mate/projected point references remain open |
| Surface modeling | Some underlying kernel capabilities; visible entries may be disabled | Product-owned surface documents, authoring, continuity controls, thicken/stitch/trim workflows and exchange corpus |
| Sheet metal and frames | Workspace entries are not completed workflows | Canonical rules, flange/bend/unfold, flat patterns, cuts, manufacturing outputs; frame profile/joint/cut-list authoring |
| Assemblies | Native solver capabilities; workspace authors fastened/revolute/prismatic subset | Remaining joint authoring and persistence, solver diagnostics, nested assemblies, limits/relations, configurations, BOM, interference and context updates |
| Drawings and MBD | Drawing UI contract/projection fixtures | Canonical drawing producer and associative views, dimensions, tolerances, sections/details, tables/templates, publishing and model-change propagation |
| Variables/configurations | Existing part variables and feature expressions | Dependency cycles/units, configuration tables, selections/suppression/properties, cross-document and assembly configuration rebuild |
| Documents and collaboration | Host storage, permissions, revisions/branches, comments and sessions | CAD-specific concurrent authoring, branch/merge conflict cases, linked revision updates, release approval, immutable released BOM/drawings and audit acceptance |
| Import/export | Native STEP and existing import/export adapters | Supported-format inventory, topology/units/metadata fidelity, large files, malformed inputs, assemblies and downstream manufacturing round trips |
| Extensibility/agents | Scoped Map/CAD saved-document commands, exact CAD faces, native preview/validation and revision/history checks | Arbitrary feature creation, live editor/selection/pixel previews, custom feature sandbox and compatibility; no FeatureScript compatibility claim |
| Rendering/simulation/manufacturing | CAD viewport is not a full rendering or analysis product | Scope and independently specified workflows for photorealistic rendering, engineering simulation, CAM, ECAD/MCAD and related integrations |
| Quality/distribution | Mandatory native release gates, pinned packages, compatibility manifests | Measured interactive latency/memory, cross-platform clean installation/update/recovery, accessibility, offline desktop packaging and release qualification |

The rows above are assessed from Aether source and existing acceptance records,
not inferred from Onshape marketing. See `FreeCAD_Parity_Acceptance.md`,
`Aether_CAD_Part_Parity.md`, `CAD_Sketch_Parity.md`,
`Aether_CAD_Assembly_Projection.md` and `../reality/Map_CAD_Framework.md`.
Older checkmarks describe individual packets; they do not close these rows.

## Sequence

1. Finish mechanically verifiable part workflows: result/extent selection,
   references, thin/surface modes and upstream-edit recovery. Intersect is the
   first completed single-target slice; broader Extrude parity stays open.
2. Complete product-owned assembly contracts/authoring against the native solver,
   then establish real drawing production and model-to-drawing update fixtures.
3. Deliver configurations, sheet metal/frame workflows, robust exchange and
   CAD-specific collaboration/release behavior with representative projects.
4. Qualify performance, installation and offline use; deliver the remaining
   advanced workstreams against explicit independent specifications.

No whole-product parity signoff until every scoped workflow has an evidence row,
no unassessed capabilities remain, and browser/native/release gates pass for the
frozen reference baseline. The user has not authorized narrowing the full target.


## Up-to-next end offsets and agent geometry inspection — 2026-10-10

Public reference: [Onshape Extrude](https://cad.onshape.com/help/Content/PartStudio/extrude.htm).
Aether independently adds signed End offset to its existing Up-to-next control:
positive stops before the next face; negative extends beyond. Native geometry
uses the exact parallel-planar stopping-face search and recomputes from upstream
bodies. It rejects offsets leaving no positive extrusion and retains existing
refusals for curved, oblique or incompletely covering limits. No new fallback
kernel behavior was added. Persistence stores optional `endOffsetMillimeters`.

Analytical-volume fixtures cover both signs, starting offset, moved limits,
save/reparse, failure/recovery and STEP export/reimport. Mounted authoring checks
that switching to Blind drops the inapplicable offset. Product agents expose the
same option with read-only native preview and revision-guarded edits. They can
inspect feature/body identities and paged exact face references for the saved
revision. Upstream edits resolve attached sketches before saving. This adds
bounded AI access, not autonomous arbitrary feature creation or full parity.


## Revolve directional extents — 2026-10-10

[Public Revolve reference](https://cad.onshape.com/help/Content/PartStudio/revolve.htm)
reviewed for directional, symmetric and opposite-end behavior. Independently
specified Aether fixture: a 20×10 mm rectangle 2 mm from the X axis; expected
volume follows Pappus and the total sweep fraction. Direction is additionally
verified by coordinate bounds, so reversed/symmetric errors cannot pass by volume
alone. Native FreeCAD public properties Type/Angle/Angle2/Midplane/Reversed were
probed and used via the existing replaceable subprocess boundary; no Onshape
code, private protocol or artwork was used.

Implemented reverse, symmetric primary angle, and independent opposite angle
for New/Add/Remove. Optional saved fields: `reversed`, `symmetric`,
`secondAngleDegrees`; defaults preserve old documents. Refuse total over 360°,
negative opposite angle or symmetric plus a second angle. Editor display units
are converted to canonical degrees. Native-only fallback refusal is explicit.
Two new agent commands reuse this schema/native translator and platform history.
Arbitrary axes, referenced limits, surface/thin modes, Intersect and multiple
merge targets remain open. This packet does not close the Revolve workstream.

## Part modeling and inspection priority — 2026-10-12

Jonathan selected **Part modeling and inspection** as the first priority; this
sequences rather than narrows the full target. Implemented camera projection and
unit-consistent inspection slice: real perspective/orthographic camera switching,
view-preserving Fit, single selected-vertex XYZ, document-unit section and density
inputs, physical properties and interference results. See the 2026-10-12 reality
entry for verification and limitations. Projection is session-only; no persisted
named views or exact center-distance capability is claimed.

Public behavior reference reviewed: [Onshape Measure](https://cad.onshape.com/help/Content/View/measure_tool.htm).
Aether remains behind its selected-edge/face length, radius/diameter, angle,
minimum/maximum and center measurement coverage. Native geometry projections must
supply exact analytic data; bounding-box centers must not stand in for circle or
cylinder centers.

Next acceptance packets:
1. Exact selected-edge/face inspection with unit-aware results, invalid/deleted
   selection recovery and independent analytic fixtures.
2. Referenced extrusion extents and multi-target scope: authored selection,
   preview/cancel, commit, upstream edit/rebuild, undo, save/reopen and STEP check.
3. Thin/surface feature and reference-repair workflows against native FreeCAD.
Camera and UI tests alone cannot close these modeling packets. Live browser
verification of this slice remains pending because the Mac was locked.

## Continuous sketch-to-solid workflow — 2026-10-12

The sketch-to-Extrude handoff now waits for actual commit completion, carries a
selected/sole region, and avoids duplicate dialogs. Basic blind extrusions have
an on-model signed depth drag handle; the panel also supports depth scrubbing
and keyboard adjustment. Coalesced native previews retain the last valid result
while updating. See the reality entry for 59 focused tests, one real native
integration case and the pending locked-Mac visual check.

Open interaction acceptance: arbitrary-face direct editing, on-model manipulators
for referenced/symmetric/second-end extents, face-attached sketch and dense-region
user journeys, measured native-preview latency and browser end-to-end gestures.
This closes only the basic extrusion interaction slice, not direct-edit parity.


## Native direct interaction and referenced depth — 2026-10-12

Independent implementation now covers selected unique planar-face Push/Pull:
signed footprint add/remove, document units, on-model depth drag, preview,
upstream rebuild, suppression and save/reopen with the same body identity.
Imported STEP is covered by native acceptance. Ambiguous or curved faces and
invalid/empty/split results fail explicitly. This does **not** close general
[Move Face](https://cad.onshape.com/help/Content/PartStudio/move_face.htm), whose
translate/rotate/offset and multi-face behavior remain open.

Extrude now has an authored Up-to-face reference with start/end offsets. The
native implementation requires a unique planar stopping face parallel to and
covering the profile. Save/reopen/upstream edit checks prove it follows the
selected reference even with a nearer intervening body. Arbitrary surfaces,
nonparallel stops, multi-target merge scope and referenced-depth viewport
manipulators remain open. Reference deletion stays repairable and suppression
follows feature dependencies.

Inspection now exposes exact native edge lengths, face areas, analytic radii and
diameters, and two circular-edge centers with XYZ deltas in document units.
Selected candidate IDs are decoded using the full body ID, including colons.
Other center definitions, angle and minimum/maximum distance remain open.

The reality entry records suite and packaged-worker checks. Interactive browser
gesture acceptance is still pending (locked Mac), as is installation of the
fresh native worker in the running host. These are local implementation results,
not a whole-product parity or deployment declaration.


## Underlying planar stop behavior — 2026-10-12 follow-up

Supersedes the parallel/covering-face restriction in the preceding entry.
[Onshape Extrude](https://cad.onshape.com/help/Content/PartStudio/extrude.htm)
specifies Up-to-face against the underlying surface. Aether now independently
implements the planar case with exact native trimming, including tilted faces
and profiles extending beyond their edges. Signed offsets remain axial and are
stated in the editor. Native/API reference:
[FreeCAD face half-space API](https://github.com/FreeCAD/FreeCAD/blob/main/src/Mod/Part/App/TopoShapeFacePyImp.cpp).

Verified with analytic circular/wedge volumes, reversed/offset extents, nested
holes, material removal, STEP roundtrip, and serialized-document upstream edits,
suppression and restoration. Full native suite 195 passed plus two added cases;
60 focused web/workflow tests and production build passed. Fresh packaged worker
geometry/export checks passed. Interactive browser verification and running-host
installation remain pending. Curved stops, orientation-change reference repair,
multi-target scope and full direct-edit/thin/surface behavior remain open.


## Operation preview clarity — 2026-10-12

Jonathan requested blue addition and red cut previews. Implemented exact native
before/after differences with translucent blue additions, red removals and neutral
retained geometry. Affected cut targets are ghosted for internal visibility,
unaffected bodies stay opaque, and a textual legend and pending indicator make
the display understandable without relying only on color. Preview resources are
transient and cleaned on cancellation. Renderer/client/authoring tests61 and
native suite202 pass; production build and packaged browser geometry checks pass.
Live visual acceptance and running-worker installation remain open; older workers
show an explicit capability message with their ordinary neutral result preview.


## Explicit multi-part extrusion scope — 2026-10-12

Public behavior reference: [Onshape Extrude](https://cad.onshape.com/help/Content/PartStudio/extrude.htm).
Independent Aether implementation now covers explicitly selected Remove/Intersect
parts with atomic result validation, persistent scope/dependencies, stable body IDs
and exact red cut previews. Source edits, suppression/reopen, subsequent planar
Push/Pull on the second target and STEP exchange pass. Full web986/native211 plus
one additional native failure case, parked38 and production/package checks pass.
Add/merge-all, scoped-feature Pattern/Mirror and automatic split-output identity
remain open. Live interaction and installed-worker acceptance remain pending; this
closes the local explicit Remove/Intersect scope packet only.


## Angular inspection and rendered interaction acceptance — 2026-10-12

[Public Measure reference](https://cad.onshape.com/help/Content/View/measure_tool.htm)
reviewed for selected-entity angles and degree/radian presentation. Independently
implemented acute straight-edge/planar-face comparisons from native analytic unit
vectors, projected through displayed part transforms. Native tilted-prism and
rotated-part, unsupported-selection, document-unit and mounted-panel fixtures pass.
General minimum/maximum distances, curved-surface tangent angles, coordinate-frame
selection, measurement-driven variables and annotations remain open.

An isolated real headless browser now verifies canvas region selection, blue Add
and red multi-target Remove previews, commit/edit/cancel, planar-face inspection,
explicit tree-sketch→Extrude handoff and on-model cut depth drag/cancel. The latter
found and corrected default cut direction and needless profile reselection. This
is meaningful browser evidence; the locked desktop does not block these fixtures.
See ../reality/STATUS.md and CAD .verification/onshape-parity-2026-10-12/RESULTS.md.
Desktop/GPU, installed-worker, broader gesture and whole-product acceptance remain
open. Final focused inspection25/native3 and authoring/drag53, packaged worker,
scoped Ruff and production build pass after the earlier full web986 baseline.


## Explicit Add merge scope — 2026-10-12

Implemented explicit Add targets using [Onshape Extrude](https://cad.onshape.com/help/Content/PartStudio/extrude.htm)
as a public behavior reference. This supersedes the earlier statement that all Add
merge scope is missing. Aether independently validates the complete connected
native union, retains the primary identity, consumes selected extras and preserves
historical producers. Blue preview is the exact new volume, without false removal
colors from consumed body IDs. Editing the scope, suppression and .acpart reopening
restore the correct parts. Browser, native analytic volume/STEP, packaged worker,
997 web and219 native tests pass, with final history/contract regressions covered
separately. See CAD .verification/onshape-merge-2026-10-12/RESULTS.md.

Automatic merge-all, multi-result merge semantics, scoped-feature Pattern/Mirror,
robust face disambiguation/repair, thin/surface operations and installed-release
qualification remain open. This does not establish full Onshape equivalence.


## Explicit planar face selection and repair — 2026-10-12

Public reference: [Onshape Move Face](https://cad.onshape.com/help/Content/PartStudio/move_face.htm).
The reference includes translation, rotation and offsets; this packet independently
implements selection/repair for Aether's existing planar footprint extrusion and
planar supports. It does not close general direct-face-editing parity.

Parallel and coplanar faces now resolve through an optional native centroid/area
anchor shared by Push/Pull, sketch support and Up-to-face references. A single
normal match retains the prior parametric behavior. Anchored metrics must resolve
uniquely with the documented tolerances; changes require reselection. These
metrics do not constitute complete topology naming or recognize every shape edit.

Change face in Push/Pull and Up to face clears only the draft and exposes exact
pre-feature geometry for selection. Earlier geometry supplies the face frame,
measurements and depth-handle location. Selection/visibility no longer falsely
announces a document edit that kills the live preview. Dedicated sketch-support
reselection remains open despite the shared anchor contract.

Native fixtures distinguish stepped faces and coplanar towers by exact preview
bounds as well as volume, including both extrusion signs, invalid references,
upstream changes/repair, attached sketches, stopping planes and STEP roundtrip.
Production-browser acceptance covers actual picks, blue/red previews, history
reselection, signed drag/cancel, save/reopen and upstream-error repair. The final
worker separately evaluates the actual UI-saved document and exact exchange.
Evidence: ../Aether-CAD/.verification/onshape-faces-2026-10-12/RESULTS.md.

Verification: 1,009 full web tests, 234 required-native tests, 36 parked checks,
94 final focused checks, production/worker build and scoped lint passed. Counts
overlap. No installation cutover or broad Onshape parity signoff.


## Ordinary sketch support repair and direct solid tools — 2026-10-12

This supersedes the previous open dedicated support-reselection item for ordinary
profile sketches. Change sketch plane retains local drawing/constraints/IDs and
label positions while selecting an earlier planar face or principal datum. Known
support failures and missing selections block Finish; Cancel preserves saved
state. Reopening retains existing offsets; a new plane resets the offset to zero.
Picking excludes downstream features, and sketch-local undo uses the current
background snapping context. Projection-derived references remain separate.

The contextual sketch toolbar now includes Extrude and Cut in compact and
expanded modes. Manual Solid-tab selection no longer resets every render.
Existing sketch-to-solid acceptance carries the selected/sole region; an actual
browser verifies this with a blue New preview and both direct tool handoffs.
Public behavior reference: [Onshape Sketch tools](https://cad.onshape.com/help/Content/Sketch/sketch_tools.htm).

An independent stepped-solid/radius-1 bore fixture verifies upstream support
failure, explicit moved-face repair, constraints, downstream cut, datum selection,
cancel, save/reopen and exact STEP volume. Full web1,015 (before final ribbon fix),
final focused87, native workflow18, build and final packaged-worker checks pass;
counts overlap. Evidence: Aether-CAD/.verification/onshape-sketch-repair-2026-10-12/RESULTS.md.
No new kernel semantics or live installation changes. General topology naming,
projection-reference repair, full feature options and whole-product parity remain
open; plane replacement is not an individual sketch-local undo action.


## ClassCAD review and applicable patterns — 2026-10-12

**Sequencing confirmed by Jonathan,2026-10-13:** this is the next reference phase
after the remaining agreed ArtCraft adoption work. Keep these candidates queued;
recheck Aether's implementation before starting them and reuse overlapping
snapshot/agent infrastructure already completed. This is not an engine-switch
decision and does not cancel independently assigned CAD work in progress.

Jonathan requested a review of https://classcad.ch for useful Aether CAD
improvements. This is public documentation/repository metadata and local source
review, not a hands-on ClassCAD benchmark or proof of its advertised robustness.
No package, MCP server, account, license or runtime was installed. Recommendations
below are Aether engineering judgments; none is newly shipped behavior.

### What fits our architecture

ClassCAD separates its C++ runtime/feature graph from the SMLib kernel and solver
plugins. Buerli supplies JavaScript/React integration, while Buerligons is the CAD
application. Its native/browser API consistency is a useful design reference.
Aether already has a headless native FreeCAD boundary, a feature document,
selection topology and Three.js display. Preserve that direction and build new
semantics in the CAD-owned native adapter, without reviving the parked browser
engine or putting product meaning in shared UI.
Sources: [architecture](https://classcad.ch/docs/architecture/),
[Buerli introduction](https://buerli.io/docs/).

### Ranked candidates

1. **Reliable references across edits — highest long-term modeling value.**
   ClassCAD documents kernel copy/split/merge callbacks feeding its reference
   system and identity carried into tessellation. Aether's current planar
   resolver uses normal plus optional centroid/area; changed dimensions can
   require manual repair. Investigate feature/entity provenance through the
   public FreeCAD/OCCT history facilities available to our adapter. Start with
   extrusion cap and side-face relationships to stable sketch entities, then
   extend through booleans. Persist semantic references and retain legacy
   anchor migration; never guess through splits/ambiguity. Acceptance: attached
   sketches, cuts and fillets remain correct after upstream dimension changes,
   save/reopen and feature suppression; deleted/split references fail clearly.
   This is substantial native work, not a UI-only patch, and the ClassCAD claim
   has not been independently stress-tested here.
   [Reference design](https://classcad.ch/docs/architecture/classcad_and_smlib/).
   Local anchors: CAD freecad-engine/aether_freecad/planar_reference.py and
   src/viewport/planar-face-reference.ts.

2. **Incremental evaluation for fluid previews — highest interaction value.**
   ClassCAD describes keeping intermediate solids for rollback. Aether already
   coalesces preview requests and ignores stale replies, but worker.py::_build
   creates and closes a fresh FreeCAD document per request and evaluates the
   requested history prefix. Measure 10/50/100-feature fixtures before changing
   this. Then evaluate bounded, revision-aware native prefix snapshots or
   persistent sessions, with exact invalidation of changed dependencies, engine
   versions and imports. Cancellation, failed previews, rollback and different
   users must never share mutable state. Require identical geometry/diagnostics
   to a cold rebuild and measured p50/p95 improvement before adopting the cache.
   No measured ClassCAD-versus-Aether speed claim is made.
   [History caching reference](https://classcad.ch/docs/api-usage/classcadPartVsSolidApi/).
   Local anchors: CAD src/modeling/feature-preview.ts and
   freecad-engine/aether_freecad/worker.py::_build.

3. **Repeatable visual verification — best first bounded implementation.**
   Their renderer documents fixed orthographic views, sections, hidden lines,
   markers and image comparisons with the same framing. Aether has native
   volume/STEP tests and real-browser screenshots, but saved agent commands
   explicitly return pixel_preview:false. Add a product-owned read-only snapshot
   contract with fixed camera/frame, highlighted selection and clipping plane,
   paired with exact bounds/volume/diagnostics. Use it for agents and regression
   checks of blue/red deltas and sketch placement. Geometry tests remain the
   authority; mesh images do not certify tolerances or associative drawings.
   A renderer adapter can be assessed against independently implemented snapshots;
   the production viewport remains Three.js and must retain its browser tests.
   [Renderer contract](https://github.com/awv-informatik/classcad-ai/blob/master/packages/renderer/README.md).
   Local anchors: CAD src/automation/commands.ts, scripts/e2e-import.mjs and
   .verification/onshape-sketch-repair-2026-10-12/RESULTS.md.

4. **Consistent named parameters in feature editors.** Buerligons presents named
   constrained dimensions driving later geometry. Aether already has typed
   document variables and sketch expression support; extend their authoring
   consistently to solid-feature fields, show resolved values/units and affected
   features, and reject dependency cycles. Do not create a second expression
   evaluator. Demonstrate a bracket whose thickness/hole spacing drive sketches,
   extrusion and patterns through edit/preview/cancel/save/reopen.
   [User-facing reference](https://buerligons.io/).
   Local anchor: CAD src/sketch/variables.ts and native feature translation.

5. **Discoverable, verified modeling recipes for agents.** ClassCAD's toolchain
   combines API discovery, scripts, tree/geometry results and numeric/visual
   verification. Aether's saved commands already use native validation and host
   revision checks, but cannot arbitrarily author complete feature sequences.
   Extend the existing command catalog with bounded, atomic sketch-to-solid
   batches and examples generated/tested against the actual contracts. Each
   candidate should return changed features, geometry checks and the snapshot
   from item3 before a revision-guarded save. Do not adopt unrestricted scripting
   or bypass Studio's authority/history by attaching a second MCP backend.
   [Agent workflow](https://classcad.ai/).
   Local anchor: CAD src/automation/commands.ts.

### Reuse and adoption decision

[Buerligons has an MIT license](https://github.com/awv-informatik/buerligons/blob/main/LICENSE).
The [renderer manifest declares MIT](https://github.com/awv-informatik/classcad-ai/blob/master/packages/renderer/package.json),
but its documented inputs are ClassCAD tree/graphic data: adaptation and checking
packaged license notices are required before reuse. It is a verification renderer,
not a replacement for the interactive viewport. No source or artwork was copied.

The ClassCAD engine has a separate proprietary key/subscription agreement.
Its [published license](https://awv-informatik.ch/license/) distinguishes internal
commercial use from distribution; exposing powered functionality to third parties
requires distribution licensing. Do not treat MIT frontend/helper code as a grant
to bundle the engine. Exact commercial terms/costs were not established here.

Keep FreeCAD as Aether's default. A replacement would require native feature and
.acpart-history migration, identity/constraint/units compatibility, offline and
platform checks, and licensing qualification. The [ClassCAD feature page](https://classcad.ch/)
marks several advanced features in testing; Buerligons separately lists sweeps and
2D drawings as unavailable. The Part/Solid guide also says current EntityInjection
geometry does not recompute and lacks automatic face/edge tracking. API/marketing
coverage must not be mistaken for full application or Onshape parity.

Recommended implementation order: repeatable snapshots plus a preview benchmark;
then measured incremental evaluation; then a narrow native face-provenance packet.
Parameters and agent recipes build on those foundations. Platform collaboration,
PDM and distribution stay in Studio; no second history/database service is proposed.


## 2026-10-13 — Extrude draft acceptance

Public behavior reference: [Onshape Extrude](https://cad.onshape.com/help/Content/PartStudio/extrude.htm), reviewed this session. Its draft uses the sketch plane as neutral; opposite ends may have separate draft. Independently authored analytic circle, rectangle and annulus fixtures define Aether acceptance.

Aether now supports signed draft for Blind single-ended solid extrusions, including starting offsets, reversed direction, holes, explicit result scope, New/Add/Remove/Intersect and the existing depth handle. The UI edits in document angle units and persists canonical degrees. FreeCAD's public PartDesign::Draft constructs exact surfaces. Independent offset/end-cap checks reject apex crossing or changed profile topology even when OCCT reports a valid solid. Temporary native objects never become document history. Old workers are rejected by capability checks on build, analysis and export; the parked evaluator refuses draft.

Evidence: `../Aether-CAD/.verification/extrude-draft-2026-10-13/RESULTS.md`. Native analytic volumes, tilted placement, upstream edits, exact blue/red preview volumes, errors/recovery, STEP roundtrip, serializer/translator and browser commit/undo/redo/cancel/save/reopen pass. Browser save uses a file-picker stub to capture the real serialized document, then reimports it after a fresh reload. No installation promotion.

This is not Extrude or Onshape parity. Draft with symmetric or referenced extents, independent second-end conditions/draft, arbitrary direction, thin/surface extrusion, curved stopping surfaces and automatic merge-all remain open. General topology naming, projection repair and broader direct editing also remain open.


## 2026-10-13 — Independent extrusion ends

Public reference: [Onshape Extrude](https://cad.onshape.com/help/Content/PartStudio/extrude.htm), reviewed again this session. Opposite ends have independent end conditions and draft. Aether now implements an explicit `secondEnd` with Blind, Through-all, Up-to-next or Up-to-face, per-end offsets/references and Blind draft. Symmetric Blind supports two-sided draft. Old opposite-depth intervals remain compatible. Native exact tools are combined before modifying targets; failed ends cannot commit partial geometry. Either stopping reference participates in history. The editor coordinates two separate face-picking targets and retains document-unit conversion.

247 distinct targeted cases, types/build/lint and actual compiled-browser/native checks pass. Browser tests cover independent angles/depths, exact preview, commit, undo/redo, cancel and serialized file reopen with stable body identity. A common field-type omission that collapsed the Depth caption was fixed and measured in-browser. Evidence: `../Aether-CAD/.verification/extrude-ends-2026-10-13/RESULTS.md`. No installation promotion.

Still open: draft on referenced/Through-all ends, symmetric Through-all, Up-to-part/vertex, arbitrary direction, thin/surface, curved stops and merge-all. Forward compatibility needs an explicit file-version policy before older clients consume new v3 development features; worker capability checks only protect the current client. Overall parity remains unproven and open.


## 2026-10-13 — Drafted extrusion limits

Independent primary/opposite draft now supports Up-to-face (including tilted
infinite planes), complete parallel-planar Up-to-next and Through-all. Exact
native tool clipping and section coverage determine limits. End offsets and
upstream stopping-part edits recompute. The finite-tool search handles trial
apex crossings; a failed OCCT Draft gets one rigidly translated retry with exact
cap checks. No tessellated or bounding-box substitute defines the final stop.

270 targeted cases pass:124 native,104 frontend,19 document,21 native translated
workflows and2 explicit fallback refusals. Production/automation build, types and
scoped lint pass. Real compiled-browser/native tests verify blue tilted-stop and
red Through-all previews, commit, undo/redo, cancel and actual serialized reopen.
Evidence: `../Aether-CAD/.verification/extrude-draft-limits-2026-10-13/RESULTS.md`.
Current clients gate this geometry on `extrude-drafted-limits`. No installation
promotion, user document mutation or remote publishing occurred in this packet.

Symmetric Through-all, Up-to-part/vertex, arbitrary direction, thin/surface,
curved stops and automatic merge-all remain open. The old-client v3 forward-load
policy remains unqualified. All broader workstreams above retain their open
acceptance; this is one verified increment, not a parity signoff.


## 2026-10-13 — Extrusion direction and symmetric Through-all

[Public Extrude behavior](https://cad.onshape.com/help/Content/PartStudio/extrude.htm)
reviewed for Direction and Symmetric availability. Aether independently adds
world-axis/manual-vector solid extrusion and Symmetric Through-all. Depth,
starting/end offsets and the viewport drag follow a normalized world vector;
the source sketch retains its plane. Supported referenced limits use native
intersections and the actual moving footprint. Two-sided Through-all supports
Remove/Intersect, same-angle draft and explicit part scope.

312 targeted cases, types, full frontend/automation build, scoped lint and actual
compiled-browser/native checks pass. Visible picker, mouse depth drag, blue/red
previews, commit, undo/redo, cancel, serialized fresh reopen, symmetric end-mode
transitions and STEP roundtrip are qualified. Evidence and mass-property numeric
tolerances: `../Aether-CAD/.verification/extrude-direction-2026-10-13/RESULTS.md`.
New worker capabilities gate current clients; no installation promotion occurred.

Full Direction-reference parity remains open: world/manual vectors do not follow
selected model axes/edges or mate connectors. Oblique draft is explicitly refused
until qualified. Up-to-part/vertex, thin/surface, curved stops, merge-all and all
broader workstreams remain open. Next prerequisite before release: close the
old-client forward-file gap with an explicit version policy rather than relying
only on current-client worker checks.

## 2026-10-13 — Part file version boundary closed in source

New normal writes use Part v4, preventing old v3 clients from silently ignoring
new feature semantics. v1–v3 reopen in current CAD; v2/v3 preserve all authored
fields and only advance the header. Settings metadata does not silently migrate;
explicit multi-Part Update validates all migrations first. Native project/settings
headers and the packaged canonical workspace codec accept current versions and
refuse unknown future records. New project tabs use v4. Future geometry meaning
changes must advance the version boundary; already-shared v3 development files
cannot be retroactively protected.

2,065 distinct cases, types/build, old-v3-reader refusal, real browser/native
preview/cancel/undo/redo/save/fresh reopen and visible error/dismissal pass. Evidence:
`../Aether-CAD/.verification/part-format-v4-2026-10-13/RESULTS.md`. This resolves the
forward-file prerequisite above for newly saved files; source only, no promotion.

Continue with entity-backed direction references and remaining extrusion limits,
then thin/surface and broader sketch/inspection/topology repair. Full parity and
release acceptance remain open; this packet is compatibility work, not a new
claim of complete Onshape-equivalent modeling.


## 2026-10-13 — Associative sketch-line extrusion directions

The next Direction-reference slice is qualified in source: earlier authored
straight sketch segments, including construction lines, use stable contour and
segment IDs. Coordinate/constraint edits and contour reorder update the native
extrusion direction. Missing, curved, suppressed or degenerate references fail
for explicit repair. Support frames resolve in FreeCAD; native end/offset/reverse/
scope behavior is retained. The editor picker and handle share the resolved line.
Cancel is atomic; dependency ordering/suppression and saved-file identity are tested.

Part version5 and canonical codec build2 protect the new feature meaning from
older clients. 316 targeted cases, types/build, frozen-v4 refusal, packaged native
project/automation, real STEP and browser preview/edit/cancel/undo/reopen pass.
Evidence: `../Aether-CAD/.verification/extrude-line-direction-2026-10-13/RESULTS.md`.
No installed promotion or user-file rewrite.

This closes authored sketch-line association only. Current native solid-edge IDs
change with general upstream topology; do not treat them as persistent direction
references. Viewport line picking, projected/legacy rectangle sources, solid edges,
mate connectors and oblique draft remain open. Continue with remaining extrusion
limits and thin/surface modes, alongside robust topology/reference repair and the
broader sketch/direct-modeling/inspection acceptance list. Full parity is unproven.


## Thin extrusion acceptance —2026-10-13

The Thin tab now creates native walls around supported open/closed contours with
independent sides, Mid plane, Flip wall, document-unit controls and normal
extrusion result/end/direction controls. Closed walls retain a hole; open walls
have flat caps and intersection joins. Construction geometry is excluded, and
invalid offsets fail explicitly. Finished/selected sole open sketch handoff,
curve picking, native blue/red previews, on-model drag/Escape, edit/undo/redo,
save/fresh-tab reopen, stable identity, upstream rebuild and STEP are qualified.
Cubic offsets use bounded OCCT BSpline approximation; general exact offset
splines are not claimed. Surface remains a separate incomplete workflow.

528 targeted cases plus compiled browser/native acceptance, full build/lint,
Part6 older-reader refusal and canonical codec build3 checks pass. Evidence:
`../Aether-CAD/.verification/thin-extrusion-2026-10-13/RESULTS.md`.
Official Extrude reference above reviewed2026-10-13. Product code uses public
FreeCAD/OCCT APIs; no proprietary source, artwork or protocol is copied.

This is source-only. Remaining extrusion work includes Up-to-part/vertex,
curved stops, oblique draft, broader references, automatic merge scope, projected/
elliptical Thin contours and additional cap/corner options. Surface authoring,
reference repair and broader part modeling/inspection acceptance continue.
Full Onshape parity remains open; no installed-generation qualification or
promotion is implied by these feature tests.


## Selected-part extrusion acceptance — 2026-10-13

Either end now offers Up to part using an earlier solid's stable ID. Native
booleans stop the entire profile on its actual planar, tilted or curved boundary;
unselected nearer parts do not replace the chosen stop. Fully inside profiles
stop at exit; mixed starts fail explicitly. Signed offsets, supported draft,
Thin, independent ends, custom direction and explicit result scopes are qualified.
Missing/suppressed/consumed references require repair. The normal editor supports
named selection and Use selected part, with document units and atomic cancellation.

403 distinct targeted checks, full build/lint, exact native STEP and packaged
project/automation roundtrips, plus compiled-browser blue/red previews, edit,
undo/redo, save and fresh-tab reopening pass. Hidden reference geometry no longer
obscures previews or expands Fit bounds. Part 7 and immutable codec build 4 prevent
older readers from ignoring the new stop. Evidence:
`../Aether-CAD/.verification/extrude-up-to-part-2026-10-13/RESULTS.md`.
The official Extrude reference was reviewed for this packet; implementation uses
public FreeCAD/OCCT APIs, without proprietary source or artwork.

This qualifies selected solid stops in development, not complete Extrude parity.
Surface stops, mixed/reentrant/multilayer coverage, Up-to-vertex/mate connectors,
curved Up-to-next/face limits, oblique draft, automatic merge scope and broader
Thin/reference coverage remain open. Continue with point-based limits and wider
part-modeling/inspection acceptance. No installed-generation promotion or full
Onshape-equivalence claim follows from these checks.


## Selected-point extrusion acceptance — 2026-10-13

Up to vertex now accepts actual native solid vertices and authored sketch points
on either end, with signed offsets and current support frames. Sketch endpoints
follow stable IDs and constraints; native solid association checks incident
geometry, source fingerprints for ambiguity and incidence to refuse symmetric
corner permutations. The implementation deliberately reports changed/ambiguous
references for repair; it does not certify arbitrary persistent topology naming.
Named sketch selection, mouse vertex picking and face/point filter ownership are
qualified with normal preview/cancel/commit/edit/undo/save/reopen behavior.

557 distinct targeted cases, full build/lint, native STEP/project/automation and
real compiled-browser blue/red previews and source-dimension changes pass. The
rendering corpus includes curved/concave/imported solids and pole-edge handling.
Part 8 and immutable codec build 5 guard new meaning; frozen v7 refuses v8.
Evidence: `../Aether-CAD/.verification/extrude-up-to-vertex-2026-10-13/RESULTS.md`.
The official Extrude reference above informed behavior; implementation uses public
FreeCAD/OCCT APIs, without proprietary source, artwork or protocols.

Full Up-to-vertex reference coverage remains open: explicit/implicit mate
connectors, projected points and legacy rectangle sketch points need additional
work. Next extrusion gaps include entity-based starting offsets, general direction
references, automatic merge scope, surface modes and curved next/face limits.
Oblique draft and broader part/sketch/direct-modeling/inspection, topology,
assembly/drawing/exchange and release acceptance remain open. No installed
promotion or full Onshape-equivalence claim follows from this source packet.

### Referenced extrusion starts — 2026-10-13 (development)

Selected parallel solid faces and principal-derived datums now provide associative
starts, with signed additional axial offsets, Blind depth from the new start,
absolute stopping limits, original-sketch draft neutral, opposite ends and scopes.
Native geometry, actual viewport picking, blue/red previews, source edits,
Undo/Redo, Cancel, save/fresh reopen and STEP roundtrips are verified. Part 9 and
codec build 6 protect older readers. Whole-part/mate/surface starts, captured datum
association and arbitrary topology naming remain open. The native handle packet
below closes the referenced-start drag limitation; full parity remains open. See CAD
`.verification/extrude-reference-start-2026-10-13/RESULTS.md`. No installation promotion.


## Automatic extrusion scope — 2026-10-13 (development)

New Add/Remove/Intersect dialogs default to Merge with all, with explicit targets
still available. Native current solids determine contacts on every rebuild. Add
retains the earliest input identity in each disconnected merge group. Remove may
consume whole parts; Intersect and Remove leave non-overlapping parts unchanged.
Reference meshes are excluded. Disconnected tool-only additions are refused.
Producer identities survive later merges; the saved scope result is a projection,
never a frozen native input. Upstream edits can both absorb and restore parts.

Public references: [Extrude](https://cad.onshape.com/help/Content/PartStudio/extrude.htm)
and public [Boolean identity documentation](https://cad.onshape.com/FsDoc/library.html).
Aether implementation uses its native FreeCAD/OCCT boundary. Part10/codec7,
capabilities and parked refusal protect saved meaning. Exact geometry, browser
blue/red previews, Cancel/Undo/Redo, fresh saved-file reopens, packaged project
and agent edits, and STEP roundtrips are recorded in
`../Aether-CAD/.verification/extrude-automatic-scope-2026-10-13/RESULTS.md`.

No installed promotion. Large-model automatic-scope budgets and feature-pattern
sources spanning multiple result groups remain unqualified. Whole-part/mate/
surface starts, captured datum association, surface modeling, curved next/face
limits, general topology naming, broader feature/inspection coverage and the
other workstreams above remain open. This does not close Extrude or full parity.


## Native extrusion handle acceptance — 2026-10-13 (development)

Native preview axes now locate Blind, symmetric and independent opposite Blind
handles after referenced or offset starts. Symmetric travel edits total depth;
opposite Blind travel edits only that end. Upstream edits, reversal, units,
pending/error/stale responses and cancellation share normal authoring behavior.
The renderer projects exact native hints without deciding feature geometry.
No new file meaning or format version was introduced; old simple-Blind fallback
remains. Non-Blind limits and per-profile-group manipulators remain outside this
packet; existing limit/offset fields still work. End-on projection hides unstable
handles. This does not qualify all extrusion or direct-edit modes.

217 distinct targeted tests, full build, focused lint, actual compiled-browser
blue/red drag/Cancel/Undo/Redo and five saved reopen/STEP roundtrips pass. Evidence:
`../Aether-CAD/.verification/extrusion-native-handles-2026-10-13/RESULTS.md`.
No installed promotion. Broader modeling, reference association, surface/curved
limits, inspection and release qualification remain required for full parity.


## General Up to next acceptance — 2026-10-13 (development)

Non-drafted next limits now follow native curved/tilted and stepped first
boundaries across current solid parts. Gaps fail; nearer obstacles cannot leave
stray material behind them. Existing offset, direction, start, operation, thin
and independent-end semantics share the implementation. Native spherical and
cylindrical volumes, partial/multi-face stops, entry/exit and STEP are checked.
292 distinct tests, full build/lint and actual browser preview/edit/Cancel/Undo/
Redo/upstream-failure recovery plus three saved reopen/STEP examples pass.
Public Extrude documentation above supplies the behavior reference. Evidence:
`../Aether-CAD/.verification/extrude-general-next-2026-10-13/RESULTS.md`.

Part10/codec7 unchanged; the current browser requires the matching worker
capability. No installed promotion. Drafted curved/tilted next, general folded
boundaries, surface stops and large-model budgets remain open, alongside the
broader modeling/reference/inspection and release workstreams. These checks do
not close complete Extrude or Onshape parity.


## Drafted general Next acceptance — 2026-10-13 (development)

Drafted Next now supports exact curved/tilted and stepped first solid boundaries,
with complete termination, original-sketch neutral taper, signed starts/end
offsets, independent ends, thin walls and annular profiles. Adaptive tool sizing
avoids unnecessary apex crossing. Invalid coverage/collapse cannot publish a
partial result. A native small-circle offset defect is repaired using analytic
circular boundaries while preserving topology, apex and end-cap checks.

348 distinct tests (225 native,103 frontend,20 isolated packaged), full build/lint,
actual blue/red browser previews/edit/Cancel/Undo/Redo/upstream failure recovery,
three saved fresh reopens and STEP roundtrips pass. Part10/codec7 unchanged; current
clients require extrude-drafted-general-next for either drafted Next end. Evidence:
`../Aether-CAD/.verification/extrude-drafted-next-2026-10-13/RESULTS.md`.

No installed promotion. Curved Up-to-face, oblique draft, general folded boundaries,
surface stops/authoring, broader references, robust topology/direct editing,
inspection, performance and release acceptance remain open. This closes a bounded
Next slice, not complete Extrude or Onshape parity. Continue with exact curved
Up-to-face references and their native picking/repair/save acceptance next.


## Curved Up-to-face references — 2026-10-13

Implemented the full native surface beneath selected curved faces, with both-end
selection, signed axial offsets, sketch-neutral draft, thin profiles and exact
material previews. Cylinder/sphere/cone/torus, polynomial B-spline/Bézier, extrusion
and revolution surfaces have independent volume checks. Trims do not define the
stop. Natural spline domains are preserved; a finite construction patch avoids
OCCT's infinite extrusion-parameter failure without replacing its geometry.

References retain source feature/body and native kind; multiple same-kind faces
need an exact center/area anchor. Changed or ambiguous anchors require reselection.
This is not general topological naming. Part11, native capability guards and
canonical codec8 prevent old readers/workers from silently ignoring new semantics.
Only the codec version whitelist changes, without sharing CAD geometry.

640 distinct cases pass, plus full build/focused lint, actual compiled-browser
face picking, blue/red preview, Cancel/Apply/Undo/Redo/source-edit, two saved fresh
reopens and exact STEP roundtrips. Frozen previous readers refuse the new version.
Native torus topology's class-name bug was also repaired; existing26 topology lint
findings remain unchanged. Evidence:
`../Aether-CAD/.verification/extrude-curved-face-2026-10-13/RESULTS.md`.

Source only; no installed promotion or user-data mutation. Surface-only stops and
output, folded/singular boundaries, oblique draft, arbitrary topology association,
large-model budgets and broader modeling/inspection/release gates remain open.
This packet closes the qualified curved-face slice, not complete Extrude or
whole-product Onshape parity.


## Direct face offsets — 2026-10-13 (development)

Selected-face Offset extends neighboring native surfaces with one signed distance
across multiple parts. Actual face chips, units, blue/red preview, signed drag,
source-history picking, Apply/Cancel/Undo/Redo, upstream edits and save/exchange
are qualified. Radius-collapse, signed material containment and disconnected-solid
overlap guards reject invalid results atomically. References reuse conservative
geometric source/body/plane-or-surface anchors; general topology identity remains
open. The parked evaluator refuses new feature geometry.

716 distinct cases, full build/focused lint, actual compiled-browser workflows,
two fresh saved reopens and four STEP roundtrips pass. Part12/codec9 protect the
new record; frozen previous readers refuse it. Evidence:
`../Aether-CAD/.verification/offset-face-2026-10-13/RESULTS.md`.
Public behavior reference: [Move face](https://cad.onshape.com/help/Content/PartStudio/move_face.htm),
reviewed2026-10-13; implementation independently calls FreeCAD's public API.

No installed promotion. Translate/Rotate, end-entity control, fillet reapplication,
arbitrary topology/folded/singular offsets and large-model budgets remain open.
This closes selected-face Offset, not full Move face or Onshape parity. Continue
with broader direct editing/reference repair and the remaining modeling and
inspection inventory; surface/assembly/drawing/release gates remain unfinished.


### Solid part transform/copy slice — 2026-10-13

Independent implementation from the public [Transform reference](https://cad.onshape.com/help/Content/PartStudio/transform.htm).
Move XYZ, rotation about a numeric origin/unit axis, uniform scaling, validated
nonuniform solids and copy-in-place use FreeCAD public TopoShape APIs. Copies can
also accompany Move/Rotate/Scale and keep stable output IDs through save/history
and downstream editing. Multi-part selection works through the active preview.
Part13/current codec10 and frozen reader12/codec9 acceptance/refusal are verified.

346 distinct focused tests plus production build/types/scoped lint, actual browser
preview/apply/cancel/undo/source edits/four reopens and16 STEP solid roundtrips pass.
See `../Aether-CAD/.verification/part-transform-2026-10-13/RESULTS.md` for exact
scope, source/package hashes, reproducible evidence and the native-kernel finding.

The slice is partial Transform coverage: some curved nonuniform scales fail the
strict native continuity/volume checks and are explicitly refused. Uniform curved
and nonuniform box scaling pass. Selected lines/points/mate connectors, viewport
manipulators and face Translate/Rotate remain open. No installation promotion or
whole-product parity claim. Continue with reference-based/direct editing and the
remaining sketch, solid, inspection, exchange and release acceptance backlog.


### Transform viewport manipulation — 2026-10-13

XYZ move, rotation around the entered arbitrary axis/origin, and uniform/XYZ scale
now expose viewport handles. They change the existing fields and native feature
preview, with document units, fine/keyboard adjustment, continuous angle unwrap,
positive scales, Escape/pointer cancellation and cleanup. Camera projection covers
perspective and orthographic views; ambiguous end-on/edge-on drags are unavailable.
Missing older-worker metadata leaves numeric editing available.

The optional native preview frame uses selected source bounds before tessellation,
with cached mesh data removed. It does not alter Part13 records or codec10.
216 focused cases, build/types/lint, actual pointer edits/cancel/history/upstream
anchor, four saved reopens and eight STEP solids pass. Evidence:
`../Aether-CAD/.verification/transform-handles-2026-10-13/RESULTS.md`.

This closes the viewport-handle gap for the existing numeric transform modes.
Selected lines/points/mate connectors, face Translate/Rotate and reliable general
curved nonuniform scaling remain open, together with the broader parity backlog.
No installed promotion or whole-product parity claim.


### Geometry-referenced transform slice — 2026-10-13

The public [Transform reference](https://cad.onshape.com/help/Content/PartStudio/transform.htm)
includes selected line/point displacement, distance along a reference, referenced
rotation and scale centers. Aether now independently implements these using
earlier authored sketch lines and ordered sketch-point/native-vertex pairs.
Reference resolution stays in the product/FreeCAD path; saved records retain
identities and history dependencies. No renderer-created geometry or new parked
engine feature evaluation. Part14/codec11 guard this new saved meaning.

358 focused cases, full build/types/scoped lint, native/package geometry and
compiled-browser pointer/history/preview picking/upstream edits pass. Six actual
saved-file reopens and12 STEP solid roundtrips, frozen reader13/codec10 refusal
and transient-state exclusion are verified. See
`../Aether-CAD/.verification/referenced-transform-2026-10-13/RESULTS.md`.

This closes sketch-line/two-point reference and point-center workflows. It does
not close single-click solid-edge references, implicit/explicit mate coordinate
systems, face Translate/Rotate, reliable curved nonuniform scaling, topology
repair or the remaining sketch/solid/surface/inspection/exchange/release scope.
No installed promotion and no full Onshape-equivalence claim.


### Solid-edge transform references — 2026-10-13

Selected straight native solid edges now drive full-length or signed/reversed
translation and referenced rotation/copy. The public
[Transform reference](https://cad.onshape.com/help/Content/PartStudio/transform.htm)
informed the workflow; implementation independently uses FreeCAD. Stored ordered
endpoint anchors require exactly one connecting straight edge in current native
history. Source dimension changes update the reference, while replaced, curved or
ambiguous edges refuse regeneration/export. The viewport picker remains available
through previews and keeps the transform body scope separate. Part15/codec12 and
frozen reader14/codec11 refusal protect saved meaning.

386 distinct focused cases plus full build/types/scoped lint pass. Actual browser
edge picks and handles, copies, upstream edits, history/cancel, four saved reopens
and10 STEP solids are qualified. Evidence and reproducible scripts:
`../Aether-CAD/.verification/edge-transform-2026-10-13/RESULTS.md`.

This closes the straight solid-edge reference gap. Mate coordinate systems,
curved-edge axes, face Translate/Rotate, reliable curved nonuniform scaling and
persistent topology repair remain open, together with wider modeling, inspection
and release acceptance. No whole-product equivalence or installed promotion.


### ClassCAD feature families and shared agent operations — 2026-10-13

The CAD source now exposes Part, Assembly, Sketch, Curve, Solid and Drawing in a
Features tray and projects the same definitions into command search. Existing
variants retain exact actions; unavailable entries explain their gaps. Cone is
an exact editable profile/revolve operation, shared by UI and agents. Live agents
also gain all five solid primitives and paginated canonical history references.
The latter does not establish stable face/edge correspondence.

The product-owned [integration inventory](../../../../Aether-CAD/dev/docs/roadmap/ClassCAD_Feature_Integration.md)
records all sixteen supplied Assembly feature families and the264-method public
API comparison scope. The next source slice adds reusable Part templates, atomic
Assembly JSON recipes and explicit linear/circular instance arrays, together with
CAD.AI discovery, bounded Part programs and exact/viewport proof. Nested Assembly
templates, rigid groups, associative patterns, additional mates, independent3D
curves, datum features and drawing authoring/export remain open.
Discovery is not implementation or full ClassCAD/Onshape parity. FreeCAD remains
the exact engine; no ClassCAD code or runtime was adopted.
