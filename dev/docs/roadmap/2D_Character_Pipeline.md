# 2D Character Pipeline (VTuber-style) — design

Status: **draft / first pass** (Claude, 2026-07-23, overnight). Jonathan to
review. Companion to the 3D hardware-animation milestone; this doc adds a
**second character kind** — 2D visual characters — and the **hardware-as-a-node**
model that unifies how *any* evaluated output (3D joints or 2D frames) drives
real hardware.

Nothing here is built into the app yet. A first engine foundation ships
alongside this doc (`aether_animation/canvas2d.py` + tests); see "Build status" at the
bottom.

---

## 1. Motivation

A digital character isn't always a rigged 3D mesh. A huge, useful class —
VTuber avatars, animatronic faces with LCD/LED eyes, sign displays, LED-matrix
"pixel pets" — is fundamentally **2D visual media that reacts to animation and
logic**. We want these as first-class Anima characters that share the same
timeline, DOF/parameter, node-graph, and hardware-output machinery as the 3D
side, so an author learns one system.

Jonathan's framing (verbatim intent):

- Add images; place a **display window** that can render images, videos, gifs,
  sprites, etc.
- There's an **evolution of 2D assets**: start simple (a static image) and move
  up — sprites → gifs → videos → …
- **Tie hardware to these 2D images.** Some outputs are a simple display; it
  would be cool to also simulate a **64×64 LED matrix**.
- The unifying idea: **hardware is a node you configure.** Your 3D character can
  be virtually just a box; you attach a **hardware node** to the pipeline
  output whose *input* is the (joint state / video) stream and whose *output*
  controls the real hardware. Each virtual joint is mirrored to a hardware node.

## 2. Core model: everything evaluates to a *state*, a node mirrors it to hardware

The engine already does this for motion:

```
DOF / parameter value  ──OutputMapping──►  normalized channel target  ──OutputAdapter──►  servo / actuator
        (evaluated state)                        (per-channel scalar)              (hardware node)
```

`OutputAdapter` (`aether_animation/outputs.py`) is *already* the "hardware node": it
consumes **evaluated targets only** (normalized 0..1 per channel) and drives a
device; `SimulatorOutput`, `SerialWireOutput`, and the UDP extension are its
backends. The 2D pipeline adds the **frame-stream analog**:

```
VisualSource + drivers  ──evaluate──►  SurfaceState (which frame, transform, opacity)  ──rasterize──►  RGBA frame  ──FrameOutput──►  display / LED matrix
        (evaluated state)                    (renderer-independent)                        (pixels)          (hardware node)
```

Two output *kinds*, one mental model — an output node consumes an evaluated
stream and mirrors it to hardware:

| Output kind | Evaluated stream | Hardware node backends |
|---|---|---|
| **Scalar** (exists) | per-channel 0..1 target | servo bus (wire/serial), simulator, UDP |
| **Frame** (new) | RGBA pixel buffer at time *t* | LCD/HDMI display, 64×64 LED matrix, simulator |

**Renderer independence (non-negotiable, mirrors the 3D rule).** The engine
evaluates *surface state* — a source reference, a resolved frame index, a 2D
transform, opacity, visibility — and **never produces pixels**. Rasterization
(compositing surfaces into an RGBA frame) and LED downsampling live in a
separate rasterizer: the Swift/RealityKit (or a headless) renderer for preview,
and the same headless rasterizer feeding a frame hardware node for output. This
keeps `aether_animation` UI/renderer/hardware-independent exactly like the motion side.

## 3. The 2D asset evolution

All 2D media is a **VisualSource**: something that, given a *frame selector*
(usually time, sometimes an index), yields one still frame. The kinds form the
requested progression, each a superset of the last's needs:

1. **Image** — one static frame. `frame_count = 1`. Simplest possible.
2. **Sprite / sprite sheet** — an atlas of N frames (grid `cols × rows`);
   frame chosen by **index** (a DOF/parameter selects it: viseme, blink,
   expression). This is the VTuber workhorse — layered swappable parts.
3. **GIF** — N frames with intrinsic per-frame durations; plays on a clock or
   scrubs by index.
