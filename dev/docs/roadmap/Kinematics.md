# Kinematics: DOF controls, limits, drive, and relations (planned)

> The kinematic layer on top of typed mates, modeled on Onshape's mate
> dialog and relations (Jonathan, 2026-07-15, with the Onshape Revolute
> dialog as the UI reference: mate connectors list, Offset, a Limits
> checkbox, per-axis min/max angle fields, and flip/align controls).
> Everything here is kinematic — physics/dynamics stays deferred per
> AGENTS.md. Nothing below is implemented until its packet lands and
> STATUS.md says so.

## 0. The three rules (Onshape's model, ours too)

1. **One mate aligns two connectors.** A mate connector is a part-local
   coordinate frame (origin + XYZ). A single mate feature fully
   positions the pair — never a stack of constraints.
2. **The mate kind decides the DOF.** Of the six physical freedoms
   (3 translational, 3 rotational), the kind defines exactly which
   remain (§1).
3. **Flip, reorient, offset.** The primary axis can be flipped, the
   secondary axis reoriented in 90° steps, and exact offset distances
   applied — all without remaking the mate (§4).

A mate's kind is also **switchable in the dialog after creation**
(the inspector Type menu already anticipates this): switching kinds
keeps both connectors and remaps the DOF set; if animation exists on a
DOF the new kind removes, the switch prompts with the consequence —
never a silent track deletion.

**Deferred kind — Tangent:** Onshape's tangent mate maintains
surface-to-surface contact and does not use standard connectors. It
needs contact geometry math we get no animatronics value from yet;
the loader rejects `tangent` loudly rather than the enum carrying an
unimplementable case.

## 1. Foundation: every mate exposes its DOF (contract recap)

A mate's kind defines its DOF set — the eight-kind family is already
shipped in the UI catalog and the Python `JointType`; AnimaCore's typed
backend (in flight, Codex) completes it. Each DOF carries:

| Field | Meaning |
|---|---|
| `kind` | rotation \| translation |
| `axis` | derived from the mate connector frame (primary = connector Z; pin-slot translation uses connector X) — never a free vector the operator types in |
| `valueRadians` / `valueMeters` | current kinematic value (0 = as-mated) |
| `neutral…` | the pose used for fallback and "home" |
| `limits` | **optional** — see §2. Absent limits = continuous/unbounded motion (a wheel keeps spinning) |

Per-kind DOF sets (already encoded in `aether_animation/rig.py`
`JOINT_TYPE_DOF_TEMPLATES` — AnimaCore must match, snake_case raw
values, same DOF names):

| Kind | DOF (in template order) |
|---|---|
| fastened | — |
| parallel | translation_x, translation_y, translation_z, rotation (Z) |
| revolute | rotation (Z) |
| slider (prismatic) | translation (Z) |
| cylindrical | rotation (Z), translation (Z) |
| pin_slot | rotation (Z), translation (X) |
| planar | translation_x, translation_y, rotation (Z) |
| ball | rotation_x, rotation_y, rotation_z |

### Mate categories (kinematic vs geometry-constraint)

Mates split into two categories (`mate_type_schema` carries `category`
and `drivable`; `aether_animation.mates.mate_category`):

- **Kinematic** (the eight above) — abstract connector frames plus DOF.
  The engine owns their motion fully: `child_in_parent` resolves them
  through `C_A ∘ ALIGN ∘ Offset ∘ Motion ∘ inverse(C_B)` (§1a).
  `drivable: true`.
