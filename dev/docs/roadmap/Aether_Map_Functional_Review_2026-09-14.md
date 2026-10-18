# Aether Map functional review — 2026-09-14

The later [map.club reference packet](Aether_Map_Reference_Review_2026-09-14.md)
adds six feature families, shaders, camera/hand tracking, input preview/crop,
floating feature properties, transform/opacity keyframes and explicit output
cropping. See that comparison for the current live-test checklist and limits.

Map now has a tested basic workflow for mapping images and videos onto flat
surfaces: create a scene, draw its surfaces, place clips on their tracks, preview
the result, and send the composition to a display or a standalone player.
It is not yet a complete installation/show-control system. The next work should
concentrate on dependable operation and scene sequencing before advanced effects.

## Workflow and evidence

| Workflow | Current behavior | Verification |
|---|---|---|
| Scenes | Named scenes with independent surfaces and lengths; create, rename, duplicate, delete and manually switch | Existing unit tests; browser switches scenes and checks output follows |
| Surface creation | Rectangle, ellipse, pen, polygon, freehand, quad warp, outlines/cutouts, layer order, image/video/text/fill | Existing geometry tests and complete-show browser flow |
| Setup reference | Each scene can import or select a static image, adjust opacity, hide/show or remove it | Browser checks scene isolation, save/reopen and absence from output; parser round trip |
| Timeline | One clip track per surface; placement, move, trim, in-point, loop/hold, show/hide and opacity steps | Real pointer move/trim tests, gap checks in editor/output, real VP8 decode/seek/hold |
| Connected display | Scan compatible browsers' screens, match resolution, open a separate output window and fullscreen it | Real Chrome Window Management path and output popup; physical second-display placement still requires hardware testing |
| Google Cast | Dedicated output tab, then Chrome's Cast tab flow; complete warped composition, no setup/UI overlays | Output launch, isolation, reconnection on output reload and uncropped raster tested; physical receiver not tested |
| AirPlay | Dedicated output window, then macOS window sharing or extended-display flow | Clean output launch and isolation tested; physical receiver not tested |
| Raspberry Pi | Pair, assign saved show, download app/media/layout, render locally; update and stop through the existing assignment API | Actual Python player and HTTP handler exercised against a temporary Studio server and real Chrome renderer |
| Offline behavior | Downloaded assets are local; failed pulls retain the last good layout | Daemon regression tests; browser reloads local projection after editor closes |

## Corrections made during this review

- Scene setup backgrounds are optional document metadata and rendered only by
  the editor. The output renderer never draws them, including on the Pi.
- Output channels and window names are scoped to an editor session. Opening a
  second show no longer changes the first show's projection. Development media
  URLs also reach the output window.
- Wireless output keeps the whole raster inside the available tab/window,
  without diagnostics or editor controls appearing in the shared picture.
- The canvas follows its fitted view while the shell settles and while the
  timeline resizes. Manual pan/zoom is retained until Fit is requested. The
  stage observer follows Mapping/Sequence shell replacements.
- Used-media checks include clips and setup backgrounds. Referenced assets
  cannot be removed silently. Media import reports decode failure, and media
  can be imported before a surface exists.
- Show cues cannot make a clip's gap display its old static source. Non-looping
  video holds at its last frame; paused seeking is precise; scene Hold stops
  transport at the scene end. The old “Fade 50%” button is now labelled
  “Opacity 50%” because it sets a value rather than interpolating a fade.
- Pi deployment compares document identity **and** revision. Layout publication
  is atomic after media arrives, and the renderer notices changed layouts.
  Acknowledged Stop replaces the picture with black; failed network reads keep
  the current show playing.
- The Pi kiosk always starts at its local player. A local pairing/wait page
  enters `index.html?output=1` when the first deployment arrives. Previously
  first boot stayed on the remote pairing page, and subsequent boots opened the
  editor instead of the output renderer.
- Device UI says “assigned,” which is what the host knows. An assignment does
  not prove the physical projector is rendering. Unsaved changes block deploy.

## Highest-priority remaining gaps

These are **planned**, not implemented by this review.

1. **Device access and pairing hardening, before broader network use.**
   `Store.announce_device` currently returns a claimed device's token based on
   its public device id, without a device-held provisioning secret. Assignment
   checks that a Map document exists but does not use the library's owner/scope
   access check. Device media access is broader than the assigned show's asset
   set. This is a backend protocol/authorization task: establish device proof,
   reuse library authorization, scope asset reads, and test two users/devices,
   rejected claims and revoked access. Existing code is not a secure multi-user
   device boundary. Recorded in the shared briefing for the backend lane.
