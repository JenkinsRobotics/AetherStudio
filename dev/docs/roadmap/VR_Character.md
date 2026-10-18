# VR character pipeline (planned)

**Status:** planning + first engine foundation, 2026-07-24. Goal: a VTube-Studio-class
**live avatar** character — you perform, a tracker reads your face, the avatar mirrors
you in real time — as a first-class AnimaStudio character type alongside 3D and 2D.

## The three character types

Per Jonathan: a Character has a **type**, and the authoring surface adapts to it.
Instead of a fixed "Rig" tab, the second tab is *character-specific*:

| Character type | Authoring workspace | What you build |
|---|---|---|
| **3D character** | Rig (existing) | parts, mates, DOF, limits → servos/animatronics |
| **2D character** | 2D (existing `canvas2d`) | surfaces, media, procedural faces → screens/LED |
| **VR character** | **VR (new)** | an avatar + face-tracking bindings → live performance |

So the Character workspace gains a **type selector** (3D / 2D / VR), and the
authoring tab shows the matching workspace. (First step: add a `.vr` workspace as
a peer; the follow-up UX is collapsing Rig/2D/VR into one type-driven tab.)

## What a VR character is (and why most of it already exists)

A VR character is an **avatar driven by live parameters**. Crucially, the avatar
half is *already built*: a 2D `canvas2d` (surfaces + procedural faces + drivers)
or a 3D rig both evaluate from a `values` dict. Face tracking just *produces that
dict*. `aether_animation/tracking.py` is the contract:

```
tracker → FaceTrackingFrame(blendshapes, head pose) → .values() → {"face.jawOpen": .., ...}
        → evaluate_surfaces / evaluate_pose (EXISTING) → render (EXISTING)
```

The parameter vocabulary is Apple's **52 ARKit blendshapes** + head yaw/pitch/roll
(the de-facto standard VTuber tooling speaks). A VR character's drivers bind to
`face.*` names — e.g. a mouth surface's FRAME driver ← `face.jawOpen`, an eye ←
`face.eyeBlinkLeft`. Tested end-to-end in `test_tracking.py`. **So the only new
component is the tracker input.**

## The open decision: face tracking on a Mac

ARKit's 52-blendshape face tracking is **iOS-only** (needs a TrueDepth camera).
On a Mac there is no native ARKit face tracking, so the tracker input has options:

1. **iPhone as tracker** (what VTube Studio does) — a tiny iOS companion streams
   ARKit blendshapes over the network to the Mac app. Best quality (true 52
   blendshapes), needs an iOS app + a wire format.
2. **Mac webcam via Vision** — `VNDetectFaceLandmarksRequest` gives 2D landmarks;
   we derive a *subset* (blink, jaw open, smile, head yaw/pitch) heuristically.
   No second device, lower fidelity, fewer coefficients.
3. **Defer tracking** — build the VR workspace + binding editor now (drive the
   avatar from sliders / a recorded clip), add live tracking later.

The engine is identical for all three — they only differ in what fills `values`.

## Build phases

1. **(engine, done)** `tracking.py` — blendshape vocabulary + `FaceTrackingFrame`
   → values; proven to drive a 2D avatar via existing evaluation.
2. **(app) VR workspace scaffold** — a `.vr` "VR Character" workspace with a live
   preview (reuse the 2D preview: a canvas whose drivers bind to `face.*`).
3. **(app) tracking input** — per the decision above (iPhone bridge / Vision / sliders).
4. **(app) binding editor** — map `face.*` blendshapes → avatar controls, with
   live preview; expression presets/hotkeys.
5. **Later** — Live2D-style mesh deformation (smooth warp vs our layered surfaces),
   physics (hair/cloth sway), streaming output (virtual cam) — the deep VTube parity.

## Character-type routing (app, Codex shell)

`StudioWorkspaceKind` gains `.vr`; the Character workspace gets a type selector
that routes the authoring tab. This restructures the tab model (Codex's shell) —
coordinate before collapsing Rig/2D/VR into one adaptive tab.
