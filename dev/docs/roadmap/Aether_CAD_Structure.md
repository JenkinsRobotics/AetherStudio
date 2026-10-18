# Aether CAD — structure audit and refactor plan

Measured 2026-09-12. Line counts exclude tests.

## Already clean — leave alone

| Area | Largest file | Note |
|---|---|---|
| `Aether CAD/aether-engine/src` | 487 (`planegcs-spike.ts`) | The engine is well factored. Nothing here is a god file. |
| `core/ui/src` | — | Shared design system, one component per file. |
| `Aether CAD/src/tools/` | 100ish | One file per ribbon tray (done 2026-09-12). |
| `Aether CAD/src/features/` | 161 | One file per feature editor. |
| `Aether CAD/src/react/panels/` | 255 | One file per tray panel (done 2026-09-12). |

The pattern to copy is `features/`: a file per thing, a `shared.ts` for what
several of them need, an `index.ts` that assembles.

## The god files, worst first

### 1. `src/viewer.ts` — 1867 lines (was 2027), one class

**Started.** Three seams are out, each with tests it could never have had
inside the class:

| Extracted | Lines | Tests |
|---|---|---|
| `viewport/picking-math.ts` — screen projection, face-from-triangle, bounds | ~100 | 11 |
| `viewport/orientation-cube.ts` — the ViewCube's geometry, hit-test and hover | ~160 | 10 |
| `viewport/appearance-themes.ts` — the five render environments and their lighting | ~110 | 8 |

The face-selection arithmetic and the ViewCube's fillet geometry previously
needed a live WebGPU renderer to run at all, so neither was under test.

**Still inside the class**

`MateViewport` is still several subsystems in one class. What remains is
stateful, so it is not a copy-paste move like `panels/` was: each extraction
needs a context object carrying the members it shares.

| Responsibility | Roughly | Notes |
|---|---|---|
| Selection and picking | 1456–1830 | **How faces are selected.** Touches ~20 of the 106 members: `raycaster`, `hover`, `parts`, `camera`, `renderer`, `pointer`, `tool`, `callbacks`. Extract first — it is the most asked-about behaviour and the most bounded. |
| Camera and orientation cube | 666–941 | Nearly standalone: view presets, nudge, roll, the cube's own hit-testing. |
| Mate connectors | 623–665, 1862–2020 | **How mates work** on the viewport side. |
| In-world sketch surface | 1006–1055, 1202–1394 | The CSS3D sketch plane and coordinate mapping. |
| Reference geometry and planes | 942–1150, 1221–1294 | Origin, axes, datum planes, plane tinting. |
| Parts and materials | 554–601, 949–1005, 1157–1201, 1970–2010 | Add/remove/replace rendered parts, face materials. |
| Appearance | 293–401 | Display style, lighting, background, ground. |
| Render loop and metrics | 1395–1455 | Resize, frame sampling, geometry metrics. |

Suggested shape: `viewport/selection.ts`, `viewport/camera.ts`,
`viewport/connectors.ts`, `viewport/sketch-surface.ts`,
`viewport/reference-geometry.ts`, `viewport/parts.ts`,
`viewport/appearance.ts`, with `viewer.ts` owning the scene, the shared state
and the wiring.

### 2. `src/main.ts` — 1386 lines

App wiring: status text, command registration, list synchronisation, part
lifecycle, display-style/lighting/background/ground registration, assembly
rendering. Natural split: `startup/commands.ts` (the ~8 `register*` helpers),
`startup/part-lifecycle.ts`, `startup/presentation-sync.ts`.

### 3. `src/sketch-workspace.ts` — 1099 lines

The sketch editor: tool dispatch, picking, rendering, panel mounting, commit.
`src/sketch/` already holds its panels and helpers; the workspace itself never
got the same treatment.

### 4. `src/react/AetherCADShell.tsx` — **done**: 424 lines (was 2029)

Panels to `react/panels/`, the five Assembly dialogs to `react/dialogs/`, the
chrome (command rail, viewport tools, selection controls, camera navigation,
viewport surface, Drawing route, start centre) to `react/chrome/`. What is
left is the shell composing them.

### 5. `src/cad-assembly-bridge.ts` (779) + `cad-assembly-controller.ts` (764)

**How mates work** on the document side. Bridge is wire decode/encode;
controller is mate authoring, solving and BOM. The controller is the one to
split — mate authoring, relations and BOM are three things.

### 6. `freecad-engine/aether_freecad/worker.py` — 667 lines