- **Geometry-constraint** (`width`, `tangent`) — placement depends on
  real surface geometry, which lives app-side (RealityKit), not in this
  abstract engine. The engine **recognizes, round-trips, and catalogs**
  them but does not compute their geometry. Both are 0-DOF and
  `drivable: false`.
  - **`width`** centers a tab between two faces (midplane to midplane),
    no offset. Once the app supplies the two computed midplane
    connectors it resolves like a **0-DOF rigid/fastened** mate through
    the ordinary connector path (`C_A ∘ ALIGN ∘ inverse(C_B)`, no
    offset, no motion) — the child lands at the centered position.
  - **`tangent`** keeps two surfaces in contact; no connectors, no
    offset, geometry-dependent free DOF. **Deferred / non-driving:**
    there is no geometry kernel here, so `resolve_pose` leaves the
    child at the parent frame (identity relative) and Studio resolves
    the actual contact. The engine invents no contact math.

## 1a. Pose resolution (implemented — `aether_animation/kinematics.py`)

The forward-kinematics engine that makes every mate actually *move* the
child part relative to the parent — about/along the **mate connector as
the relative origin**, per the mate's DOF, chained through the rig. This
is the canonical home for the math the Swift `RigPoseResolver` /
`MateConnectorMath` used to own (Studio_Bridge migration step 2);
RealityKit consumes it through the bridge `resolve_pose` verb. Stdlib +
`math` only, deterministic, kinematic (no dynamics).

**Rigid `Transform`.** A unit-quaternion rotation (`(x, y, z, w)`, real
part last — RealityKit `simd_quatf(ix, iy, iz, r)` order) plus a metre
translation. `compose(a, b)` is `a ∘ b` (apply `b` then `a`);
`apply_point(p) = rotate(p) + translation`; `inverse` round-trips.

**Connector frame.** `connector_frame(connector)` builds a `Transform`:
translation = `origin_m`; rotation from the orthonormal basis
`Z = normalize(primary_axis)` (negated first when `flipped`),
`X = normalize(secondary_axis made ⊥ Z by Gram-Schmidt)`, `Y = Z × X`
(right-handed). Z is the axis a revolute turns about / a slider travels
along; X is pin-slot's slot direction.

**Motion.** `mate_motion(joint, dof_values)` composes, in template
order, one sub-transform per DOF: a rotation DOF (θ radians) rotates θ
about its **canonical connector-frame axis** (the x/y/z from
`JOINT_TYPE_DOF_TEMPLATES` — revolute about Z, slider along Z, pin-slot
translation along X), a translation DOF (d metres) translates d along
it. The DOF's own stored `axis` vector is *not* used — direction is the
connector frame's, per §1. A missing DOF uses its neutral.

**Offset.** `mate_offset_transform(offset)` is identity when disabled,
else `translate(translation_m) ∘ rotate(rotation_axis,
rotation_radians)` — rotation first, then translation, both in the
aligned connector frame. Offsets shift the zero pose; they never consume
a DOF (§4).

**Child in parent.** `child_in_parent(joint, dof_values)` is the child
part's transform relative to the parent:

```
child_in_parent = C_A ∘ ALIGN ∘ Offset ∘ Motion ∘ inverse(C_B)
```

