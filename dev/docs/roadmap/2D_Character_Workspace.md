# 2D Character workspace (groundwork)

**Status:** groundwork spec, 2026-07-23. The engine pipelines it stands on are
built (`aether_animation/raster/`, `aether_animation/frame_serial.py`, `aether_animation/raster/mscript.py`
— see `2D_Character_Pipeline.md`). This doc lays out the app workspace + the
Studio↔AnimaCore bridge contract it needs. Refine freely.

## The shape

A **2D** authoring workspace, peer to Rig / Animate (not a sub-tab of Character).
It operates on the *active Character's* `canvas2d` the same way Rig operates on
its rig, so one Character can be hybrid — a 3D rig **and** a 2D face/canvas
(3D body → box, 2D face → LED panel; the earlier plan's hybrid case).

Slots into the existing shell with no new machinery — it is one more
`StudioWorkspaceKind` (Codex's `WorkspaceDescriptor.swift`):

```
case canvas2d        // title "2D", icon e.g. "square.on.square", ⌘8
purpose:      "Compose 2D surfaces, faces, and media; drive an LED panel"
viewportLabel:"2D PREVIEW"
presentation: navigator + inspector on, bottomEditor ON (the Mscript/timeline)
```

Add to `centeredNavigation` as a top tab (Character · Rig · Animate · 2D · Show
· Hardware), or keep it ⌘-reachable first and promote later.

## Layout (maps to the shared three-sidebar shell Codex already built)

- **Center — the 2D preview.** Renders the composited canvas live. Swift draws it
  natively from the bridge's `SurfaceState`s (crisp, interactive, selectable) —
  the renderer-neutral path, mirroring how RealityKit draws evaluated 3D pose. A
  toggle overlays the **LED-matrix simulator** (the engine's real downsampled
  `FrameBuffer`, so preview == panel). Full-bleed like the spatial viewport.
- **Left navigator — two trees.** *Surfaces* (z-ordered layers, reorder/lock/hide,
  the universal tree ops) and *Media* (the character's image/sprite/gif/video/
  bitmap sources + the procedural faces).
- **Right inspector — the selected item.** Surface: transform (normalized x/y/w/h),
  rotation, opacity, z, visible, and its **drivers** (bind an evaluated
  DOF/parameter → a surface property, e.g. `viseme → mouth frame`). Source: fps,
  loop, atlas grid (cols/rows), fit mode; procedural face: its parameters.
- **Bottom editor — Mscript / timeline.** The scripting pipeline: sequence media
  plays and waits (`MEDIA K[n] D[auto]`, `WAIT`), scrub, preview. Same protected
  bottom-editor surface Animate/Show use.
- **Top tools ribbon.** Import media · Add surface · Add face · Add matrix
  **output node** · Play/Stop · matrix target (WxH, gamma, brightness).

### Tabs/modes within the workspace (center-view switcher, like the others)
`Compose` (canvas) · `Media` (library + sprite-cell picker) · `Script` (Mscript)
· `Output` (matrix/hardware nodes + simulator). Refine after first pass.

## Hardware tie-in

An **output node** attaches to the canvas (your "hardware node" idea): its input
is the canvas frame stream, its output drives a real panel. Backed by
`aether_animation/frame_serial.SerialFrameOutput` (real serial `MM`/`BM`/`FM`) or
`SimulatorFrameOutput` (the on-screen matrix sim). The Output tab configures the
matrix target + port and shows live status.

## Bridge contract (engine side — `aether_animation/bridge.py`, Claude's lane)

The workspace calls these; the engine owns all meaning. New `canvas2d.*` verb
family on the existing `Session`/`handle_request` bridge:

| Verb | In | Out |
|---|---|---|
| `canvas2d.describe` | — | source kinds, matrix target defaults, face names |
| `canvas2d.load` / `.save` | handle | `.character.anima` `canvas2d:` block ⇄ model |
| `canvas2d.add_surface` / `.update_surface` / `.remove_surface` | handle, surface DTO | updated canvas summary |
| `canvas2d.add_source` / `.remove_source` | handle, source DTO | updated canvas summary |
| `canvas2d.set_driver` | handle, surface, driver DTO | updated surface |
| `canvas2d.evaluate` | handle, values, t | ordered `SurfaceState[]` (for Swift to draw) |
| `canvas2d.render_frame` | handle, values, t, size | RGBA/PNG bytes (preview thumbnail / when Swift wants pixels) |
| `canvas2d.matrix_preview` | handle, values, t, target | downsampled matrix frame (the simulator) |
| `mscript.load` / `mscript.step` | path / t | due `Command[]` (drives playback) |

`evaluate` is the hot path for the live Swift preview; `render_frame` /
`matrix_preview` back the sim + hardware. This mirrors the rig bridge verbs
(`add_mate`, etc.) already in `bridge.py`.

## Build order

1. ✅ **`canvas2d.*` bridge verbs** (`describe`/`new`/`load`/`save`/`get`/
   `evaluate`/`render_frame`/`matrix_preview`/`release`) + the headless preview
   tool (`aether_animation/raster/preview.py`) + **`.character.anima` `canvas2d:`
   serialization** (`aether_animation/canvas2d_io.py`, loader accepts the block, example
   `examples/pixel_face_2d.character.anima`) — landed 2026-07-23 (Claude), tested.
2. ✅ **Workspace scaffold** — `StudioWorkspaceKind.canvas2d` (⌘8, tab after
   Animate) registered across every switch; Surfaces/Media/Faces/Output sidebar
   tabs (Claude, cross-lane, 2026-07-23). `swift build`/`swift test` green.
3. ✅ **Live preview** — `Canvas2DWorkspaceView` spawns an engine client, builds a
   procedural-face canvas (`canvas2d.new`), renders it (`canvas2d.render_frame` →
   decoded PNG), and drives `mouth_open`/`mouth_curve`/`eye_open`/time from
   sliders. `AnimaCoreClient` gained additive `canvas2DNew`/`canvas2DRenderFrame`.
4. ⏳ **Iterate (Codex owns the 2D UI, or a Claude follow-up):** load a 2D
   character from disk into the preview (`canvas2d.load`), the LED-matrix view
   (`canvas2d.matrix_preview`), a real Surfaces/Media/Faces navigator + inspector
   (`canvas2d.evaluate` + incremental `add/update/remove_surface` verbs — land
   those when the editor needs CRUD), the Output-node panel, and an Mscript editor.
   All Swift views on the bridge contract; none need new engine concepts.
