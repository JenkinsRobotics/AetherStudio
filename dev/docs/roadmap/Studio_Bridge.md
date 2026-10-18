# Studio ↔ AnimaCore bridge protocol (planned; BR1 engine side building)

> The seam that makes AnimaCore the single canonical engine and Anima
> Studio a front end (Jonathan + Codex, 2026-07-15). The app does not
> reimplement rig/evaluation semantics; it speaks this protocol to a
> bundled AnimaCore helper. One engine, one set of semantics, multiple
> front ends.

## Ownership (the policy this protocol enforces)

**AnimaCore (`aether_animation/`, Python) owns the meaning of everything:**
typed mates/DOF/limits/relations, canonical validation, keyframe and
scene evaluation, mate alignment + kinematic pose resolution,
`.character.anima` / `.scene.anima` parsing and writing, output
mapping + serial transport + hardware safety, and node-graph
compilation to scene logic.

**The Swift app owns presentation only:** windows/panels/tools,
selection/inspectors, undo/redo *command presentation*, RealityKit
rendering + model hit-testing, camera/gizmo drawing, file dialogs +
bookmarks + recent projects + macOS lifecycle, and the `.animastudio`
package's *editor-only* metadata (canvas layout, asset references,
revisions, milestones). The app holds **DTOs that mirror engine
results** — it never independently defines what a rig, a pose, or a
frame *means*.

The `.animastudio` package **contains or references** canonical
`.character.anima` and `.scene.anima` documents plus editor metadata.
It is not a competing executable animation format.

The Swift `AnimaEvaluation` target's evaluator and the RealityKit
`RigPoseResolver` / `MateConnectorMath` are **transitional** — they get
replaced by bridge calls (migration order below), not extended.

## Transport

Newline-delimited JSON over the helper's stdio. The app spawns the
helper (`python -m aether_animation.bridge`, or a bundled executable) and
keeps it alive for the session — one long-running process, not a
shell-out per call. One JSON object per line, UTF-8.

**Request:** `{"id": <int>, "method": "<verb>", "params": {…}}`
**Response (ok):** `{"id": <int>, "ok": true, "result": {…}}`
**Response (error):** `{"id": <int>, "ok": false, "error":
{"code": "<slug>", "message": "<human>", "path": "<format path|null>"}}`

`id` is echoed so the client can match replies; the helper may answer
out of order. Error `code` is a stable slug (`protocol_mismatch`,
`format_error`, `unknown_handle`, `limit_violation`, `bad_request`);
`path` carries the loader's field path (`clips.turn.tracks…`) verbatim
when the error is a format error, so the app shows it at the offending
line — one error surface, never a second parser.

## Verbs — BR1 vertical slice

