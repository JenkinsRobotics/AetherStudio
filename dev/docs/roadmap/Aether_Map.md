# Aether Map — projection mapping and show control

Current workflow audit and next acceptance gates:
[Functional review — 2026-09-14](Aether_Map_Functional_Review_2026-09-14.md).
The older phase descriptions below are historical design; use STATUS and the
review for implemented scenes, clips, masks, backgrounds and output behavior.

Status: **partly built**. The laptop loop (author, layers, cue timeline,
save, media, HDMI output) ships, as does device pairing, deployment and
offline playback. Edge blending, masks and mesh warp remain planned. Phase 1 (the warp canvas) and Pi provisioning,
announcement and pairing are shipped; everything else here is planned. Shipped
behavior is recorded in `dev/docs/reality/STATUS.md` — this document is the
design, not a progress report.

Aether Map is the suite's fourth product: author a projection onto real
physical geometry, then run it unattended from a Raspberry Pi wired to a
projector. It sits beside `Aether CAD/` and `aether-animation/` as a
self-contained product (`aether-map/`, `@aether/ui` for chrome) with its
output node in `aether-player/`.

The host already registers it: `core/host/server.py` serves
`aether-map/dist` at `/map/` under the package id `map`.

## First device: a laptop on HDMI (Jonathan, 2026-09-13)

The first output device is **a laptop wired to a projector over HDMI**, not a
Pi. Configure, design, preview and run the show from one machine. The Pi edge
node is built afterwards, once the application itself is working.

This changes what v1 needs, and mostly by subtraction:

- The output is a **second window on the same machine**, fullscreened on the
  projector display — not a networked device.
- Editor and output sync through **`BroadcastChannel`**: native, same-origin,
  instant, no server and no dependency. The host SSE channel, the pairing
  portal, the deploy bundle and the daemon are all off the v1 path.
- "Deploy" on a laptop is nothing at all. The output window simply runs.

Everything below about the Pi remains the design for the edge node and is
already partly built (provisioning, announcement and pairing ship today). It is
now **sequenced after** a working application rather than alongside it.

The renderer does not change, which is the point of having one: the same warp
code serves the editor canvas, the laptop's HDMI output window, and later the
Pi's kiosk.

## The shape of the system

```
Laptop browser  ──►  host (core/host)  ──►  Pi daemon  ──►  Chromium kiosk  ──►  projector
  authoring            documents,             receives        renders the warp
  /map/                media, devices         the bundle      from layout.json
                                              serves :8080

Show mode: everything left of the Pi can be unplugged.
```

**One renderer.** The warp is drawn by a browser in both roles — the editor's
canvas and the projector's output are the same code in two modes. The Python
daemon never touches a pixel. This is the central constraint of the design; a
second renderer means the editor and the show drift apart, and the drift is
only visible on the wall.

### Why the Pi warps, and why it warps raw media

The Pi holds the raw media plus a `layout.json` describing the warp, and
distorts on the fly. The rejected alternative is baking the warp into an
exported video server-side. Baking costs a full re-render and re-transfer every
time a projector is bumped — which happens on site, at night, under time
pressure. With a config file, nudging a corner and re-syncing is seconds.

## Renderer: CSS, not WebGL

A surface is a quad in the projector's output raster. Its warp is a planar
homography, and the browser already does that transform correctly in hardware
via `matrix3d`.

Three reasons this beats a WebGL path, in order of consequence:

1. **Correctness.** A subdivided `PlaneGeometry` with four moved vertices
   interpolates *affinely* across two triangles. Straight lines in the source
   crease along the diagonal seam. `matrix3d` performs the perspective divide
   per pixel and is correct by construction.
2. **The Pi's frame budget.** `<video>` under a CSS transform stays in the
   browser's hardware compositing path. `<video>` → `texImage2D` → WebGL copies
   every frame into a texture. On a Pi 4 that copy is a meaningful fraction of
   the budget.
3. **Bundle size.** Removing `three` takes the built bundle from ~719 kB to
   near the React floor, over house wifi, onto an SD card.

Masks use `clip-path: polygon()` (hard) and `mask-image` (soft). Both native,
both free.

**The accepted limitation:** `matrix3d` is planar. It cannot bend. Mapping onto
a cylinder, a vehicle, or an animatronic face requires a subdivided mesh and a
real shader.

> **Trigger to add WebGL: the first non-planar surface.** Until then the mesh
> path is not built. This mirrors how `Aether CAD/aether-engine/` is parked
> with a stated trigger rather than deleted.

The editor canvas is 2D. A projection mapper works in the projector's output
raster — there is no scene, camera, or perspective navigation. `three` and
`@types/three` come out of `aether-map/package.json`; the scaffold's
`PerspectiveCamera` and `PlaneGeometry` are decoration, not design.

