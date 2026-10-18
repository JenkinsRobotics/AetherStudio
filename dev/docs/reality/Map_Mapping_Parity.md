# Mapping authoring audit — 2026-09-28

> Historical inventory. For the current supplied-guide comparison and October 4
> controls, see [the acceptance matrix](../roadmap/Aether_Map_Lazy_Lighting_Acceptance.md).
> Later work supersedes the old missing-feature rows below.

**Result: core polygon mapping is usable; full Lazy Lighting parity is not yet
established.** This audit covers creating/editing masks and stable scene display,
not the full visual-effects, sequencing, or projector-device product. Photoshop
and Illustrator are interaction-quality references, not a claim of feature parity.

Reference: [Lazy Lighting's official Mapping Guide](https://lazylighting.com/en/help/mapping),
reviewed 2026-09-28. It documents quad/circle/cube/text/image authoring, corner
warping, rotation, bending, snapping/welding, edge-point insertion, individual
point rounding, visibility/duplication/deletion, undo, and mapping display settings.
The earlier `roadmap/Lazy_Lighting_Parity.md` concerns specific visual/runtime
features; its completed checklist does not certify complete mask-authoring parity.

## Projection follow-up — 2026-09-29

The inventory below records the original September 28 audit; later authoring
work is recorded in STATUS and Shared_Vector_Coverage. This follow-up verifies
content projection, not a blanket completion of every historical parity gap.

- Surface and whole-scene content assignment/replacement are browser verified.
- Content placement offers Stretch, Fit (contain), and Fill (cover), retaining
  input crops and matching the output renderer. Skewed quad aspect uses mean
  opposite-edge lengths; this is not physical 3D surface reconstruction.
- Scene-wide visual geometry follows artboard resize; other surfaces keep their
  authored geometry. Placement survives document reload.
- Output loop/hold timing follows its linked scene, independently of editor
  scene focus. Text silhouettes, compound holes, vector gradients and cylindrical
  bend continue to match the output.
- New shader clips and animation cycles default to an editable 15 seconds.
  Adding a shader starts shared playback; Pause and scrubbing remain synchronized.
  Native Tunnel/Kaleidoscope speed is repaired, and static defaults receive
  modulation. Existing saved static/timing choices are preserved. Clip duration
  and animation cycle are separate; not every procedural cycle is seamless.

Evidence: 474 unit tests, production build and seven Chromium checks.
New regression: `aether-map/e2e/projection-placement.spec.ts`; related regressions
in `mapping-authoring.spec.ts` and `vector-integration.spec.ts`. Logs:
`/tmp/map-projection-final-tests.log`, `/tmp/map-projection-build.log`,
`/tmp/map-projection-final-browser.log`, `/tmp/map-projection-shapes-browser.log`.
Scene-projection screenshot reviewed; native shader pixel changes tested.
Physical projector calibration and Safari/WebKit remain outside this check.

## Corrections verified in the September 28 pass

- Each artboard now uses the same renderer and remains mounted by scene ID.
  Previously inactive scenes omitted their backdrop and used different X-ray
  and guide rendering. Selecting a scene now changes editing chrome, not its
  reference image, layer geometry, or alignment pattern.
- Enabled backdrops remain visible on inactive scenes; visibility and image
  transforms remain scene-owned and persist through reload. Deselected backdrops
  remain clipped to the scene; selecting one reveals its editable full extent.
- Mapping holds geometry at time zero and suppresses visual content, as requested.
  Black Mask and newly drawn Cutout layers retain black coverage. The Mask command
  now creates a mask-type layer instead of a normal surface containing a black clip.
- Node mode exposes every outline point, including dense/freehand and unassigned
  surfaces. Double-click an edge to insert a point. Selecting a square mask handle
  and pressing Delete/Backspace removes that point, with a minimum of three;
  the operation cannot delete the surface. Arrow nudging and Shift ×10, and Undo,
  work with those edits. Round warp handles remain distinct from square mask handles.
- The Outline inspector offers **Edit outline points**, and the canvas gives
  concise point-editing instructions. Manual outline changes clear regular-polygon
  regeneration metadata so later edits do not silently replace the custom outline.
- The Properties panel now has Mapping geometry commands: horizontal/vertical
  reflection of a surface or an entire compound, using a shared pivot and one
  document transaction. A locked member blocks partial reflection. Group
  selection shows its name/count instead of the former empty-selection message.
- Selecting a square outline point in Node mode exposes **Round amount** and
  **Round selected point**. This replaces that corner with a sampled tangent
  quadratic curve; it is an editable polygon after application, not a retained
  Bézier/radius constraint. Undo restores the original corner. Editor/output
  clipping and saved outlines use the same points, with no new file format.
- Corner and mask-point drags snap to nearby real vertices, including scene
  corners. Alt bypasses snapping. **Mapping precision** in Properties controls
  snapping, screen-pixel tolerance, node-pin size and canvas grid visibility.
  These browser preferences survive reload and do not alter the show or output.

## Current capability inventory

| Area | Aether Map today | Assessment |
|---|---|---|
| Basic geometry | Rectangle/square, ellipse/circle, adjustable regular polygon, pen and freehand profiles | Present; not a Bézier path editor |
| Compound geometry | Three-face cube and five-face box, group and individual-face selection/transform | Present; preserve shared component identity |
| Object transforms | Move, side/corner resize, rotation, numeric editing, four-corner projective warp | Present |
| Outline editing | Multiple polygon profiles, point drag/add/remove/nudge, dense points and workspace-root editing | Present; edge insertion/deletion corrected here |
| Black masking | Black mask layers and drawn cutouts over lower layers | Present; black coverage corrected in Mapping |
| Layer operations | Shared Aether UI TreePanel; hide, rename, delete, ordering, folders, group/ungroup, scene transfer and multi-selection | Present; folders are one level deep |
| Scene appearance | Per-scene reference, geometry, visibility, clipping and consistent editor appearance | Corrected and browser verified |
| Alignment | Bounds/center and vertex snapping, guides, Alt bypass, pan/zoom/fit and X-ray | Present; not corner welding |
| History | Document undo/redo and coalesced pointer gestures | Present; point insertion/nudge/delete/undo browser verified |
| Curves/rounding | Individual point rounding, sampled ellipse and whole-surface corner radius | Point rounding present; generated polygon nodes remain editable, no retained Bézier handles or radius constraint |
| Curved projection | Projective quads | Missing cylinder bend / editable mesh warp |
| Text masks | Text exists as visual content in Visualization | Missing text-shaped mask geometry |
| Image masks | Transparent-PNG input/import | Missing automatic subject isolation; Smart Shape Detection remains disabled |
| Corner connections | Movement/resize and vertex snapping | Missing persistent welded/shared-vertex constraints |
| Precision preferences | Properties: snap toggle/distance, node-pin size and canvas grid; saved browser preferences | Present and reload verified |
| Geometry reflection | Horizontal/vertical reflection of surfaces and whole groups, with mask geometry | Present; common pivot and atomic Undo verified |
| Mixed geometry/visual preview | Mapping uses alignment patterns; Visualization previews content | Deliberate separate-workspace workflow; no Mapping visual-preview toggle |

## Evidence and limits

Implementation: `aether-map/src/SurfaceCanvas.tsx`, `SceneBackdrop.tsx`,
`useSurfaceInteraction.ts`, `masks.ts`, `App.tsx`, `mask/shape-surface.ts`,
`panels/PropertiesPanel.tsx`, `MappingControls.tsx`, `mapping-preferences.ts`,
`layer-transform.ts`, and their focused tests.

Browser evidence uses an isolated temporary host and disposable projects, not
the user's project: two reference images and compound shapes, repeated scene
switches with DOM identity/style checks, uniform X-ray, hide/reload/show, real
pointer insertion and keyboard editing/Undo. The regression set also covers
shared trees, output deletion, backdrop clipping, and both toolbar variants.

Verification: 441 Map unit tests in 51 files, production typecheck/build, and
22 Chromium checks pass. Rounding matched the output window, survived reload,
and undid/redid correctly. Compound reflection reversed all faces together;
precision preferences survived reload without changing geometry.
Screenshots inspected in light mode; the existing toolbar
regression also covers light/dark palettes. Logs: `/tmp/map-parity-tests.log`,
`/tmp/map-parity-build.log`, `/tmp/map-parity-browser.log`. Screenshots:
`/tmp/map-parity-browser-results/`. Build retains its existing large-chunk warning.

This is not a Safari/WebKit sign-off, physical-projector calibration test, or
multi-user load test. Visualization's inactive-scene playback policy was not
changed. Existing black visual clips without mask identity are not reclassified
automatically; doing so could incorrectly convert ordinary black artwork.
The missing authoring capabilities above remain open; this document does not
declare full competitor or Adobe parity.