| Method | params | result |
|---|---|---|
| `hello` | `{client, protocol_version}` | `{engine:"aether_animation", engine_version, protocol_version, capabilities:[…]}` — mismatched `protocol_version` → `protocol_mismatch` error |
| `load_character` | `{text}` (file bytes; `path` variant later) | `{handle, rig:{identity, parts:[…], joints:[<describe_mate>…], parameters:[…], clips:[{name,duration_s,loop,keyframes}], outputs:[{dof_path,channel,value_at_zero,value_at_one}], relations:[<describe_relation>…]}}` — invalid → `format_error` with `path`. Each joint entry is `describe_mate`; each relation entry is `describe_relation` (see below). The `rig` block is **full-fidelity** so `serialize_character` can rebuild the rig losslessly — see "Serialization" for the additive enrichment fields (`keyframes`, output ranges, per-DOF `axis_vector`/`name`/`description`, joint `description`). |
| `validate_character` | `{text}` | `{diagnostics:[…]}` (empty = valid) — no handle allocated |
| `evaluate` | `{handle, clip?, time_s?}` | `{dof_values:{path:native_units}, parameters:{name:0..1}, channels:{channel:0..1}, limit_violations:[{dof_path,value,min,max}]}` |
| `resolve_pose` | `{handle, clip?, time_s?}` | `{parts:{part_name:{position:[x,y,z], orientation:[x,y,z,w]}}}` — per-part **world** transforms after forward kinematics. **The RealityKit render hook.** Unknown handle → `unknown_handle`. See below. |
| `mate_types` | `{}` | `{mate_types:[{type,label,category,drivable,dof_count,universal_controls:[…],dofs:[{name,kind,unit}]}]}` — the static per-kind catalog for all **10** mate kinds (the palette / panel-builder hook); no handle needed. See categories below. |
| `preview_mate` | `{handle,joint,clip?,time_s?}` | `{parts:{part_name:{position,orientation}}}` — validate a candidate full-fidelity joint DTO and resolve the resulting pose without mutating the loaded rig. Used for the two-click connector alignment and live flip/reorient/offset preview; only `add_mate` commits. A cyclic candidate returns `format_error`. |
| `add_mate` | `{handle,joint}` | `{handle,rig}` — validate and append one full-fidelity joint DTO (the same shape carried by `load_character.rig.joints`), store the resulting canonical rig under the same handle, and return its refreshed summary. |
| `update_mate` | `{handle,joint}` | `{handle,rig}` — replace the existing mate keyed by `joint.name`, validate the complete rig, and return its refreshed canonical summary. |
| `remove_mate` | `{handle,name}` | `{handle,rig}` — remove the named mate, validate the resulting rig, and return its refreshed canonical summary. |
| `relation_types` | `{}` | `{relation_types:[{kind,label,driver_kind,driven_kind,ratio_field:{key,unit},reverse_supported}]}` — the static per-kind catalog for all **4** relation kinds (Gear, Rack and pinion, Screw, Linear); the relations palette/dialog hook; no handle needed. See relations below. |
| `add_relation` | `{handle,relation}` | `{handle,rig}` — validate and append a full-fidelity relation DTO; rejects a second relation driving the same DOF. |
| `update_relation` | `{handle,relation}` | `{handle,rig}` — replace the relation keyed by its `driven` DOF path, validate the complete rig, and return its refreshed canonical summary. |
| `remove_relation` | `{handle,driven}` | `{handle,rig}` — remove the relation keyed by its unique driven DOF path and return the refreshed canonical summary. |
| `serialize_character` | `{rig}` — the full rig DTO, **exactly the shape `load_character` returns in its `rig` field** (identity, parts, joints w/ controls + enriched dofs, parameters, clips w/ keyframes, relations, outputs w/ ranges) | `{text}` — canonical `.character.anima` YAML. The write side of Save: one format author. The engine rebuilds a `Rig` from the DTO (native units in, degrees out) and validates it — an un-serializable/invalid rig is a `format_error` (with `path` when the loader supplies one), so the app can never write a broken file. See "Serialization" below. |
| `serialize_scene` | `{scene}` — the `.scene.anima` document structure (identity, character, variables, inputs, subroutines, sequence with every v1+v2 action incl. condition trees/select/call/wait_until, monitors, editor). No `load_scene` verb exists yet, so this DTO is the parsed-document shape (what `scene_to_dict` emits). | `{text}` — canonical `.scene.anima` YAML. Validated by re-parsing through the canonical scene loader; invalid → `format_error` with `path`. |
| `release` | `{handle}` | `{}` — drop a loaded rig |
| `shutdown` | `{}` | `{}` then the helper exits |

Units are native and explicit in the model (radians / meters); the app
formats to degrees/mm for display. `channels` is exactly
`project_channels` output; when a mapped DOF is in `limit_violations`
the channel is omitted (hardware must refuse to arm) rather than erroring
the whole evaluate.

**Enriched joint summary (`describe_mate`).** Each joint in
`load_character` is the consistent per-mate hook
`aether_animation.mates.describe_mate(joint)`:

```
{id, name, type, parent_part, child_part,
 controls: {connectors:{a:<connector|null>, b:<connector|null>},
            offset:{enabled, translation_m:[x,y,z], rotation_axis:"x|y|z",
                    rotation_radians},
            flip_primary_axis, secondary_axis_rotation_deg,
            simulation_connection},
 dofs: [{path, kind, unit, min, max, neutral}]}
```

where each connector is `{part, origin_m:[x,y,z], primary_axis:[…],
secondary_axis:[…], flipped, feature}`. `id` is a stable tracking id
distinct from `name` (empty until the app assigns it); `controls` is
the universal control set every kind shares (only the DOF slots differ
per kind — see `mate_types`). Offset rotation is native radians here,
like the DOF descriptors. A mate that declared no controls reports
null connectors and default control values.

