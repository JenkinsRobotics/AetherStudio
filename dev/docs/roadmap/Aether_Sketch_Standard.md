# Aether sketch standard — 2026-09-29

Jonathan requested one reusable sketch standard, developed and exercised in
Aether Sketch, consumed by Map and CAD where behavior matches. This is an
explicit cross-product boundary, not a move of the CAD engine into shared code.

## Implemented foundation

`core/sketch` / `@aether/sketch` owns pure 2D geometry, retained cubic paths,
subdivision, transforms, anchor/handle movement, sampling/picking, construction
and pointer-coordinate gesture state. It is renderer- and product-independent.
No application imports another product's engine. Tolerances and quantization
are explicit adapter policy; documents own their coordinate system and units.

- Sketch consumes the package in a working SVG vector editor with Aether UI
  ribbon/panels/tree/themes, nested layers/groups, multi-path transforms, snapping,
  open/closed pen, retained cubic ellipses, fills, node modes, break/join/reverse,
  trim/offset contours, undo, local save/reopen and SVG export.
- Map consumes the same tools and curves. Its adapters retain integer polygon
  construction and pixel tolerances, legacy hexagon detection, Surface metadata,
  mask roles, projection, output and v3 persistence. Optional mask node modes
  expose the same coupled-handle behavior through Map’s inspector.
- CAD consumes common containment/segment picking, point/axis snap target selection and SVG
  arc construction.
  Its exact contours, CAD constraints, plane mapping and solver stay product-owned.
  Most CAD authoring tools have not yet moved to adapters over this package.

Aether UI remains presentation-only. It does not depend on this package or own
sketch semantics. New standalone controls should use `@aether/ui`; shared path
algorithms belong in `@aether/sketch`, not product copies.

## Closed contours and regions — Jonathan's clarified model

A shared sketch produces paths and closed contours. Valid boundaries construct
planar regions with area; CAD consumes profiles to make feature geometry, while
Map consumes regions for projection/warping/content. Region construction must
be shared but does not itself create a 3D volume. Open paths remain geometry.

Implemented drawing contract: compound contours, explicit fill rules, caller-unit
flattening tolerance, closure/degeneracy checks, holes and polygon Booleans. Sketch
exposes make/release compound and individual contour editing. Map now adopts
compound masks and region commands. CAD imports vector contours and offers explicit
Boolean copies while retaining native analytic entities and solver constraints. Actual implementation
coverage: [Shared Vector Coverage](../reality/Shared_Vector_Coverage.md).

## Next vector integration slices (planned)

1. Inventory CAD's remaining pure geometry and interaction functions against
   the shared contract; migrate behavior with parity fixtures. Keep analytic
   lines/arcs/ellipses exact and do not replace constraints with sampled polygons.
2. Analytic conics, exact curve Booleans and pathological winding cases remain
   future work. Sketch now has tolerance-based polygon Booleans, editable text
   and a supported SVG import subset. Cubic trim intersections are sampled;
   offsets reject collapsed/self-crossing results. Full SVG effects/text-on-path
   and font outlining are not implied by this baseline.
3. Extend boundary tests across coordinate scales and input devices. Physical
   stylus, touch and Safari coverage are not yet verified.
4. Product-specific adapters for persistence/commands and shared UI node/tool
   controls where a second UI consumer actually matches their interaction.

## Vector painting (implemented baseline, 2026-09-29)

Shared gradient values/validation/endpoints live in `core/sketch`; controlled
stop editing lives in `core/ui/GradientControls`. Sketch uses these for vector
fills, alongside stroke styles, appearance sampling, fill tool and live clipping
groups. Map uses the same paint values and controls for surface/scene colour
sources, preserving its existing shader/media source selection. Shaders execute
in Map's renderer; paint changes do not replace contour geometry. Vector painting
is current scope; the raster blueprint below remains deferred.

## Document recovery (implemented, 2026-09-29)

Sketch v2 stores compound paths and editable text; v1 drawings upgrade on Open.
Debounced session recovery and durable IndexedDB drafts are scoped by account,
project and working tab. Recover drafts offers explicit restore/delete. This is
browser-local recovery; server persistence/collaboration remain product work.

## Raster painting blueprint (planned; separate from vector geometry)

The Antigravity handoff was read from the author's home directory:
`~/.gemini/antigravity-ide/brain/4df3a110-ba45-4e68-804d-3edb382de1d6/aether_sketch_blueprint.md`.
Its original repository-relative link was not present. Requirements are retained
here so development does not depend on an agent's private directory:

- Product-owned WebGL2/WebGPU raster renderer; layer textures/framebuffers and
  measured stroke latency/frame rate, aiming at 60 FPS on agreed target hardware.
- Input sampling with pointer capture, coalesced events, pressure, tilt,
  mouse/touch/stylus distinction and smoothing. Extract an input contract only
  when another consumer needs the same behavior.
- Graphite pencil with grain/tilt shading, ink with pressure and speed taper,
  multiply marker, watercolor diffusion/bleed and directional acrylic/oil bristles.
  Per-brush erasing removes alpha, not whole vector objects.
- Brush popovers with size/flow/color; HSB picker and raster pixel sampling.
  Vector appearance sampling is already available.
- Raster/image layers with thumbnails, opacity, Normal/Multiply/Screen,
  merge-down, import, ordering and locking.
- Two-finger pan/pinch, canvas rotation, two-/three-finger undo/redo gestures.
- Layered texture persistence and recoverable local storage; `.aethersketch`
  format migration from the current vector v1 before adding raster data.
- Flat PNG/JPEG export and genuinely layered PSD export with roundtrip tests.
- Studio document/session integration: account/project-scoped storage and
  collaboration semantics supplied by the host, not a single shared global draft.

None of these planned painting features is implied by the current Pencil tool,
which produces a plain editable polyline. No physics or 60-FPS guarantee is
claimed. The proposed raster renderer belongs to Sketch until a second real
consumer establishes a shared requirement.
