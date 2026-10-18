# Anima — Scene Format Specification

> File extension: `.scene.anima`  
> Format: YAML  
> Version: execution v1 + v2 — the show-playback subset the Python
> runtime executes (`aether_animation/scene.py` is the reference
> implementation). v2 adds the FANUC-inspired scripting constructs
> (condition trees, `select`, `call`/`subroutines`, `inputs`,
> `wait_until`, background `monitors`) additively within
> `anima_version: "2.0"` — every v1 scene loads unchanged. The 1.0
> draft below is kept for the speech/expression/lights/AI sections
> that have not been redesigned yet; those action types are
> spec'd-but-deferred and rejected by the loader.

A scene file describes a complete performance — an ordered action
sequence with timing and logic gates that drives one character. This is
the piece that outruns a tethered export: a scene plus its character
file plays back on the headless runtime with no authoring tool
attached.

---

## Execution v1 — the shipped subset

A v1 scene is `identity` metadata, the relative path of the
`.character.anima` it drives, initial scalar `variables`, and a
`sequence` of actions. Parsing follows the character-loader
discipline: closed schema, typed errors naming the offending path
(`sequence[2].if.then[0].clip`, ...), explicit units (`_s`/`_ms`).
Unknown fields anywhere are load errors: reject, never silently drop.

```yaml
anima_version: "2.0"
type: scene

identity:                # same shape as character identity
  name: pick_and_wave    # required
  display_name: "Pick and wave"   # optional, with description/version/author

character: six_axis_arm.character.anima   # resolved relative to the
                                          # scene file's directory

variables:               # optional; scalar initial values only
  keep_scanning: true    # bool | int | float | string
  finale: "wave"

sequence:                # ordered action list (see below)
  - clip: pick
```

The worked example exercising the full v1 surface is
[`examples/pick_and_wave.scene.anima`](../../../examples/pick_and_wave.scene.anima).

### v1 actions

| Action | Shape | Semantics |
|---|---|---|
| `clip` | `clip: <name>` + optional `speed`, `wait`, `duration_s` | Play a character clip. `speed` is a rate ratio (2.0 = twice as fast). `duration_s` bounds wall playback and is **required for a looping clip** (a loop has no natural end; time wraps modulo the clip). `wait: false` continues the sequence immediately while the clip plays in the background — inside a clip entry `wait:` is this flag, never the wait action. |
| `pose` | `pose: {<dof_path_or_param>: <value>, ...}` + `duration_s` | One-off linear move to a target pose over `duration_s` (0 = jump), starting from each target's current value captured when the action starts. Values are file units (degrees / meters / 0..1) and are validated against limits at load; a relation-driven DOF cannot be posed (pose its driver). |
| `wait` | `wait: {seconds: <float>}` | Hold the current pose for the duration. |
| `wait_for` | `wait_for: {event: <name>, timeout_s: <float>?, on_timeout: skip\|end?}` | Suspend until `post_event(name)` fires. Without `timeout_s`, waits indefinitely. `on_timeout` (legal only with a timeout): `skip` continues past the gate (default); `end` ends the whole scene as `ended_by_gate_timeout`. Events are edge-triggered — only gates already waiting see them; there is no queue. |
| `set` | `set: {var: <name>, value: <literal-or-var-name>}` | Set a declared variable. A string value naming another declared variable copies it; anything else is the literal. No arithmetic/expressions in v1 (a real ceiling, noted in code). |
| `if` | `if: {var, equals, then: [...], else: [...]?}` | Branch on literal equality with the variable (`true` ≠ `1`). |
| `loop` | `loop: {count: <int> \| while_var: <name>, body: [...]}` | Repeat the body a fixed count, or while a **bool** variable is true (checked before each iteration — a parallel track can clear it). A `while_var` iteration that consumes no time while the variable stays true is a runtime error, not a hang. |
| `parallel` | `parallel: {tracks: [[...], [...]]}` | Run every track concurrently; completes when **all** tracks finish. Interleaving is deterministic: steps execute in timestamp order, ties broken by track declaration order. |
| `event` | `event: {emit: <name>}` | Emit an outbound named event: recorded on the runner's emitted-events log and passed to its `on_event` callback. |