4. **Video** — a stream decoded to frames at its fps; plays on a clock, can be
   seeked. (Decoding is the renderer's job; the engine only tracks time/seek.)
5. **(Future)** procedural / Live2D-style deformable meshes, shader sources,
   camera feeds. Same Surface contract; a richer source kind.

The engine models each as data (kind + metadata: path/asset id, frame_count,
fps, atlas grid, loop mode). It **resolves a frame index** from the driver; it
does **not** decode media.

## 4. Surfaces and the 2D character (the "display window")

A **Surface** is the requested display window: a placed rectangle in the 2D
character's canvas that shows one VisualSource. Fields (all renderer-neutral):

- `id`, `source` (VisualSource ref)
- **Transform in canvas units** (normalized 0..1 canvas space, origin
  top-left): `x`, `y`, `width`, `height`, `rotation_deg`
- `opacity` (0..1), `z` (draw order), `visible`
- **Drivers**: bindings from a DOF path / parameter to a surface property —
  `frame`, `opacity`, `x`, `y`, `rotation_deg`, `visible`. A driver reuses the
  existing evaluation: the value comes from a clip/parameter/relation just like
  a joint DOF, so **2D animates on the same timeline as 3D**.

A **Canvas2D** (the 2D character body) is: canvas pixel size (its native
resolution, e.g. 1024×1024 or 64×64 for a matrix-native character) + an ordered
list of Surfaces. A VTuber face = base + eyes(sprite, frame←blink) +
mouth(sprite, frame←viseme) + brows + accessories, each a Surface.

This is deliberately the same shape as the rig: parts↔surfaces, joints/DOF↔
drivers, so the Character format carries an optional `canvas2d:` block next to
`rig:` and a character can even be **hybrid** (a 3D head with a 2D face screen).

## 5. Hardware nodes for 2D

A **frame hardware node** consumes the rasterized RGBA frame and targets a
device. Two first targets:

- **Display** — a full-color screen (HDMI/LCD/SPI). Config: pixel size,
  color order, rotation, fit (contain/cover/stretch). The rasterized canvas is
  scaled to the panel.
- **LED matrix** — the fun one. Config: matrix size (e.g. **64×64**), a
  **downsample** from the canvas (area-average or nearest), gamma/brightness,
  serpentine wiring, color order. The engine/rasterizer produces a small RGB
  buffer; simulate it in the viewport as a grid of round "LEDs"; on hardware,
  stream it to the matrix controller.

**Transport.** Scalar frames already have the wire protocol (CFG/EN/FRM). A
pixel frame is a different payload — a `FRAME` packet of W×H×(3|4) bytes with a
sequence id, or a dedicated frame transport (SPI/HDMI handled by the device).
The wire protocol gets a **frame-packet extension** (`Wire_Protocol.md`); until
hardware exists it rides the same simulator/UDP path the servo side used for
its first proof. Frame outputs are an `OutputAdapter`-sibling protocol
(`FrameOutput`: `open(target_config)` → `send_frame(rgba, seq)` → `stop`/
`close`), so extensions add real panels without touching the core.

**64×64 simulation.** A `LedMatrixTarget(width, height, downsample, gamma)` +ㅤ
a pure function `downsample_canvas(rgba, target) -> small_rgb` (area-average).
The Swift viewport renders the small buffer as an LED grid; a headless test
asserts the downsample math. This is buildable and testable **now**, before any
panel exists — the same discipline the servo simulator followed.

## 6. Unifying: hardware is a node in the graph

Generalizing Jonathan's insight across both kinds — the node graph (the Nodes
workspace) is where outputs live:

```
[ Character (3D rig or 2D canvas) ] ──evaluate(t)──► outputs
        │                                              │
        ├─ joint DOF stream ──► [ Servo hardware node ] ──► servo bus
        └─ surface frames    ──► [ Display / LED-matrix hardware node ] ──► panel
```

- A **hardware node** is configured, not hard-wired: pick a backend, map the
  character's logical outputs (DOF paths / surfaces) to physical channels /
  panels, set safety (failsafe, brightness cap), arm.
- **Mirroring**: each virtual joint ↔ a scalar channel; each surface/canvas ↔ a
  frame target. The virtual character can be a literal box (3D) or a single
  display window (2D); the *node* is where physical reality is bound. This means
  **preview and hardware share one evaluated stream** — the simulator is just
  another node backend, so "works in preview" ⇒ "drives hardware."
