# Aether Map against Lazy Lighting — 2026-09-16

> Historical, narrower comparison. The supplied October 4 guide contains
> additional requirements. Use [the current acceptance matrix](Aether_Map_Lazy_Lighting_Acceptance.md)
> for verified coverage and open work; the seven items below do not establish
> full competitor parity.

Written for Jonathan, as a build order. Competitor facts are from public
material, listed at the end; anything not verifiable there is marked as such
rather than assumed.

## What Lazy Lighting is

A phone and tablet projection-mapping app (iOS and Android, no desktop build).
Free download, roughly $20/year or $130 lifetime for the full tiers. Its pitch is
that you get a mapped light show without a computer: point the phone at the
house, warp a shape onto it, play. Cut, mask and warp tools; a Draw mode for
making visuals live; video and logo import; an effects library (kaleidoscopes,
tunnels, colour morphs); real-time effects including blur and colour cycle;
audio reactivity, MIDI in, and hand/face tracking; output over AirPlay, HDMI,
USB-C and Lightning; export of the finished show to 720p/1080p/4K with audio;
and a companion receiver, Lazy Lighting Link. One review singles out its
**two independent channels with a live crossfade** as the standout.

It is a performance instrument you hold. That is the whole shape of it, and it
is what our gaps and our advantages both follow from.

## Where we already lead

Not close calls — these have no counterpart in a phone app.

- **Multiple outputs, multiple devices, multiple scenes.** `show.outputs` is a
  list; each output owns its region and the scene it shows, and each opens its
  own window. Lazy Lighting is one device's screen.
- **Paired edge players.** A Raspberry Pi runs the show off its own disk with
  the network gone. Their equivalent is a phone that has to stay awake, plugged
  in and pointed at the wall all night.
- **A real timeline.** Clips with in-points, cues, keyframed transforms,
  per-scene duration, playback modes. Everything is a function of show time, so
  a scrub is exact and two outputs agree without sharing frames.
- **A document.** Versioned `.aethermap`, autosave, crash recovery, history with
  coalescing, a host library with sharing and per-document revisions.
- **Exact projection geometry.** Homography per surface, arbitrary mask
  profiles, ellipse and radius shapes, a setup photo to align against, and a
  projection grid that renders identically in the viewport and on the wall.
- **27 shader effects** with a time model (offset, loop, ping-pong, freeze) and
  per-parameter cycles — deeper than "an effects library" with fixed controls.

## Historical status — seven scoped items, 2026-09-16

Every gap below is implemented. Two carry deliberate limits, marked in place:
video export captures the output window rather than compositing a file, and the
tablet work stops short of phone widths. Details in `dev/docs/reality/STATUS.md`.

## The gaps, in the order I would close them

### 1. Audio reactivity — **closed today**

Their feature list has it; we had `audio: false` in the one place we touched a
microphone. For a holiday show this is table stakes: the display is supposed to
move with the music.

Built as a **modulation source** rather than a separate system, because shader
parameters already had cycles and audio is just a different thing driving one.
`live/audio.ts` publishes four smoothed levels — bass, mids, treble, everything
— from an AnalyserNode. A parameter set to "Audio" follows its band instead of a
waveform. Rises are instant so a kick lands on the frame it happens; falls are
eased, because a value tracking the waveform exactly flickers rather than pulses.
Bands, not FFT bins, so changing the analyser later cannot retune every saved
show. Echo cancellation, noise suppression and auto gain are off — they are for
speech and would eat exactly the dynamics a show reacts to.

`modulationAt` takes the levels as an argument rather than reading the
microphone, so show motion stays a pure function and is testable without a sound
card. Each window listens to its own room, the same way each already runs its own
clock.

### 2. Two-channel live mixing — **closed**

Their standout, and we have nothing like it. We have layers and per-surface
opacity, but no A/B pair with a crossfader you ride while the show runs. Ours is
an authoring tool that plays back; theirs is an instrument you perform on.

Sketch: two scene slots, A and B, a master crossfade, and the output compositing
both. It fits our model — outputs already name a scene — but it needs the
renderer to draw two scenes at once, which nothing does yet.

### 3. Video export — **closed, with a limit**

They export 720p/1080p/4K with audio, to Photos. We have no export at all. This
matters more than it looks: it is how a show gets shared, and how someone with a
dumb projector plays one. `MediaRecorder` over a `captureStream()` of the output
raster is the obvious route.

### 4. MIDI in — **closed**

Listed in their store copy. `navigator.requestMIDIAccess` mapping CC to shader
parameters is small now that modulation sources are a concept — audio proved the
shape, MIDI reuses it.

### 5. A starting content library — **closed**

They ship Halloween and Christmas scenes that fill a dark corner with no mapping
at all. We open empty. Our 27 generative shaders are most of the raw material;
what is missing is a handful of finished, named scenes.

### 6. Draw mode — **closed**

Making visuals live, by hand, while projecting. We have pen and freehand tools,
but they produce mask profiles, not painted content.

### 7. Phone and tablet — **tablet closed, phone not attempted**

Theirs runs on the thing in your pocket. We are a desktop web app — which is
also a genuine advantage, since we are a URL rather than a store listing, and
tablets are a layout problem rather than a port. Worth measuring before it is
worth building.

## Not worth chasing

- **AirPlay/HDMI/USB-C plumbing.** A browser window dragged to a display already
  covers it, and we have wireless and cast paths.
- **Their price model.** We are self-hosted; the comparison does not transfer.

## Sources

- https://lazylighting.com/
- https://apps.apple.com/us/app/lazy-lighting/id6751762579
- https://play.google.com/store/apps/details?id=com.audityapps.lazylighting
- https://www.core77.com/posts/139554/Lazy-Lighting-App-Makes-Projection-Mapping-Easy
- https://www.surfabeam.com/blogs/lazy-lighting-alternatives