Every variable referenced by `set`/`if`/`loop` must be declared under
`variables:`; clip names and pose targets are validated against the
loaded character at load time.

### Execution v2 — the scripting constructs (shipped)

The v2 layer is the show-control scripting standard, modeled on FANUC
Teach Pendant logic (IF with rich conditions, SELECT, CALL, WAIT on
I/O, AND/OR/XOR, BG Logic). It is additive within `anima_version:
"2.0"`: three new optional top-level sections (`inputs:`,
`subroutines:`, `monitors:`), three new actions (`wait_until`,
`select`, `call`), one extension to `if:` (`when:`), and one
monitor-only action (`end_scene`). The worked example is
[`examples/patrol_and_greet.scene.anima`](../../../examples/patrol_and_greet.scene.anima).

#### Condition trees

Structured YAML, deliberately **not** string expressions: every node
maps 1:1 onto a canvas node
([`Node_Graph.md`](Node_Graph.md)) and no expression parser exists.
Used by `if: {when}`, `wait_until`, and `monitors`. Nesting is
unlimited.

```yaml
when:
  all:                                  # AND — 1+ operands
    - { input: door_open, op: eq, value: true }
    - any:                              # OR — 1+ operands
        - { var: zone, op: eq, value: 1 }
        - { var: zone, op: ge, value: 2 }
    - not: { var: paused, op: eq, value: true }
  # xor: [<c>, <c>]  — exactly two operands (the FANUC binary XOR)
```

A **leaf** is `{var: <name> | input: <name>, op: eq|ne|lt|le|gt|ge,
value: <literal-or-var-name>}` — exactly one of `var`/`input` (the
namespaces stay explicit; `var:` never falls through to an input).
`value` follows `set:` discipline: a string naming a declared variable
copies it at evaluation time, anything else is the literal. Typing:
`eq`/`ne` compare **same-kind** values only — numbers compare
numerically (`1 == 1.0`), `true != 1` per the v1 discipline, and
mismatched kinds are simply unequal; the ordering operators require
numbers on **both** sides — anything else is a typed runtime error
naming the leaf's path.

#### `if:` with `when:`

`if:` takes exactly one guard: the v1 `var`+`equals` literal form
(unchanged) or `when: <condition-tree>`:

```yaml
- if:
    when: { all: [ { var: mood, op: eq, value: happy },
                   { input: battery_pct, op: ge, value: 20 } ] }
    then: [ { clip: wave } ]
    else: [ { event: { emit: too_tired } } ]
```

#### `select:` — multi-way branch (FANUC SELECT)

```yaml
- select:
    var: mode
    cases:
      - equals: "wave"
        then: [ { call: wave } ]
      - equals: "pick"
        then: [ { clip: pick } ]
    default:                    # optional; no match + no default = skip
      - wait: { seconds: 1.0 }
```

The **first** case whose literal equals the variable runs (document
order, same equality discipline as `if`, no fallthrough). Duplicate
case literals are load errors (`1` and `1.0` are duplicates; `true`
and `1` are distinct).

#### `call:` + `subroutines:` (FANUC CALL)

```yaml
subroutines:
  wave:                         # may contain anything a sequence may,
    - loop:                     # including call
        count: 2
        body: [ { pose: { wrist_roll.rotation: 45.0 }, duration_s: 0.25 },
                { pose: { wrist_roll.rotation: -45.0 }, duration_s: 0.25 } ]

sequence:
  - call: wave                  # runs the body, then resumes here
```

Subroutines share the scene's variable scope (registers are global on
a Teach Pendant too). Recursion — direct or indirect — is rejected at
load with the cycle named (`recursive subroutine call: a -> b -> a`).

#### `inputs:` — the DI/RI analog

```yaml
inputs:                         # optional; scalar initial values
  door_open: false
  visitor_zone: 0
```

