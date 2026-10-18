# Aether Studio UI convergence

Jonathan's direction, 2026-09-08: use the old native Anima Studio as the visual
and workflow reference, port it into Aether Animation web, then have Aether CAD
consume the same shared UI. Like a creative application suite, tools and layout
vary by product; the controls, typography, themes and interaction rules do not.

## Authority

- Native reference: the archived Swift app, removed from the tree on 2026-09-23
  — read it from git history (`aether-animation/archive/swift-app/Sources/
  AnimaStudioUI/`; `Theme/StudioDesignProfile.swift` supplied the accepted
  structural palette, now in the shared tokens).
- Shared implementation: `core/ui/`, imported as `@aether/ui`.
- Products: compose shared UI with product data and actions. Do not restyle shared
  ViewCube, Tree, DataTable, fields, dialogs, tabs or ribbons with private skins.
- One semantic authority: Python and Core keep their current responsibilities.
  Port presentation and bridge consumers; do not translate Swift evaluation into
  another browser-side engine.

## Implemented in this convergence pass

- Native structural palette, system typography and 54px document bar live in the
  shared JSON/CSS tokens and reach both apps.
- CAD now uses the same `WorkspaceShell` as Animation for side rails, docked,
  floating and canvas chrome; existing product tools and commands remain.
- CAD's private shared-ribbon, ViewCube and numeric-field skin overrides removed.
  The ViewCube in both products is `ViewportNavigationCube`; each renderer only
  adapts camera state and actions. Animation now implements face/Home/nudge/roll.
- Panel content can retain its DOM, input drafts and external editor bindings
  across shell placement changes. The viewport remains mounted across presets.
- Versioned device-local per-preset panel preferences are available in the shared
  shell and adopted by Animation. CAD retains its existing presentation store.
- Floating headers support keyboard movement; resize clamps floating coordinates.
  Compact windows reveal side panels from their rails instead of permanently
  compressing the viewport between two wide sidebars.
- The current launcher is `Aether Animation.app`. The old native bundle and its
  sources were removed from the tree on 2026-09-23 (Jonathan); the parity gates
  below are measured against git history and the reference steps recorded per
  gate.

## Native-to-web parity gates (not complete)

This is a shared-chrome port, not a claim of complete native application parity.
The current web Animation app still opens the sample character and has a limited
Assets workflow. The remaining conversion must be measured against native flows:

1. Assets/library, project selection, import and native package reopen/save.
2. Rig/connector authoring parity, exact CAD asset rendering, face/edge picking.
3. Clip/keyframe creation and editing, curve editor and persistence. Current web
   timeline supports playback/scrub, but its keyframes remain read-only.
4. Show and Hardware sessions, live output ownership and safe disconnect behavior.
   Their top-level web tabs are explicitly disabled pending bridge-backed flows.
5. 2D/VR workspace and performance-capture parity where implemented natively.
6. Native window integration, settings and accessibility comparisons at desktop
   and tablet sizes; cross-device persistence remains a suite-host milestone.

Each gate needs native reference steps, available bridge operations, implemented
web behavior, tests and browser verification. Missing protocol operations require
an engine-lane contract handoff before a frontend can claim the workflow works.

## Onshape mockup: extraction and retirement

Keep `onshape mockup/` for now. It contains fixture modeling, not production CAD
semantics. The following lessons are applied in shared UI: retain renderer/editor
state during layout changes, validate versioned preferences, remember presets,
keyboard-move panels, and keep floating coordinates reachable after resize.

Still compare and integrate or explicitly reject:

- edge-drag docking to all four edges and its drop-target feedback;
- independently dockable ribbon, feature history, ViewCube and element tabs;
- per-preset reset/restore controls and layout persistence across both products;
- feature context menus, rollback and parameter editing against real Core state;
- touch/pointer ergonomics and accessibility in real modeling workflows.

Delete the mockup only after these decisions and production replacements have
been verified and the reference interactions are no longer needed. Do not copy
its procedural modeling or JSON fixture format into production.

## Browser-installed delivery direction (2026-09-08)

Jonathan prefers Safari Add to Dock, as used for Onshape. Target one independently running Aether Studio host with package URLs for CAD and Animation, accessible through browsers and optional browser-installed app windows. Core UI remains responsible for visual consistency; browser installation alone does not unify component implementations. Keep current Swift launchers transitional until host lifecycle, local startup and cross-device serving are implemented and verified. Do not require a client app window to remain open to keep the host running.

## What the native app's engine seam implied for the web rebuild (2026-09-23)

Reviewed by Claude at Jonathan's direction before the Swift tree was removed,
so nothing backend-relevant went with it:

- **Bridge coverage.** The native client used 20 bridge methods (`hello`,
  `load_character`, `validate_character`, `serialize_character`, `evaluate`,
  `resolve_pose`, `forward_kinematics`, `solve_ik`, `mate_types`,
  `relation_types`, `preview_mate`, `add/update/remove_mate`,
  `add/update/remove_relation`, `update_part`, `release`, `shutdown`). All are
  served by `aether_animation/bridge.py` today, plus workspace/assembly methods the
  native app never had. The web app calls six of them; the rest is gate work,
  not engine work.
- **CAD import.** The native seam (`AetherKit`) wrapped OCCT for exactly one
  job: `aether_kernel_load_step` plus edge tessellation for display, with the
  RealityKit / Metal / WebGPU viewports doing the rest natively. The web app
  renders OBJ through three.js and has no STEP path. When Animation needs
  STEP, the server-side home is `Aether CAD/freecad-engine`
  (`aether_freecad/importing.py: import_step`) or a small aether_animation endpoint
  over it — not a port of the Swift/C++ shim. The connector-candidate and
  in-world tool-geometry contracts the seam declared are already covered by
  aether_animation's mate capability contract (`test_cad_mate_capability_contract`).
- **Project package.** The native `.animastudio` package was Swift-only:
  `project.json` (ManifestV2: `format_version`, `project_id`, `display_name`,
  `revision`, `milestone_name`, dates, `characters[]` with `folder_name` /
  `character_file` / `editor_file` / `source_kind` / library ids, `scenes[]`,
  `editor_state` with the active character / scene / workspace, `assets[]`
  with `kind` and `embedded|linked` mode), `characters/<name>/<name>.character.anima`
  + `<name>.editor.json`, `scenes/`, and `assets/{models,assemblies,images,
  video,audio,renders,scripts}`. The canonical content inside it
  (`.character.anima`, `.scene.anima`) is aether_animation's and stays readable; only
  the manifest and editor metadata were Swift's. A web project format should be
  written fresh in aether_animation (alongside `aether_project.py`), using this layout
  as the reference if old packages ever need migrating. The only known
  packages are five throw-away "Untitled Project" test saves in
  `~/Documents/AnimaStudio`.
- **Sessions and evaluation.** Hardware / show session semantics (arm,
  ownership, heartbeat, e-stop) already live in aether_animation; the Swift side had
  none. The transitional Swift evaluation had already shrunk to a projection
  (`AnimaEvaluation` 79 lines, `AnimaModel` 347 lines) — nothing to carry.
- **Kept.** The three import-unit fixtures (mm STL, cm OBJ, metre USDA) now
  sit in `aether_animation/tests/fixtures/import_units/` with their expected scales.
  The app icons were already duplicated in `core/assets/branding/originals/`.