## The show document

`.aethermap` is JSON stored in the existing host library under app `"map"`.
`core/host/library.py` already provides list/create/save/rename/share/copy with
revisions and workspace sharing — no new storage code.

```jsonc
{
  "version": 1,
  "output": { "width": 1920, "height": 1080 },
  "media": [
    { "id": "m1", "name": "flames.mp4", "kind": "video", "bytes": 48210496,
      "duration": 30.0 }
  ],
  "surfaces": [
    { "id": "s1", "name": "Front door", "enabled": true,
      "corners": [[120,80],[900,64],[912,700],[110,684]],
      "source": { "mediaId": "m1", "rect": [0,0,1920,1080] },
      "mask": null,
      "opacity": 1.0 }
  ],
  "playback": { "mode": "loop" }
}
```

Coordinate conventions, stated once so nothing has to infer them:

- `corners` — four output-space pixel pairs, clockwise from top-left.
- `source.rect` — `[x, y, width, height]` in the media's own pixel space.
- `mask` — output-space pixel pairs, same space as `corners`.
- Origin is top-left, y down, matching CSS and the projector raster.

`media` entries are references; the bytes live in the media store.

`layout.json` on the Pi is this same document with media ids rewritten to local
filenames. One schema, one parser, one test.

## Media storage

`/api/library/` caps POSTs at 9 MB and requires `application/json`
(`core/host/server.py`). Video cannot go through it. Media needs its own
binary surface:

| Endpoint | Behavior |
|---|---|
| `PUT /api/map/media/<id>` | Streams the request body to disk in chunks, size-capped, never buffered whole in memory. |
| `GET /api/map/media/<id>` | Streams back with **HTTP Range support** — the editor's `<video>` cannot seek without it. |
| `DELETE /api/map/media/<id>` | Removes the file; refuses if a saved show references it. |

Roughly 80 lines of stdlib against the existing `ThreadingHTTPServer`. This is
the only genuinely new server surface, and it is what allows the laptop to
close: the server holds the media, so the Pi pulls its own bundle unattended.

## Two channels: live alignment and deploy

These have opposite requirements and must not share a mechanism.

### Live alignment (setup mode, Pi online)

Dragging a corner moves the beam immediately. The Pi is a browser, so the kiosk
page opens an `EventSource` to the host; the editor publishes corner changes and
the host fans them out. Native `EventSource` in the page, ~30 lines of
chunked-response SSE on the host. No WebSocket library, no new dependency.

Payload is the surface delta only, not the whole document. Alignment must feel
immediate under a drag.

### Deploy (setup → show)

The daemon long-polls `GET /api/map/device/<id>/pending` with its bearer token,
blocking up to 25 s. On Deploy it wakes, downloads a zip of `layout.json` +
media + the built app, unpacks to the SD card, and reloads Chromium at
`localhost`.

**Pull, not push.** The Pi never needs an inbound port, works behind any
router, and recovers on its own after a reboot or a network drop.

After a deploy the Pi is fully self-contained: local app, local media, local
layout. Laptop closed, wifi dead, show runs.

## Device pairing

A `map_devices` table alongside the existing `services` table.

1. **Boot.** The daemon `POST`s `/api/map/devices/announce` with a stable
   hardware id. The host returns a device id and a 6-digit code, valid 10
   minutes and regenerated while unclaimed.
2. **Display.** Chromium opens `/map/portal?device=<id>` and shows the code
   high-contrast on the projector.
3. **Claim.** The operator enters the code in the editor. The host binds the
   device to the account and issues an `aether_sa_` service token.
4. **Switch.** The host notifies the portal page over SSE; it becomes the
   output surface.

The code is not solving discovery — the Pi already knows the server URL because
it boots to it. It solves *claiming the right projector* when several are on
one LAN. Honest scope: that is a real problem at four projectors, not at one,
and it costs ~40 lines either way.

Bearer auth already bypasses the same-origin check in `server.py`, so the
daemon needs no new authentication path.

## The daemon

`aether-player/` is a sync agent. Its complete job:

1. Announce on boot and every 30 s; report the pairing code until claimed.
2. Long-poll for a pending deploy; download and unpack the bundle. *(phase 4)*
3. Serve the unpacked folder to `localhost`.

It does **not** supervise Chromium. Two systemd units do that instead —
`aether-player.service` (system scope, no display needed) and
`aether-kiosk.service` (user scope, bound to `graphical-session.target`) — which
removes the watchdog code entirely and restarts each half independently.

Standard library only: `http.server`, `urllib`, `zipfile`. The former
`aether-player/renderer.py` (OpenCV, NumPy, a mocked `render()`) is deleted; it
was the wrong half of the idea, and its dependencies were never in
`pyproject.toml`.