Inputs are externally driven and **read-only to the scene** — a
namespace distinct from `variables:` (`set:` targeting an input is a
load error). The host drives them with `runner.set_input(name, value)`
(unknown name = typed runtime error); a change takes effect at the
**next tick boundary** for determinism. Conditions read them with the
explicit `input:` leaf key.

#### `wait_until:` — condition gate (FANUC WAIT)

```yaml
- wait_until:
    when: { all: [ { input: door_open, op: eq, value: true },
                   { input: visitor_zone, op: ge, value: 1 } ] }
    timeout_s: 6.0              # optional; on_timeout: skip (default) | end
    on_timeout: skip
```

**Level-triggered**, unlike `wait_for`'s edge-triggered events: the
condition is sampled the moment the action starts and then at every
tick; the gate passes at the first sample where it holds (already
true = never waits). A deadline that passed before the condition was
first observed true wins; a deadline tied with a true sample loses.
`on_timeout: end` ends the scene as `ended_by_gate_timeout`, exactly
like `wait_for`.

#### `monitors:` — background interlocks (FANUC BG Logic)

```yaml
monitors:
  - name: estop
    when: { input: estop, op: eq, value: true }
    do:
      - event: { emit: estop_tripped }
      - end_scene: { result: "estop" }
```

Scanned **every tick**, in declaration order, **before** the main
sequence — regardless of what the main sequence is doing.
**Edge-triggered**: a monitor fires when its condition transitions
false → true (a condition already true at the first tick fires; the
prior state starts false) and re-arms after the condition goes false.
Monitor bodies are restricted to instantaneous interlock actions —
`set:`, `event: {emit}`, and `end_scene: {result: <string>}` — any
motion/timing/flow action is a load error (background logic is a PLC,
not a second choreography track). `end_scene` — legal **only** inside
monitors — e-stops the adapter (all motion stops) and finishes the
run with the given result string (`runner.result == "estop"`).
Monitors never keep a finished scene alive.

#### Why there is no JMP/LBL

FANUC TP programs jump (`JMP`/`LBL`); Anima scenes deliberately do
not, and the draft `goto`/`label` actions stay rejected. Structured
programs only: `select` + `call` + the two loop forms replace every
legitimate jump pattern, and the node canvas requires reducible
control flow (see `Node_Graph.md` — arbitrary jump edges cannot
round-trip through a structured graph). This is a permanent design
decision, not a deferral.

### Deferred past v1 (spec'd below, rejected loudly)

