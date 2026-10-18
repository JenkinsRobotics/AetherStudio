# Aether Map: reference comparison and live review

The six feature families shown in Jonathan's map.club screenshots now have
working Aether implementations: **Surface, Mask, Text, Shader, Webcam and
Tracker**. They share Aether's property controls and CAD feature-window chrome.
Input preview, output composition, clean projection, output cropping and
per-feature animation are connected to the same show document and renderer.
Existing mapping, scenes, clips, setup photos and player workflows remain.

This is a working baseline for comparison, not a claim of complete map.club
product parity or a qualified touring/show-control system. The remaining
differences and device limits below are part of the review.

## Reference inspected

Inspected the public [map.club application](https://map.club) on 2026-09-14,
including its six creation controls, input/output layout, common properties,
text and webcam controls, four tracker styles and the complete shader selector.
Jonathan's supplied screenshots also establish the output-crop and per-layer
timeline requirements. No source or assets were copied from map.club.

The reference's 27 shader names and controls match the published
[Paper Shaders library](https://github.com/paper-design/shaders). Map now uses
that Apache-licensed library directly, pinned to 0.0.80, with its original
licenses and attribution notices included in the app/player bundle.

## Feature comparison

| Reference area | Aether implementation | Scope and verification |
|---|---|---|
| Scenes | Create, rename, duplicate, delete, independent surfaces/duration and manual scene switching | Existing model tests and browser scene/output tests; duplicate begins at time zero |
| Surface | Image/video/solid fill/test pattern, true quad homography, arbitrary drawn outlines and cutouts | Existing drawing, warp and real video tests retained |
| Mask | A named mask feature starts black; colour, opacity, shape, warp and animation remain editable | Black masks suppress projection over lower layers; existing freehand/pen cutout tools retained |
| Text | Multiline text, system/serif/monospace or imported embedded font, weight, italic, size, line height, letter spacing, alignment, foreground/background | Live text changes, save/reopen and discard tested; embedded font travels in the document |
| Shader | All 27 observed effects, presets, palette and effect-specific controls; local image input for image effects | Browser instantiates every effect in input/workspace/output; confirms shader clocks follow the same scene time |
| Webcam | Explicit camera connection, device choice, aspect ratio, mirror and vertical flip | Actual browser camera API and WebRTC to the output window tested using a reproducible camera feed |
| Tracker | Actual MediaPipe hand inference; colour, 1/2 hands, left/right/both, size; Skin/Silhouette/Wire/Metal styles; record, loop/hold and replay | Actual local detector, saved landmarks and replay with camera disconnected and browser offline tested. Our hand styles are original 2D landmark rendering, not a textured 3D hand mesh |
| Common properties | Name, layer colour, opacity, six alignment controls, rectangle/ellipse, corner radius, offset/scale/rotation, geometry lock | Shared Aether fields; transformed outlines and handles follow the rendered feature |
| Feature properties window | Create a feature to open the shared draggable CAD window; select a layer and use Edit feature to reopen; accept/discard | Cancellation restores the feature and removes canceled edits from undo history; unrelated document edits are retained |
| Input preview | Selected source before perspective mapping, including shader/camera/tracker; full image/video with input-crop outline | Cropping projects selected original pixels rather than shrinking the whole input; real output screenshot pixel check |
| Output workspace | Composed scene, selection/warp handles, pan/zoom/Fit, setup photo, X-ray alignment view | Setup photo and X-ray are editor-only; existing window-height regression remains covered |
| Clean output | Separate fullscreen-capable window, no editor UI/handles/setup photo | Independent shows/outputs, popup reload and clean wireless handoffs tested |
| Output crop | Scene-space left/top/width/height, draggable region, resize handle, keyboard adjustment, detected output-window size, fit/fill/stretch | Does not resize scene geometry; saved crop drives the clean output and local player |
| Feature timeline | Each layer has its own track; opacity, X/Y, scale X/Y and rotation keys, linear/smooth/hold interpolation, draggable keys | Real fade/move/scrub/output and persistence tests; merely focusing a value field does not create a key |
| Existing clip timeline | Media clips, move/trim/in-point, loop/hold, gaps, show/hide and opacity-step cues | Existing pointer, media-reference and decoded-video boundary tests retained |
| Output operation | Blackout and output calibration grid; connected screen selection; Cast/AirPlay sharing; saved Pi assignments | Test covers actual Python player update/replacement/stop and local rendering with Studio access blocked; physical devices still require qualification |

The shader set is Mesh Gradient, Static Mesh Gradient, Radial Gradient, Grain
Gradient, Heatmap, Simplex Noise, Perlin Noise, Neuro Noise, Voronoi, Metaballs,
Water, Liquid Metal, Waves, Swirl, Spiral, Smoke Ring, Warp, Dot Orbit, Dot Grid,
Color Panels, Dithering, Halftone Dots, God Rays, Pulsing Border, Paper Texture,
Fluted Glass and Image Dithering. Their own animation speed runs against scene
time, so pausing/scrubbing also pauses/scrubs the effect. Arbitrary shader
parameters do not yet have separate keyframe tracks.

## Tomorrow's live test

Start at **http://localhost:8780/map/**, refresh the app, create a show and open
a fresh Output window. Close outputs belonging to an older editor session.

1. Add two scenes. In Scene setup, load a photo of the projection target and
   lower its opacity. Draw a surface over a real feature; assign an image/video.
   Confirm the setup photo never reaches the projector.
2. Add a Mask, Text and Shader from the ribbon. Exercise accept/discard and
   Edit feature. Try a gradient effect and one image effect with your own file.
   Rotate/align a feature and drag its visible corners; toggle X-ray while
   aligning. Save and reopen the show.
3. Select a media layer and open Input crop. Choose a recognizable region of
   the asset. Compare full input, mapped workspace and clean output.
4. On a feature track, add opacity 0 at 0 seconds and opacity 1 at 2 seconds.
   Choose Smooth; add horizontal movement or rotation. Scrub, play and loop.
   Place a video clip on another layer and check trim/hold and empty gaps.
5. Open Output region. Move and resize the rectangle, choose the detected
   window size, and compare Fit whole crop / Fill display / Stretch. Put the
   output on the projector and fullscreen it before matching its final size.
   Check Blackout and the calibration grid.
6. Add Webcam, explicitly connect a camera, and check device choice/mirroring.
   Confirm the same live picture reaches the clean output. Add Tracker and
   Start tracking; test each style with one and two visible hands. Record hands,
   **Stop recording to keep the take**, disconnect the camera, scrub and save.
   Reopen and confirm the recording remains. Start tracking again explicitly
   when live input is needed; cameras are not auto-enabled by opening a file.
7. Deploy the saved show to the Pi. Verify downloaded images/video, generated
   shaders and recorded hands. Live webcam/tracker input from the laptop is
   currently delivered to its local output windows, **not streamed to the Pi**.
   Disconnect the network, reboot, reconnect, update the assignment and stop.
8. Test Chrome's Cast-tab flow and macOS AirPlay window/extended-display flow
   with the actual receivers. Measure delay and check cropping/fullscreen,
   colour, audio expectations and behavior when focus changes.

## Remaining gaps

- **Hardware and Safari qualification.** The automated browser is installed
  Chrome on this Mac. It is not evidence of Safari compatibility, Pi OS boot,
  Pi GPU/video throughput or physical receiver latency. Test sustained
  performance with the intended number of shaders and cameras. The bundled
  hand model/runtime adds about 19 MB; inference runs in a worker and starts
  only when requested.
- **Wireless integration.** Current Cast/AirPlay buttons hand the complete
  output to browser/OS sharing. In-app receiver discovery, native Cast receiver
  sessions, transport status and recovery are not implemented.
- **Remote live input and synchronization.** Recorded hand data and generated
  effects run locally on the Pi. Live laptop camera/hand streams are scoped to
  local output windows. Add a network media transport, device playback/error
  acknowledgement and synchronized multi-device transport before claiming
  remote live show control.
- **Tracking appearance.** Four functional 2D styles are provided. A skinned 3D
  hand asset, 3D lighting/occlusion and reference-equivalent mesh appearance
  remain separate work. Detection has the usual lighting/occlusion limits of
  the [MediaPipe hand model](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker).
- **Show sequencing and sound.** Manual scene cuts and loop/hold work. Scene
  playlists/follow actions/crossfades, audio tracks/waveforms/output routing,
  SMPTE/MIDI/OSC/Art-Net and timecode are still missing. Videos remain muted.
- **Advanced animation and calibration.** Core transform/opacity keyframes
  work; shader-control keys, richer curve editing, independent per-projector
  calibration, mesh warp, edge blending, gamma and black-level matching remain.
- **Project robustness.** Add complete project import/relink, missing-source
  diagnostics, camera permission/disconnect qualification across browsers and
  reconnect/ownership UI after reloading the editor. Reopen output from the
  refreshed editor today. Remote app updates still need a fresh deployment;
  a same-revision saved assignment alone does not trigger an app upgrade.
- **Backend device authorization.** The earlier review's provisioning-token,
  library-access and assigned-media scoping gaps remain with the backend lane.
  They need resolution before broader multi-user/network deployment. Details
  are in the [functional review](Aether_Map_Functional_Review_2026-09-14.md) and
  the active briefing's Requests section.

## Verification and implementation boundaries

Map owns its format, renderer, evaluator, source controls and local camera/hand
runtime. It consumes the existing `@aether/ui` FeatureWindow, controls, ribbons,
panels and shell; no CAD engine or product logic was added to shared UI.
The version-2 show format gained optional fields; older shows still parse.
No Map host API or player implementation changed in this reference packet.

Repeat from `aether-map/`:

```sh
npm ci
npm test
npm run build
npm run lint
npm run e2e -- --workers=1
```

The E2E harness creates an isolated Studio installation, uses installed Chrome,
and requires the repository Python environment and `ffmpeg`. Camera tests use
the official MediaPipe test image as a generated camera feed and run actual
inference/WebRTC. They do not capture the user's webcam. See
[`e2e/fixtures/README.md`](../../../aether-map/e2e/fixtures/README.md) and
[`public/vendor/README.md`](../../../aether-map/public/vendor/README.md) for
provenance, licenses, pinned versions and model checksum.

Validation totals and final run locations are recorded with the handoff in
`dev/briefings/2026-07-14-bottango-parity.md` and in `dev/docs/reality/STATUS.md`.