2. **Hardware qualification and delivery acknowledgement.** Exercise an actual
   Pi OS desktop boot, network loss/recovery, power interruption, supported video
   codecs, long playback and display reconnect. Add reported installed revision,
   playback state and decode errors; “Online” currently means only that the
   daemon checked in. Finish transactional app upgrades/rollback as well as
   layout updates. A new app build alone does not trigger a same-revision show
   pull; existing Pi installations need the updated installer/player.
3. **Scene sequencing and live show controls.** Scenes currently cut manually;
   playback loops/holds the active scene. Add an ordered playlist, next/previous,
   follow actions, transitions, restart and a clear separation between
   editing and the live scene. Remote devices currently play saved assignments;
   the laptop's live transport does not start/seek multiple Pis in sync.
4. **Audio and richer animation.** Videos are muted. Add an audio track with
   waveform, cue alignment and level/mute/output selection. Opacity/transform
   keyframes and easing now work in the reference packet. Define clip-overlap/crossfade rules;
   currently the first covering clip wins an overlap. Add numeric clip editing,
   snapping controls and copy/paste. Test actual decoded frames at boundaries.
5. **Projection preflight and calibration.** Test patterns and an explicit
   output crop/fit now work. Add missing/unsupported-media reporting, output readiness, device disconnect
   handling and persistent per-output calibration. Monitor/Pi output currently
   defaults to cover scaling for old files; use the new Output region controls
   to choose a crop and fit before aligning. Multiple outputs share one raster, rather
   than independently calibrated projectors. Reference-image position/scale/
   rotation and lock controls would improve photo alignment beyond centred fit.

## Subsequent capabilities

- Mesh warp for curved/non-planar surfaces; edge feathering/blending and colour,
  gamma and black-level calibration across projectors.
- Remote camera/capture transport and NDI; OSC, MIDI, Art-Net/sACN and timecode.
- Show scheduling, synchronized multi-device start and clock-drift correction.
- Explicit reconnect/ownership UI when an editor is reloaded while its output
  windows remain open. Today, reopen output from the refreshed editor.
- Project import/relink and asset diagnostics. SVG export should use the current
  `masks` outlines rather than only the legacy single `mask` field, and allow
  choosing which scene's geometry to export.

## Wireless support boundary

Google's [Chrome casting instructions](https://support.google.com/chromecast/answer/3228332)
support casting the complete tab. Apple's
[AirPlay display guidance](https://support.apple.com/en-ca/guide/mac-help/mchld7e543a0/mac)
supports window sharing or extending/mirroring a Mac display. Those are the
handoffs provided here; receiver selection and connection status stay with the
browser/OS. Network receivers, latency and Safari rendering were not exercised.

An HTML video's [AirPlay picker](https://developer.apple.com/documentation/webkitjs/adding_an_airplay_button_to_your_safari_media_controls)
targets that media element; it does not represent Map's complete scene.
Google's [Presentation/Cast sample](https://googlechrome.github.io/samples/presentation-api/cast.html)
also distinguishes registered Cast receivers from arbitrary web-page receivers.
A native Cast receiver with in-app discovery/control is a separate integration,
not something these output buttons claim to provide.

## Repeatable verification

From `aether-map/`:

```sh
npm test
npm run build
npm run e2e -- --workers=1
npm run lint
```

From the repository root:

```sh
.venv/bin/pytest aether-player/tests core/host/tests/test_map_devices.py core/host/tests/test_map_media.py core/host/tests/test_map_project.py -q
.venv/bin/ruff check aether-player aether-map/e2e/serve-player.py
bash -n aether-player/install.sh
node dev/check-theme-literals.mjs
```

Results: **174 Map unit tests, 8 browser workflows, 40 player/host tests,
production build, Python lint, installer syntax and theme checks pass.** Browser
tests use the installed Chrome and an isolated Studio host; player tests use
temporary data and ephemeral local ports. They do not alter the live server or
drive physical receivers. A synthetic two-second WebM tests real decode/seek.
Screenshots were inspected for setup and stopped-output rendering.

Oxlint reports three existing effect warnings (PortalView, DevicesPanel,
SurfaceCanvas). The broader shared-widget override audit reports 77 existing
CAD/Studio rules; this review does not edit those owned stylesheets.
