# Inheriting from FreeCAD and OCCT

**2026-10-03 audit:** inheritance is not complete. The current
[Part/Assembly/Drawing parity and reference-retirement gates](FreeCAD_Parity_Acceptance.md)
supersede any inference of completion from this historical spike report.
The installed native engine reports 1.1.3; the reference archive identifies
itself as 26.3 development. Neither a green adapter suite nor copied workbench
icons establishes whole-application parity. Retain the reference pending the
acceptance gates; the installed FreeCAD runtime remains an active dependency.

**Decision (Jonathan, 2026-09-12): keep our design, inherit the engine.** The
UI, document model and product shape stay ours. Anything below that line —
solving, projection, tessellation, exchange — we take from FreeCAD and OCCT
rather than write, wherever it is genuinely available.

**Superseding decision, same day: headless FreeCAD is the baseline engine.**
Rather than reimplement parametric features one at a time, Aether CAD drives
FreeCAD's own solver and feature set through a narrow JSON boundary:
`Aether CAD/freecad-engine/` (see its README and ATTRIBUTION). I argued
against this on concurrency grounds and Jonathan's call stands; the sections
below are kept because they remain the record of what is available à la carte,
and because the browser OCCT path is still what serves interactive work.

What that decision costs, stated once so it is engineered rather than
discovered: each worker is a **native process holding OCCT memory**, so
concurrency becomes a process-pool sizing problem instead of being free. The
boundary is built stateless-per-job specifically so a pool can be shared
rather than pinned per user. Sizing it against the 200-concurrent-user target
is tracked in `dev/docs/roadmap/Host_Scaling.md`.

**Open question for the next session:** what remains of the browser engine.
My read — keep both. FreeCAD is the authority for parametric features; the
browser OCCT/WASM path stays for interactive preview and selection, where a
server round trip per drag would be unusable. The boundary in
`freecad-engine/protocol.py` is written so either can satisfy it.

This document records what is *verified* available, what it replaces, and in
what order. Numbers here were measured on 2026-09-12, not estimated.

## Why this document exists

Building the sketcher one constraint at a time was costing days per feature.
Measured cause:

| Layer | Non-test LOC | Who does the hard part |
|---|---|---|
| `engine/src/kernel/` | 893 | OCCT, via `replicad` + `opencascade.js` |
| `engine/src/sketch/` | 15,389 | us |
| └ `sketch/solver/` | 2,599 (+5,313 test) | us |
| └ `sketch/operations/` | 6,819 | us |
| `Aether CAD/src/` (UI) | 27,726 | us — and correctly so |

B-Rep solid modelling, the hardest part of CAD, is the *smallest* module
because we borrowed OCCT. 2D constraints are the largest because we did not.
The strategy already works here; it was simply never applied above the kernel.

## Tier 1 — already inherited

**OCCT via `replicad` + `replicad-opencascadejs`.** Solids, booleans,
fillet/chamfer, STEP import, exact topology. Keep as is.

## Tier 2 — inherit as code

### 2a. Sketch constraints → FreeCAD PlaneGCS (spiked, viable)

`@salusoft89/planegcs` is FreeCAD's Sketcher solver (`planegcs`) compiled to
WASM with full TypeScript types, published on npm, LGPL-2.0-or-later.

**Spike result (2026-09-12).** `solver/planegcs-spike.ts` maps our drawing
model onto planegcs primitives behind the existing
`solveDrawingConstraints(source, options)` seam. A harness ran the *existing*
sketch corpus — 539 tests, 1,878 real solve calls — through both solvers and
compared coordinates:

| Verdict | Solves | Share |
|---|---|---|
| unsupported *by the spike* | 867 | 67.4% |
| **agreed to 1e-6** | **211** | **16.4%** |
| spike mapping still failing | 163 | 12.7% |
| both rejected | 23 | 1.8% |
| disagreed | 17 | 1.3% |
| planegcs solved what we reject | 6 | 0.5% |

*(Updated after mapping `fix` to planegcs `coordinate_x`/`coordinate_y`, which
was the main source of disagreement: agreed 202 → 211, disagreed 26 → 17.)*

*(1,287 solves carrying at least one constraint; the other 591 calls had no
constraints and return early in both solvers.)*

**Fifteen of our twenty-seven constraint kinds produced identical geometry:**
horizontal, vertical, fix, radius, diameter, length, distance, angle,
coincident, concentric, parallel, perpendicular, equal, tangent, symmetric.

Nothing was rejected because planegcs cannot express it. The gaps break down as:

- **Spike scope, planegcs supports it natively:** bezier segments (198) and
  ellipse segments (138) — planegcs has B-spline, ellipse, hyperbola and
  parabola primitives; the spike simply did not map them.
- **Ours to keep:** `pattern` (192), `slot` (47), `offset` (66) are
  higher-level Aether constructs, not solver primitives. Offset has an OCCT
  answer (2c).
- **Spike mapping bugs, not limits:** 163 "expected Point, got Curve" (a
  curve-contact reference still resolving to the segment), plus 121
  reference/driver dimensions whose value the spike reads before resolving.

**The one real migration cost:** the remaining 17 disagreements are
*different valid solutions*, not wrong ones. Constraint systems have many
solutions and the two solvers pick different branches, so existing sketches
re-settle and pinned coordinates in tests change. That is a re-pinning
exercise, and FreeCAD has the same character.

**What it buys:** deletes ~2,599 lines of residuals, damping, rank and
diagnostic code; turns "add a constraint type" from a residual + Jacobian +
diagnostics + tests job into a mapping entry; and hands us
`get_gcs_conflicting_constraints()`, `get_gcs_redundant_constraints()` and
`get_gcs_partially_redundant_constraints()` — which is what
`solver/diagnostics.ts`, `diagnostic-rank.ts` and `diagnostic-residuals.ts`
hand-roll today.