Target ~120 lines. If it grows past that, something has been misplaced into it.

## Provisioning

A Pi provisions itself in one command:

```bash
curl -sSL http://<server>:8780/api/map/install.sh | bash
```

Three public, auth-free host routes serve it, because a device being imaged has
no credentials:

| Route | Serves |
|---|---|
| `GET /api/map/ping` | Reachability check the installer uses before proceeding. |
| `GET /api/map/install.sh` | `aether-player/install.sh` with the server URL stamped in. |
| `GET /api/map/aether_player.py` | The daemon source. |

The stamped URL comes from the **Host header**, not the configured
`public_url`. The address a Pi reached the host on is by definition routable
from where that Pi sits; `public_url` defaults to a loopback address, which on
a Pi would mean the Pi itself.

`POST /api/map/devices/announce` is likewise unauthenticated and is the one
unauthenticated write in the system. It is bounded: a 4 KB body cap, a device
id restricted to alphanumerics plus `-_`, and a hard cap on registered devices.
Ownership is conferred only by the pairing code — six digits, ten-minute
lifetime, rotated while unclaimed and consumed on claim. `GET /api/map/devices`
requires a signed-in user.

**The accepted risk:** on a plain-http host the one-liner pipes unauthenticated
plaintext into a shell. Stated rather than hidden; the mitigation is TLS on the
host, and the installer follows whichever scheme the host serves.

## Out of scope for v1, with triggers

| Deferred | Trigger to build it |
|---|---|
| Cue timeline | Something must fire on a signal rather than loop. v1 playback is loop plus play/pause/blackout — the whole show for a seasonal install. |
| Edge blending | The second projector. One projector has no overlap. |
| Mesh warp / WebGL | The first non-planar surface. |
| Multi-Pi frame sync | Two devices showing one continuous image. |
| Live video streaming to the Pi | Content generated in real time, e.g. a character face driven by the animation engine. Explicitly rejected for v1: a continuous stream is a liability in the field. |

## Delivery phases

This is more than one implementation plan's worth of work. It decomposes along
lines where each phase is independently demonstrable — every phase ends with
something you can look at, not a half-built layer.

**Phase 1 — the warp canvas.** The editor alone, no server, no Pi. Draw a quad,
drag its corners, warp an image and a video onto it through the homography, in
the real `WorkspaceShell`. Strip `three`. Deliverable: a surface that visibly
hugs a shape, with the homography test green. This is the product; everything
after it is plumbing.

**Phase 2 — documents and media.** Surfaces persist. `.aethermap` saves and
opens through the host library; media uploads and streams back with Range.
Deliverable: build a mapping, close the tab, reopen it intact.

**Phase 3 — the Pi, live.** Pairing portal, device claim, SSE alignment.
Deliverable: a code on the projector, claimed from the laptop, and a corner
drag that moves the beam.

**Phase 4 — deploy and run.** Bundle, long-poll, unpack, kiosk, watchdog.
Deliverable: hit Deploy, close the laptop, pull the network, and the show keeps
running. Then reconnect and nudge a corner.

**Phase 5 — the paperwork.** STATUS entry, README, briefing claim and handoff,
both directories tracked. Listed separately for visibility, but each phase
carries its own share rather than deferring all of it here.

Phase 1 is worth building and looking at before phases 2–5 are planned in
detail. The canvas is where the design is most likely to be wrong in ways no
document reveals.

## Verification

Four checks, not a suite:

1. **Homography round-trip.** Map the source rect's corners through `H`;
   assert they land on the four target corners within epsilon. This is the test
   that catches a broken warp before the wall does.
2. **Document round-trip.** Serialize → parse → identical document.
3. **Host pairing and deploy** (`pytest`, `core/host/tests`): announce → claim
   → deploy issues a token and a well-formed bundle.
4. **Daemon bundle.** A bundle unpacks and serves from `localhost`.

Plus the standing gates: `npm run build` in `aether-map/`, `.venv/bin/ruff
check .` and `.venv/bin/pytest` at the root.

**Not claimable without hardware.** Frame rate on a real Pi through a real
projector is unverified until it runs on one. Pi 4 has hardware H.264 decode;
Pi 5 does not. If Chromium cannot hold frame rate, the fallback is a native
GStreamer + OpenGL ES player on the Pi — a second renderer, with the drift cost
named above accepted deliberately rather than by accident.

## Contract paperwork

Aether Map currently has none of what the contributor contract requires:

- `aether-map/` and `aether-player/` are untracked in git.
- No `STATUS.md` entry.
- No claim or handoff entry in `dev/briefings/`.
- `aether-map/README.md` is still the stock Vite template.

All of it lands with the implementation, not after.