Every feature builder in one module. Natural split, mirroring the translator:
`builders/sketches.py`, `builders/solids.py` (pad/pocket/revolve/sweep),
`builders/dressups.py` (fillet/chamfer/shell/mirror), `tessellate.py`.

## Theming

Theme tokens live in `core/ui/src/widgets.css` as `--aether-color-*`; app CSS
consumes them. That separation is right. What was wrong was app CSS bypassing
it with hand-tuned literals.

`dev/check-theme-literals.mjs` has enforced this for `studio/src` since it was
written, with a comment saying CAD was a follow-up packet. It now covers
Aether CAD too, and runs in the CAD build.

| Stylesheet | Literals before | Now |
|---|---|---|
| `feature-authoring.css` (floating windows) | 21 | **0** — every one mapped to an existing token. It was effectively unthemed and would have broken in light mode. |
| `sketch-workspace.css` (sketch canvas) | 9 | **0** — these are domain colours (an open contour reads amber because it is unclosed), so they became a named `--cad-sketch-*` palette that a theme can override in one block. |
| `style.css` | 37 | 37 — listed in the guard's `PENDING` set. |
| `react/shapr-shell.css` | 24 | 24 — same. |

`PENDING` is deliberately a list in the checker rather than a silent skip, so
the remaining sweep is visible in code. Deleting a name from it makes the guard
hold that file clean.

## Dead code, orphans and half-built pipelines

Swept 2026-09-12. `noUnusedLocals`/`noUnusedParameters` are already on and
passing, so unused *locals* cannot accumulate. What TypeScript cannot see is
unused exports, orphaned modules and code that is written, tested and wired to
nothing.

### Removed

- **Five deprecated re-export shims** left at `src/` root by the engine move:
  `exact-topology.ts`, `occt-part-evaluator.ts`, `occt.worker.ts`,
  `part-geometry.ts`, `worker-client.ts`. Each was two lines re-exporting from
  `@aether/core/kernel`; `occt.worker.ts` was `export {}` — a "compatibility
  marker" exporting nothing. Nothing in the repo referenced any of them.
- **Over-exports from the panel split.** Splitting `AetherCADShell.tsx` used a
  blanket `export` regex, which published internals (`MateActionsMenu`,
  `LegacyMateProof`, `assemblyTabs`, `bomColumns`, `CONTEXT_LATER`). Un-exported,
  and `panels/index.ts` trimmed to the trays the shell actually mounts.

### Half-built pipelines — both now wired rather than deleted

- **The status bar was lying about the engine.** `main.ts` hard-coded
  `` `${viewer.backendLabel} · OCCT ready` `` no matter what was running, while
  `describeGeometryEngine()` — a written, exported client for the host's
  `/api/cad/engine` endpoint — was never called by anything. The endpoint works
  and is tested. Now called on startup: the bar reads
  "Three.js WebGPU · FreeCAD 1.1.3", and says so honestly if no engine answers.
- **`shortcuts.ts` was an unimplemented feature, not a duplicate.** 113 lines
  whose own doc comment reads *"THE central keyboard map. Every shortcut in the
  product is declared here... Nothing else should hard-code a key."* It is fully
  tested and was imported **only by its own test**. Meanwhile the sketch
  workspace handled just Escape and the arrow keys, so Onshape's single-letter
  bindings (s, l, r, c, a, d, m, o) did nothing at all. The workspace now
  consults the registry, with a typing guard so a field still types and a
  modifier still belongs to the browser.

### Still exported but unimported — for review, not yet touched

These are internal helpers published beyond their module. None is dead code;
each is a missing `export` removal in a file this pass did not otherwise open.
Low value, zero risk, safe to do in one sweep:

`aether-core.ts::createEmbeddedAetherCoreClient` (the documented escape hatch
to the parked WASM engine — keep or delete deliberately, it is the only
app-side constructor for it), `cad-appearance-store::aetherEnvironmentBundle`,
`cad-assembly-bridge::decodeAssemblySolution`/`decodeBOMProjection`,
`cad-drawing-bridge::decodeDrawingRebuild`, `features/index::featureEditors`,
`features/regions::stampRegion`/`syncRegions`,
`sketch/canvas-renderer::SKETCH_GRID_MILLIMETRES`/`SKETCH_PLANE_HALF_MILLIMETRES`,
`sketch/constraint-marks::constraintsForEntity`,
`react/CADDocumentSettings::documentAPI`.

The ~100 exported *types* that nothing imports are not on this list: a type
naming a function's public shape is legitimate even when no consumer spells it,
because TypeScript is structural.