**Known integration constraint:** the wrapper needs an awaited WASM init while
our seam is synchronous. Pre-warm during app startup, as the viewer already
does for the OCCT worker.

### 2b. Drawing views → OCCT hidden-line removal (biggest single win)

`dev/briefings/claude.md` currently assigns Core to own "B-Rep projection,
hidden-line classification, section/detail/auxiliary/broken view geometry"
by hand. **That is already in the WASM build we ship.** Verified in
`replicad-opencascadejs/src/replicad_single.d.ts`:

| OCCT binding | References | Gives us |
|---|---|---|
| `HLRBRep_Algo` | 23 | hidden-line removal — visible/hidden edge classification |
| `HLRAlgo_Projector` | 14 | the view projection HLR runs against |
| `BRepMesh_IncrementalMesh` | 8 | controlled tessellation for display |
| `BRepOffsetAPI_MakeOffset` | 11 | exact offsets |
| `GeomAPI_Interpolate` | 6 | spline fitting through points |
| `ShapeUpgrade` | 6 | shape repair / conversion |
| `STEPControl_Writer` | 8 | STEP **export** |
| `IGESControl_Reader` | 0 | **not** exposed — IGES needs a different build |

Do this before writing any drawing projection code. It is the difference
between a hand-written hidden-line classifier and calling the same algorithm
FreeCAD's TechDraw calls.

### 2c. Smaller inheritances, same principle

- `offset` constraint → `BRepOffsetAPI_MakeOffset` instead of our own offset
  residuals (66 unsupported solves today).
- Fit splines / bezier → planegcs B-spline plus `GeomAPI_Interpolate`.
- STEP export → `STEPControl_Writer` (we already read STEP).

## Tier 3 — inherit as specification, not code

FreeCAD is C++ against its own document model; its *app* does not port into a
TS/WASM web product, and we are keeping our design anyway. What transfers is
**behaviour**:

- PartDesign feature semantics — what pad/pocket/dress-up do to a body, and
  the sketch-attachment rules.
- The topological naming problem and how FreeCAD's mitigation works — worth
  reading before our feature-reference model hardens.
- Sketcher interaction rules. Two community documents in the upstream
  `planegcs` repository are the best available write-ups: *Sketcher Lecture*
  (Christoph Blaue) and the *Solver manual* (Abdullah Tahiri).

Write these down as target specs so features stop being discovered mid-build.
Onshape stays the interaction reference it already is.

## Recommended order

1. ~~**HLR for drawings**~~ — **done 2026-09-12**:
   `engine/src/kernel/hidden-line.ts`, exported from `@aether/core/kernel` as
   `projectHiddenLineView`. Returns visible/hidden sharp edges and
   visible/hidden silhouettes as view-plane polylines, with an explicit view
   normal and up direction so a view is reproducible rather than rolled to
   whatever OCCT picks. Four tests: a box projects true-size with its far
   edges classified hidden; a cylinder's silhouette is found where no B-Rep
   edge exists; an occluded solid's hidden length exceeds its hidden length
   from the opposite side; a degenerate view direction is refused.
   *Nothing consumed the old path because there was no old path* — this is
   the Drawing packet's projection layer, ready before the packet is written.
2. **Finish the planegcs mapping so it can become the default.** In order of
   how many real solves each unblocks: curve-contact references (163 mapping
   failures), bezier segments via planegcs B-spline (198), ellipse segments
   (138), reference/driver dimensions (121). `fix` is done.
3. **Then swap the seam and re-pin** the coordinates that legitimately move.
4. **Offsets and spline fitting** to OCCT (`BRepOffsetAPI_MakeOffset`,
   `GeomAPI_Interpolate`) — retires the `offset` constraint's 66 solves.
5. **Tier 3 specs**, continuously, ahead of each feature packet.

## What is active today

| Capability | Status |
|---|---|
| OCCT kernel (solids, booleans, STEP read) | **active**, always was |
| OCCT hidden-line removal | **active** in the engine; no UI consumes it yet because the Drawing workbench does not exist |
| PlaneGCS sketch solving | **not active.** Our solver is still the default; planegcs runs only when a test harness registers the comparison hook |

PlaneGCS cannot be switched on yet — not for caution, but because the mapping
currently covers *less* than our own solver does. Making it the default before
the step-2 list is finished would break sketching that works today.

**No UI change, at any point.** Both inheritances sit below
`solveDrawingConstraints(source, options) → SketchDrawing` and below the
kernel's shape API. The 27,726-line UI layer is untouched by design — that is
what makes this approach safe to do incrementally.

## License

PlaneGCS is LGPL-2.0-or-later, loaded as a WASM module — the dynamic-linking
case. This repository is already framed as an open system, so the obligation
is compatible, but it is a decision to record rather than assume. OCCT is
LGPL-2.1-with-exception and already in use.

## Spike artefacts (delete when the migration lands or is abandoned)

- `engine/src/sketch/solver/planegcs-spike.ts` — the mapping and the recorder.
- `engine/src/sketch/solver/planegcs-setup.ts` — WASM init + hook registration.
- `engine/vitest.spike.config.ts` — runs the corpus with the hook registered.
- The hook in `solver/solve.ts` — a `globalThis` lookup, nothing imported, so
  production bundles are unaffected (verified: `planegcs` appears in no built
  asset, and the CAD production build passes).

Re-run: `AETHER_SOLVER_REPORT=<file> npx vitest run --config
vitest.spike.config.ts src/sketch` from `Aether CAD/aether-engine`.