**Mate categories (`mate_types` returns 10).** Every schema carries a
`category` (`"kinematic"` for the eight engine-driven mates,
`"geometry_constraint"` for `width` and `tangent`) and a `drivable`
flag (`true` for the eight, `false` for the geometry pair — the engine
does not drive them; their geometry is app-resolved). The
geometry-constraint schemas also carry a `note` explaining that and
advertise their own `universal_controls`:

- **`width`** → `["connector_a","connector_b","flip_primary_axis",
  "simulation_connection"]` (no offset, no secondary reorientation).
- **`tangent`** → `["tangent_selection_a","tangent_selection_b",
  "tangent_propagation","simulation_connection"]` (no connectors, no
  offset).

`describe_mate` carries `category` on every mate. Kinematic mates and
`width` keep the `controls` block above (width's two connectors are the
app-computed midplanes, its offset inert). `tangent` carries no mate
connectors: instead of `controls` it reports `tangent:{selection_a,
selection_b, propagation}` (opaque app-side surface ids + a bool). Both
are 0-DOF (`dofs: []`).

**Relations (`relation_types` + the `relations` array).** The relation
twin of the mate hooks (Kinematics.md §5). `relation_types` is the
static per-kind catalog (the palette / dialog builder); `load_character`
adds a `relations` array of per-instance `describe_relation` descriptors
(empty for a rig with no relations). The four kinds, in order:

| kind | label | driver_kind | driven_kind | ratio_field |
|---|---|---|---|---|
| `gear` | Gear | rotation | rotation | `{key:"relation_ratio", unit:"ratio"}` |
| `rack_pinion` | Rack and pinion | rotation | translation | `{key:"distance_per_revolution", unit:"mm"}` |
| `screw` | Screw | rotation | translation | `{key:"distance_per_revolution", unit:"mm"}` |
| `linear` | Linear | translation | translation | `{key:"relation_ratio", unit:"ratio"}` |

`driver_kind`/`driven_kind` tell the UI which mates/DOF are selectable
on each side; `reverse_supported` is `true` for all four (every dialog
has the "reverse direction" checkbox). Each per-instance descriptor:

```
{kind, driver, driven, ratio, offset, reverse, magnitude,
 ratio_field_value, display}
```

where `driver`/`driven` are DOF paths (`"<joint>.<dof>"`), `ratio` is
the raw **signed** semantic value (the truth), `offset` is in the driven
DOF's native units, and `display` passes the round-tripped non-semantic
fields (teeth, lead, diameter — see the format) through unchanged.
The three mutation verbs accept this semantic subset directly:
`{kind,driver,driven,ratio,offset?,display?,suppressed?}`. They mutate the
rig held by the bridge handle, re-run complete rig validation, and return
the same full-fidelity `rig` summary shape as `load_character`. Studio must
replace its retained DTO from that response; it must not independently
reconstruct relation meaning.

**Reverse / ratio-sign convention.** The engine stores exactly one
signed `ratio`. The UI never edits that sign directly — it shows a
positive *magnitude* field plus a "reverse direction" checkbox and sends
back the signed ratio. So the descriptor splits it for display:
`reverse = ratio < 0`, `magnitude = abs(ratio)`.

**`ratio_field_value` (the number the dialog's editable field shows).**
For `gear`/`linear` it is the unitless `abs(ratio)`. For
`rack_pinion`/`screw` it is **distance-per-revolution in mm**: the engine
stores `ratio` as **meters per radian**, and one revolution is `2π`
radians, so `distance_per_revolution_mm = abs(ratio) × 2π × 1000`. The UI
inverts to store: `ratio = value_mm / 1000 / (2π)`, negated when reverse
is checked. Example: rc_car's steering rack stores `ratio = 0.02` m/rad →
`ratio_field_value ≈ 125.664` mm/rev.

**Pose resolution (`resolve_pose`).** Forward kinematics over the joint
graph: `evaluate` the frame, then walk parents-before-children giving
each part its **world** transform. `params` mirror `evaluate`
(`{handle, clip?, time_s?}`); the result is one entry per part:

```
{parts: {part_name: {position:[x,y,z],
                     orientation:[x,y,z,w]}}}
```

`position` is metres; `orientation` is a unit quaternion with the real
part **last** — RealityKit `simd_quatf(ix, iy, iz, r)` order, so the app
constructs `simd_quatf(ix: o[0], iy: o[1], iz: o[2], r: o[3])` directly.
A part that is no joint's child is a root at identity (parts carry no
rest transform). Each mate moves the child relative to the parent about/
along the **mate connector as the relative origin**, per its DOF — the
canonical convention lives in `Kinematics.md` → "Pose resolution". This
verb **supersedes** the Swift `RigPoseResolver` + `MateConnectorMath`
(migration step 2 below): RealityKit renders engine-resolved geometry
instead of applying scalar joint angles to rest transforms.