`speak`, `expression`, `blend_shapes`, `lights`, `ai_response`, and
`goto`/`label` parse as typed errors naming the action — a scene using
them refuses to load rather than playing back incompletely
(`goto`/`label` are not deferred but permanently rejected; see "Why
there is no JMP/LBL" above). The 1.0
draft's `meta:` block is superseded by `identity:`, its scalar
`wait: 1.5` form by `wait: {seconds: 1.5}`, and its
`character: {file: ...}` mapping by the plain `character:` path.
`wait_for`'s draft condition-expression triggers
(`user_speech_contains`, ...) are deferred with the JaegerOS bus
integration; `wait_for` gates are plain named events, and the shipped
structured replacement for condition waits is v2's `wait_until` over
variables/inputs (the bus adapter's job stays translating topics into
posted events and `set_input` calls).

### Execution model (shipped)

`aether_animation.scene.SceneRunner` executes a loaded scene against a
character rig and any `OutputAdapter` (simulator, UDP, serial — the
adapter seam is proven adapter-agnostic):

```
load_scene_file(path)        -> (Scene, Rig)   # resolves character:
SceneRunner(scene, rig, adapter, frame_interval_ms=33, on_event=None)
runner.advance(now_s)        # tick: apply pending inputs, scan the
                             # monitors, execute due actions at exact
                             # timestamps, evaluate the pose, send one
                             # frame; returns None or the result
runner.post_event(name)      # deliver a gate event, between ticks
runner.set_input(name, val)  # drive a declared input, between ticks;
                             # effective at the next tick boundary
runner.stop()                # e-stop the adapter, result = stopped
runner.result                # finished | ended_by_gate_timeout |
                             # stopped | a monitor's end_scene string
runner.emitted_events        # ((name, time_s), ...) outbound log
runner.variables / .inputs   # observability snapshots
```

There is no wall clock and no threads: the caller drives scene-local
time with monotonic `advance(now_s)` ticks (the same explicit-time
discipline as the device simulator), so execution is deterministic and
testable to exact frame values. Each tick merges the active motion
sources (later-started wins a contested target while both are active;
finished motion settles and holds), recomputes relation-driven DOF,
and projects through `rig.project_channels` — a mapped DOF outside its
limits refuses to arm per the kinematics contract. The scene finishes
when the root sequence and every background (`wait: false`) clip have
run to completion. The runner never opens or closes the adapter;
channel configs are hardware detail owned by the caller.

---

## Draft 1.0 — full show-control vision (unshipped sections)

Everything below is the original planning draft, kept for the action
types v1 defers. Where it conflicts with the v1 subset above (header
blocks, `wait` shapes, condition expressions), the v1 form is the
shipped truth.

### File structure overview (draft)

```yaml
anima_version: "1.0"
type: scene

meta:        # superseded by identity: in v1
character:   # a mapping in the draft; a plain relative path in v1
sequence:    # the ordered list of actions
```

### Meta block (draft — superseded by `identity:`)

```yaml
meta:
  name: "greeting_wave"
  description: "JP01 greets a visitor and waves"
  author: "Jenkins Robotics"
  version: "1.0.0"
  duration_hint_s: 5.0      # approximate, for planning
  interruptible: true        # can JaegerAI cancel mid-scene?
  tags: [greeting, wave, social]
```

### Character reference (draft — a plain path in v1)

```yaml
character:
  file: "jp01.character.anima"   # relative path or library name
  # override specific settings for this scene only
  overrides:
    voice:
      default_speed: 1.05
```

### `speak` — Text to Speech (deferred)

```yaml
- speak: "Hello! I'm JP01. Nice to meet you."
  expression: happy           # set expression while speaking
  voice: af_heart             # override default voice
  wait_for_completion: true   # default true — next action waits
```

Internally: publishes `/act/speech` and waits for `/sense/spoken` acknowledgement before proceeding (unless `wait_for_completion: false`).

### `expression` — Set Expression State (deferred)

```yaml
- expression: curious
  blend_time_s: 0.4           # transition duration (default 0.3)
```

### `blend_shapes` — Set Blend Shape Values Directly (deferred)

```yaml
- blend_shapes:
    mouthSmileLeft: 0.8
    mouthSmileRight: 0.8
    cheekSquintLeft: 0.4
    blend_time_s: 0.3
```

### `lights` — LED State (deferred)

```yaml
- lights:
    pattern: pulse
    color: [255, 200, 50]     # RGB
    brightness: 0.9
    speed: 0.8
```

### `wait_for` condition triggers (deferred beyond named events)

| Event | Fires when |
|-------|-----------|
| `user_speech_start` | `/sense/user_speech_start` published |
| `user_speech_end` | `/sense/user_speech_end` published |
| `user_speech_contains: "keyword"` | transcript contains keyword |
| `animation_complete` | current clip or parallel block finishes |
| `time: 5.0` | 5 seconds elapsed since scene start |
| `topic: /sense/my_topic` | any message on this topic |
| `expression_reached: happy` | expression transition completes |

Draft condition expressions for `if` (v1 branches on
`var`/`equals` literals only):

```yaml
condition: user_speech_contains("keyword")
condition: expression_is("happy")
condition: topic_received("/sense/motion_arrived")
condition: variable_equals(name="mood", value="excited")
condition: elapsed_s_greater_than(30.0)
condition: and:
  - user_speech_contains("yes")
  - not: expression_is("sad")
condition: or:
  - user_speech_contains("goodbye")
  - user_speech_contains("bye")
```

Draft `parallel` also offered `wait_for: all | first | speak`
completion modes; v1 ships `all` semantics only.

### `goto` — Jump to Labeled Step (deferred)

```yaml
- label: ask_again
- speak: "Would you like to hear more?"
- wait_for: user_speech_start
- if:
    condition: user_speech_contains("yes")
    then:
      - speak: "Great! Here's more..."
    else:
      - goto: ask_again
```

### `ai_response` — Hand Off to JaegerAI (deferred)

```yaml
- ai_response:
    prompt_hint: "The visitor just said hello. Respond warmly."
    max_turns: 3          # number of conversation turns before returning to scene
    on_complete: continue # "continue" | "end_scene"
```

This suspends the scene and lets JaegerAI handle conversation. When `max_turns` is reached or JaegerAI signals completion, the scene resumes.

### Draft example — interactive conversation with logic gates

```yaml
anima_version: "1.0"
type: scene

meta:
  name: meet_and_greet
  interruptible: true

character:
  file: jp01.character.anima

sequence:
  - expression: curious
  - speak: "Hello! I'm JP01. What's your name?"

  - wait_for: user_speech_end
    timeout_s: 15.0
    timeout_action: continue

  - expression: happy
  - speak: "Wonderful! It's great to meet you."

  - parallel:
      - lights:
          pattern: pulse
          color: [255, 200, 50]
          speed: 0.8
      - clip: nod
    wait_for: all

  - speak: "Would you like to see what I can do?"

  - wait_for: user_speech_end
    timeout_s: 10.0

  - if:
      condition: or:
        - user_speech_contains("yes")
        - user_speech_contains("sure")
        - user_speech_contains("okay")
      then:
        - expression: excited
        - speak: "Excellent! Watch this."
        - clip: wave
        - wait: 0.5
        - speak: "I can also walk, navigate, and help with tasks."
      else:
        - expression: neutral
        - speak: "No worries! Let me know if you need anything."

  - wait: 1.0
  - expression: neutral
    blend_time_s: 0.5
  - lights:
      pattern: solid
      color: [200, 200, 200]
      brightness: 0.7
```

### Draft execution model (JaegerOS runtime)

When the Anima Runtime receives an `AnimationCommand` with a scene file:

```
1. Load scene file and validate
2. Load referenced character file (or use already-loaded character)
3. Start JaegerOS action (goal accepted)
4. Walk sequence top to bottom:
   - Execute each action
   - Publish feedback after each step
   - Evaluate conditions and branches
   - Handle wait_for by subscribing to bus topics
   - Handle parallel by spawning concurrent coroutines
5. On completion: publish AnimationResult(success=True)
6. On cancel: blend out, return to idle, publish result
7. On error: publish AnimationResult(success=False, reason=...)
```

Steps 1–4 exist today in `aether_animation/scene.py` with `post_event` as
the gate surface; the JaegerOS action/bus wrapping (feedback topics,
cancel-with-blend-out, `AnimationResult`) is the deferred integration
layer.

### Variable scope

Variables set with `set` are scoped to the current scene execution.
They reset when the scene ends. JaegerAI will also read and write
scene variables through the tool interface during `ai_response` blocks
(deferred).

### Logic gate evaluation (draft — JaegerOS bus)

`wait_for` events resolve by subscribing to JaegerOS bus topics:

```
wait_for: user_speech_start
    → subscribe to /sense/user_speech_start
    → suspend execution
    → resume when topic received or timeout fires

wait_for: user_speech_contains("goodbye")
    → subscribe to /sense/transcript
    → check each transcript for keyword
    → resume when match found or timeout fires
```

All wait conditions are event-driven — no polling. The shipped v1
equivalent is `SceneRunner.post_event(name)`: the bus adapter's job is
translating topics into posted events.

---

## Related Docs

- [`Character_Format.md`](Character_Format.md) — character file spec (the 2.0 mechanism rig v1 scenes drive)
- [`Bottango_Parity.md`](Bottango_Parity.md) — B10 offline playback milestone
- [[01_JaegerOS/Communication_Semantics]] — JaegerOS action semantics (deferred integration)
- [[01_JaegerOS/Wire_Contract]] — bus topics used by draft scene execution