- Saved animation still **never requires hardware or AI to play** (contract):
  nodes are an output stage over a self-contained evaluated character.

## 7. Fit to AnimaCore (module plan)

- `aether_animation/canvas2d.py` — `VisualSource`, `Surface`, `SurfaceDriver`,
  `Canvas2D`, and `evaluate_surfaces(canvas, values) -> tuple[SurfaceState, …]`.
  Renderer-independent; **stdlib only**. (First slice ships with this doc.)
- Character format: optional top-level `canvas2d:` block (loader + serializer),
  additive — every existing `.character.anima` unchanged. A character may have
  `rig:`, `canvas2d:`, or both.
- Evaluation reuse: surface drivers resolve their value through the *same*
  `evaluate_pose`/parameter/clip path DOFs use — no second animation engine.
- `aether_animation/frame_output.py` (later) — `FrameOutput` protocol +
  `LedMatrixTarget` + `downsample_canvas`; a `SimulatorFrameOutput` first
  consumer, mirroring `SimulatorOutput`.
- Bridge verbs (later, for the Swift front end): `load`/`describe` a canvas,
  `evaluate_surfaces`, `led_preview` (returns the small buffer for the sim).
- Rasterizer: **not** in `aether_animation` — a headless rasterizer (Swift, or a small
  Python/Pillow one strictly for the hardware-output path and tests) composits
  SurfaceState → RGBA. The engine hands out state; pixels are downstream.

## 8. Open decisions (for Jonathan)

1. **Canvas coordinate space** — normalized 0..1 (resolution-independent, my
   default) vs. pixels. I chose normalized so the same character drives a 1024²
   preview and a 64² matrix. Agree?
2. **Where compositing lives** — I keep the engine pixel-free and put the
   rasterizer in Swift for preview + a small headless one for hardware/tests.
   Alternative: a pixel path inside `aether_animation` (Pillow dep). I lean pixel-free.
3. **Frame index driver units** — a sprite frame is chosen by a **parameter**
   (0..1 → 0..N-1) or by an explicit **integer index DOF**? I lean parameter
   (reuses everything); flag if you want first-class integer tracks.
4. **Hybrid characters** — allow one character to hold both `rig:` and
   `canvas2d:` (3D head + 2D face)? I designed for yes; confirm it's wanted now
   vs. later.
5. **Frame transport** — extend the wire protocol with a pixel `FRAME` packet,
   or treat displays as opaque devices fed over SPI/HDMI outside the wire
   protocol? Affects the LED-matrix hardware path.

## 9. Build status (shipped with this doc)

- `aether_animation/canvas2d.py` — data model + `evaluate_surfaces` (renderer-neutral).
  Source kinds now include `PROCEDURAL` (a parametric face; see below).
- `aether_animation/frame_output.py` — `LedMatrixTarget` + `downsample_canvas` (the
  64×64 simulation math), pure/stdlib.
- `aether_animation/raster/` — the host-side rasterizer with **real** media decoders
  ported from Mochi (see §10).
- `aether_animation/frame_serial.py` — `SerialFrameOutput`, real LED-matrix serial.
- `aether_animation/raster/mscript.py` — the ported Mscript timeline language.
- Tests in `aether_animation/tests/` covering source-kind frame resolution,
  driver-driven surface state, the LED downsample, real media decode, the serial
  matrix output, and the Mscript engine.

## 10. Real Mochi pipelines imported (added 2026-07-23)

Rather than re-implement, we **ported Mochi's actual working code** (both repos
are Apache-2.0; provenance headers preserved on each file). Three real pipelines
now live in the engine, tested against real generated media:

- **Media rendering** — `aether_animation/raster/` decoders (`image`, `bitmap`,
  `sprite`, `gif`, `video`) on Mochi's `open`/`close`/`next_frame(t)` contract +
  the RGBA8 `FrameBuffer`. `ImageAdapter`/`GifAdapter` use Pillow;
  `BitmapAdapter`/`SpriteAdapter` use numpy/Pillow; `VideoAdapter` uses
  imageio+ffmpeg. `CanvasPlayer` opens one adapter per surface and
  alpha-composites them. Media deps are the optional `media` extra.
- **Playing hardware** — `aether_animation/frame_serial.py` `SerialFrameOutput` speaks
  Mochi's matrix protocol (`MM`/`BM`/`FM`) over pyserial, implementing the
  existing `FrameOutput` contract; verified on a `loop://` loopback.