where `C_A` = `connector_frame(connector_a)` (parent-local), `C_B` =
`connector_frame(connector_b)` (child-local). `ALIGN` is **180° about X**
(which opposes the two Z axes — the CAD "first selection moves onto the
second" default, matching the Swift `opposingPrimaryAxisMatrix`) **unless
`flip_primary_axis`** is set (then Z axes align), composed with a Z
rotation of `secondary_axis_rotation_deg`. **Coincidence property:** at
zero DOF and zero offset the child connector origin maps exactly onto the
parent connector origin, with primary(Z) opposed and secondary(X)
aligned. A joint with **no connectors** (`controls is None` or a
connector is `None`) puts motion at the part origin:
`child_in_parent = Offset ∘ Motion`. **Fastened** (no DOF) reduces to the
rigid alignment `C_A ∘ ALIGN ∘ Offset ∘ inverse(C_B)`.

**Forward kinematics.** `resolve_pose(rig, pose)` returns every part's
**character-space** `Transform`. A part that is no active joint's
`child_part` is a ROOT and resolves at its **rest transform**
(`part_rest_transform` — `position_m` + `rotation_euler_rad`, identity
when unauthored; a GROUNDED part likewise sits at its rest transform,
overriding any incoming joint). Walking parents before children
(repeated pass over the acyclic joint graph),
`world[child] = compose(world[parent], child_in_parent(joint, …))`,
pulling DOF values from `pose.dof_values` (keyed `"<joint>.<dof>"`); a
mated child is placed by its mate, so its rest transform is not applied
on top. `transform_to_json(t)` serializes to `{position:[x,y,z],
orientation:[x,y,z,w]}` for the wire. The rest transform is
part-in-character and the output is character-space — the World →
Character → Part frame model and the intrinsic-XYZ Euler convention are
normative in [`Coordinate_Frames.md`](Coordinate_Frames.md).

> **Connector direction is the source of truth.** A connectorless mate
> rotates/translates about the *part-origin* canonical axis (Z for every
> revolute). To make a chain articulate in different planes (a serial
> arm's alternating pitch axes), each joint needs connectors orienting
> its Z — the per-DOF `axis:` vector authors may still write is legacy
> and does not steer motion here.

## 2. Limits and range of motion (Onshape "Limits" checkbox)

- Limits are **per DOF**, optional, and live in the mate dialog: an
  enable checkbox, then `minimum` / `maximum` fields in operator units
  (degrees / millimeters; radians / meters in the model, per
  CONVENTIONS explicit-unit naming).
- Semantics: hard stops. The evaluator clamps manual drive, clip
  evaluation, and hardware projection to the enabled range. Disabled
  limits = unbounded DOF.
- Validation: min < max; neutral within range when limits are enabled.
  A DOF with no limits **cannot be mapped to a bounded actuator
  channel** (a hobby-servo mapping requires a range to project to
  0..1) — mapping such a DOF is a validation error naming the fix, not
  a silent clamp. Continuous actuators (steppers, continuous-rotation
  servos) lift this later (B08).
- Viewport (follow-up slice, not first cut): a range arc / travel bar
  drawn at the connector while editing limits.
- Python parity: `rig.py` currently requires a range on every DOF;
  it must adopt optional limits with identical semantics, and the
  `.anima` format marks limits optional per DOF.

## 3. Manual drive (jog handlers)

Operators drive each DOF directly, before any animation exists:

- **Inspector:** one row per DOF on the selected mate — labeled slider
  (bounded when limits are enabled; unbounded spinner otherwise) +
  number field + unit + a "reset to neutral" affordance. Drives the
  kinematic preview pose live through the existing pose resolver; it
  does not write keyframes. (Animate-workspace auto-key integration is
  a later, explicit slice.)
- **Viewport:** selecting a mate shows per-DOF drive handles at the
  connector frame — a rotation ring about the DOF axis for rotational
  DOF, a linear arrow along it for translational DOF (cylindrical gets
  both, ball gets three rings). Dragging jogs the DOF with the same
  clamping as the inspector. Reuses the existing TransformGizmo
  conventions rather than inventing a second gizmo language.
- Locked mates: drive is disabled with the standard lock treatment.

## 4. Flip and align (orient the DOF)

The connector frame defines every DOF axis, so these are connector
operations in the mate dialog:

- **Flip:** reverse the primary (Z) axis of one side's connector —
  motion direction inverts. One button per connector row (matches
  Onshape's flip affordance).
- **Reorient / align:** cycle which stored frame axis serves as
  primary Z (X→Z, Y→Z, Z→Z) for a connector, and rotate the secondary
  axis in 90° increments (pin-slot's X translation direction).
  Presented as a small axis picker on the connector row; the stored
  part-local frame is rewritten — animation values keep their meaning
  relative to the new axis, so reorientation while clips exist raises
  a confirm-with-consequences prompt (no silent retarget).
- **Offsets:** exact as-mated offsets applied between the two aligned
  connector frames, stored per mate and applied before DOF values:
  translational offset along Z (plus X/Y where the kind's geometry
  makes it meaningful) and a rotational offset about Z. Dialog fields
  in operator units with an enable checkbox, exactly like the Onshape
  dialog's Offset section. Offsets shift the zero pose; they do not
  consume or restrict DOF.

> **Unified in AnimaCore (`aether_animation/mates.py`).** The connector pair,
> the flip (§4), the secondary-axis 90° reorientation (§4), the offset
> (§4), and the simulation-connection toggle are one value —
> `MateControls` — shared identically across all eight kinds; only the
> DOF set (§1) differs per kind. Two hooks surface it to the UI so the
> Swift side binds one consistent panel: `mate_type_schema` /
> `all_mate_type_schemas` (the static per-kind catalog: label, DOF
> slots, and the shared `universal_controls` id list) exposed by the
> bridge `mate_types` verb, and `describe_mate(joint)` (the per-instance
> descriptor: stable `id`, parts, every control's current value, DOF
> paths + limits) carried in the `load_character` joint summary. The
> `.anima` mate fields are documented in `Character_Format.md`.

## 5. Relations: coupling DOF across mates (advanced kinematics)

One core concept covers gears, racks, screws, and linear links — a
**Relation** is a linear coupling between exactly two DOF:

```
driven_value = ratio × driver_value + offset
```

| Relation | Driver DOF | Driven DOF | Ratio meaning / UI fields |
|---|---|---|---|
| Gear | rotation | rotation | teeth pair (20:40 → 0.5); flip sign for external mesh (checkbox: "reverse direction") |
| Rack & pinion | rotation | translation | effective pinion radius (meters per radian; UI: diameter or mm-per-rev) |
| Screw | rotation | translation (same mate allowed: cylindrical) | lead (mm per revolution) |
| Linear | translation | translation | plain ratio |

Rules (deliberately Onshape-faithful):

- Purely mathematical link — **no collision or mesh detection**; the
  relation drives regardless of visual intersection.
- The relation graph must be **acyclic** and each DOF may be driven by
  **at most one** relation (creation-time validation errors, reusing
  the existing mate-cycle prevention pattern).
- A driven DOF cannot carry its own animation track (load/authoring
  error naming the relation) — one source of truth for its motion.
- Limits vs relations: the relation always computes; if the driven
  value exits its enabled limits the UI shows a limit-violation
  warning (consistent with the B06 "warn, never silently rewrite"
  rule) and hardware projection refuses to arm while violated.
- Ratio is stored as one signed float; teeth/diameter/lead are UI
  conveniences that compute it (persisted alongside for round-trip
  display, but the float is the semantic value).

**Bridge hooks (implemented — `aether_animation/rig.py`, surfaced by
`aether_animation/bridge.py`).** The relation twin of the mate hooks:
`relation_type_schema` / `all_relation_type_schemas` (the static
per-kind palette catalog, verb `relation_types`) and `describe_relation`
(the per-instance descriptor, added as the `relations` array in
`load_character`). See `Studio_Bridge.md` for the exact shapes. Two
conventions the hooks encode:

- **Reverse / sign:** the engine stores one signed `ratio`; the UI shows
  a positive magnitude + a "reverse direction" checkbox. So
  `describe_relation` reports `reverse = ratio < 0` and
  `magnitude = abs(ratio)` while keeping the raw signed `ratio`.
- **mm-per-revolution display (rack_pinion / screw):** `ratio` is meters
  per radian; one revolution is `2π` radians, so the dialog's
  distance-per-revolution field is
  `distance_per_revolution_mm = abs(ratio) × 2π × 1000` (invert to store:
  `ratio = value_mm / 1000 / (2π)`). Gear/linear show the unitless
  `abs(ratio)` directly.

**Authoring flow (ribbon → two clicks, mirroring the mate flow):**
Relations group in the Rig ribbon (Gear, Rack & Pinion, Screw,
Linear) → click mate 1 → click mate 2 → if a mate has multiple
eligible DOF, a DOF picker chip appears → ratio dialog with the
kind-specific fields → create. Relations list in the navigator under
Mates; selecting one highlights both coupled mates in the viewport.

**Evaluation order (pose resolver):** resolve driver DOF (clip or
manual drive) → apply relations in dependency order → clamp/warn →
solve part transforms through the existing parent/child chain →
project mapped DOF to channels. Deterministic, still no dynamics.

**Format:** `.anima` characters gain a `relations:` list
(`kind`, `driver: mate.dof`, `driven: mate.dof`, `ratio`, `offset`,
display fields). Python loader/rig/evaluator mirror the exact
semantics with fixture parity tests against AnimaCore.

## 6. Triad manipulator (select an object → move/tilt it)

The classic triad — center ball, three axis arrows, three rotation
rings, three plane pads — shown on component selection. The viewport
already ships a basic form (`TransformGizmo`: per-axis arrows + rings
on free components); this packet upgrades it to Onshape grade and,
critically, wires it to the mate system.

**UI surface (the visible tool):**

- Center ball: screen-plane free drag. Axis arrows: single-axis
  translate. Rings: single-axis rotate. Plane pads (XY/YZ/XZ): planar
  translate. Live numeric readout while dragging (distance in mm,
  angle in degrees) with optional step snapping (1 mm / 5°, key-held).
- Handles use the existing gizmo visual language; disallowed motions
  are ghosted, not hidden-by-surprise (see modes below). Locked
  components keep today's rule: no handles at all.

**Backend contract (the important part):**

One drive abstraction serves every manual-motion surface — the triad,
the inspector jog rows (§3), the connector handles (§3), and later
puppeteering input (B09). A drag resolves to a `DriveTarget`:

- **Free component** (no mate constrains it): the triad edits the
  component's **rest transform** (build-time positioning). All six
  handles live.
- **Mated component:** the drag is decomposed onto the DOF its mate
  chain still permits and routed through the same per-DOF drive API as
  the jog rows — dragging a hinged door's ring about the hinge Z
  drives `mate.rotation` (clamped by limits, propagated through
  relations); handles for removed DOF render ghosted and inert. No
  separate "triad math" ever writes part transforms directly on a
  mated component — one motion path, one clamp, one warning system.
- Mixed selections and multi-mate chains resolve against the nearest
  governing mate (the same parent/child chain the pose resolver walks);
  ambiguous cases fall back to ghosted-with-explanation rather than
  guessing.

## 7. Packet sequencing

| # | Packet | Depends on | Lane |
|---|---|---|---|
| K1 | AnimaCore typed mates + DOF (in flight) | — | Codex (Swift core) |
| K2 | Per-DOF optional limits: core + evaluator clamp + mate-dialog Limits UI | K1 | Codex core/UI; Claude mirrors in Python + format |
| K3 | Manual drive: inspector jog rows + viewport DOF handles | K1 (K2 for clamping) | Codex |
| K4 | Flip / align connector controls | K1 | Codex |
| K5 | Relation core type + resolver coupling + validation | K1 | Codex core; Claude math/parity review |
| K6 | Relations authoring UI (ribbon tools, DOF picker, ratio dialog) | K5 | Codex |
| K7 | `.anima` format + Python runtime parity (limits, offsets, relations, drive-neutral round-trip) | tracks K2/K5 | Claude |
| K8 | Triad manipulator: Onshape-grade handles + mate-aware `DriveTarget` routing | K1, K3 (free-component upgrade can start on today's `TransformGizmo`) | UI Codex; drive-routing contract shared |
| K9 | Mate offsets: stored per mate, dialog Offset section, zero-pose shift | K1 | Codex core/UI; Claude format mirror |

Cross-lane contract points (announce in the briefing before editing):
the DOF field set (§1), optional-limits semantics (§2), the Relation
type and its validation rules (§5), and every `.anima` format change
(K7 mirrors, never forks).