**Non-destructive mate preview (`preview_mate`).** The request's `joint`
is exactly the DTO accepted by `add_mate`. AnimaCore temporarily appends
it to the loaded rig, validates the parent→child graph (including cycle
rejection), evaluates `clip`/`time_s`, and resolves the pose through the
same connector equation as `resolve_pose`. The temporary rig is discarded
before the response; the handle remains unchanged. Studio may therefore
send every flip, 90° secondary reorientation, and offset edit for live
feedback while the green checkmark remains the only committing action.

## Serialization (the Save write side — `serialize_character` / `serialize_scene`)

The engine owns `.anima` **writing** as well as reading, so a project
Save has one format author: the app hands the engine a rig/scene and
gets back canonical text (`aether_animation/serialize.py`, the inverse of the
loaders). Units and cleanliness mirror the loader — rotation angles are
radians in the model and **degrees** in the file (translations stay
metres); defaults are omitted, never echoed (`simulation_connection:
true`, a disabled zero offset, an all-default `controls` block, `loop:
false`, `linear` interpolation, a zero relation offset). Scenes carry no
unit conversion (the scene AST stores file units), so the scene write
side is a pure structural inverse.

**Round-trip guarantee (the acceptance test).** For every file in
`examples/`: `load_character(text)` → `serialize_character({rig})` →
`text'`, where `load_character(text')` yields a rig **equal** to the
first (float-tolerant on the degrees↔radians conversion). Proven for
`six_axis_arm` (mates + connectors + offset + clip), `rc_car` (relation +
unlimited wheel + parameter), `walle_style` (mixed joints + parameters),
and `geometry_mates_demo` (width/tangent). Same for scenes via
`serialize_scene` (exact AST equality).

**`load_character` enrichment (additive — nothing renamed/removed).** So
`serialize_character` can rebuild the rig from exactly the DTO
`load_character` returns, the `rig` block carries a few fields beyond the
original spec shapes, all *added*: each clip gains `keyframes` (per-time
keyframe entries in native units); each output gains `value_at_zero` /
`value_at_one` (the mapping range in native units); each `describe_mate`
joint gains a `description` and, per DOF, its `name`, `axis_vector` (the
file's `axis:` list — null when absent, distinct from the template
`axis` string), and `description`. Existing consumers of the summary /
`describe_mate` are unaffected.

## Later verbs (reserved, each gated on its engine feature)

- `load_scene` / `scene_new_runner` / `scene_advance` / `scene_post_event`
  → drive `SceneRunner` for Show playback.
- `open_output` / `send_frame` / `stop` → the app's Hardware workspace
  driving a real device through `serial_transport`, capabilities-gated.
- `compile_graph` → node canvas ↔ `.scene.anima`.

## Migration order (replace, don't extend, the Swift engine)

1. **BR1 (now):** policy + protocol + engine helper with the slice
   above; **prove the seam vertically** — Codex's client opens a
   `.character.anima` example through the helper, evaluates one frame,
   renders the returned DOF values in RealityKit (its current pose
   resolver applies them to rest geometry).
2. **Done (engine side):** `resolve_pose` ships the mate-alignment +
   kinematic math in the engine (`aether_animation/kinematics.py`). Remaining
   app work: route RealityKit through `resolve_pose` and delete the
   Swift `RigPoseResolver` + `MateConnectorMath`.
3. Route the Swift timeline/inspector through `evaluate`; delete the
   Swift `AnimaEvaluation` evaluator.
4. `.animastudio` save/open wraps canonical `.character.anima` /
   `.scene.anima` written by the engine, via the bridge.
5. Simulator/serial output and scene playback through the same helper.