- **Scripting** — `aether_animation/raster/mscript.py` is Mochi's Mscript engine
  (sectioned `.mscript` parser + `update(t)` WAIT/duration flow control, GIF/video
  auto-duration). One safety change from Mochi: the procedural path is a
  registry of named faces, **not** an `importlib` load of arbitrary Python
  (Mochi's own `math_adapter` flags that as an arbitrary-code risk).

The review of that repo also confirmed the architecture and answered open
decisions:

- **Decision #2 (where compositing lives) — resolved as planned.** The engine
  stays pixel-free (`canvas2d` evaluates *which* frame); `aether_animation/raster/` is
  the "small headless rasterizer" — `FrameBuffer` (one canonical RGB frame), a
  `SurfaceAdapter` seam + `AdapterRegistry` (one file per media kind, mirroring
  Mochi's per-decoder files), and `render_canvas` compositing back-to-front. Its
  output feeds `downsample_canvas` for the matrix. The Swift preview renderer is
  a *second* consumer of the same `SurfaceState`, not a dependency.
- **Procedural faces are the primitive, not the top of a ladder.** Mochi's
  default character is a ~300-line parametric face, not a sprite/gif — infinite
  expression + viseme states from one source, native-res for an LED matrix.
  `raster/faces/simple_face.py` (`SimpleFace`) is our reference: eyes+mouth from
  the *same* evaluated value stream (`eye_open`, `mouth_open` = the viseme/audio
  channel, `mouth_curve`, `look_x/y`) with baked-in blink + breathing. A "happy"
  preset is just a set of parameter values — no special "emotion" engine concept.
- **Decision #5 (frame transport) — direction set.** Follow Mochi: control on
  the general channel, pixels on a *dedicated* binary frame channel (their node
  takes an emotion/mode subscription plus a length-prefixed RGBA stream). The
  wire protocol stays scalar; a `FrameOutput` node owns the pixel link.

## 11. Asset conventions — the create ↔ play interchange (added 2026-07-23)

Reframing (Jonathan): **Mochi was a test framework for creating + playing media on
hardware. AnimaStudio becomes the *create* method; Mochi eventually becomes the
*middleware* that takes created media and plays it on hardware.** So Mochi's asset
conventions are the portable interchange format — AnimaStudio authors them, the
playback middleware consumes them. All ported (Apache-2.0), stdlib + pyyaml:

- **`aether_animation/asset_props.py`** — the `.props.yaml` sidecar (`asset-props/v1`):
  per-asset name/mood/tags/hint, `ideal_size`, `framing`, `playback_speed`,
  `loop`, and `type_props` (sprite grid, gif/video fps, trim). `load_props`
  (sidecar wins, else file-derived defaults), `write_props` (author the sidecar),
  and `visual_source_from_asset` (props → a `VisualSource`, incl. sprite grid).
- **`aether_animation/asset_catalog.py`** — `build_catalog` walks a media folder into a
  flat, JSON-round-trippable index (Mochi's `build_catalog.py`).
- **`aether_animation/pack.py`** — packs (`pack/v1`): emotion/action **slots** → asset
  files (`slot_file` resolves str/list/dict), the "character animation pack."
- **`aether_animation/skin.py`** + **`aether_animation/raster/skin_compositor.py`** — skins
  (`skin/v1`): a `body.png` bezel + `screen_bbox`; `apply_skin` paints an evaluated
  frame into the cutout (the physical-device face).
- **`aether_animation/raster/mscript_runner.py`** — `MscriptRunner` / `render_mscript`
  play the Mscript command stream into real frames (opens the media adapter per
  `MEDIA` command). The engine's create-side play; the middleware plays the same
  stream on hardware.
- **`bridge.py`** — incremental `canvas2d.add_surface`/`update_surface`/
  `remove_surface`/`add_source`/`remove_source` verbs so the app editors get CRUD.

Still not built: the app-side authoring UIs for these (sprite-cell picker, pack
browser, skin picker) — Swift views on the bridge contract; and a
Mscript→`CanvasPlayer` runner variant if the app needs canvas compositing during a
script (the current runner plays one media stream at a time). Everything marked
"later" earlier in this doc remains unbuilt.
