# Community extensions (E1 + E2 backend shipped; later packets planned)

> The open ecosystem layer (Jonathan, 2026-07-15): users expand Anima
> Studio the way Onshape users build
> [custom features](https://www.onshape.com/en/features/custom-features)
> and the way JaegerOS consumes modules — self-contained packages,
> everything packed in one bundle, with declared access to the layers
> they extend. This app is open source; the extension surface is how
> the community makes it theirs.

## The package: one bundle, everything in it

An extension is **one directory** (zip-distributable) named
`<slug>.animaext/`, with a single manifest describing everything it
contributes — the JaegerOS `module.yaml` spirit:

```yaml
# extension.yaml — the one copy of this extension's truth
anima_extension: "1.0"          # manifest schema version
id: "udp-wire-output"           # unique slug
name: "UDP Wire Output"
version: "0.1.0"
author: "…"
license: "Apache-2.0"
description: "Streams Anima Wire Protocol frames over UDP."
compatibility:
  anima_format: "2.0"           # .anima format major it understands
requires: []                    # other extension ids (rarely; keep flat)
capabilities: [network]         # declared access: hardware | network | filesystem
provides:
  - kind: output_adapter        # the extension point (see table)
    id: "udp_wire"
    entry: "adapter.py:UdpWireOutput"
    config:                     # optional; passed as constructor kwargs
      host: "127.0.0.1"
      port: 9600
assets: []                      # bundled files (models, curves, docs)
```

Rules: the manifest is closed-schema (unknown fields rejected, typed
errors naming paths — same loader discipline as `.anima` files). All
code/assets live inside the bundle; an extension never reaches into
another extension or the app's internals beyond its extension point's
API. `capabilities` is surfaced to the user at install time.

Shipped manifest semantics (E1, `aether_animation/extensions.py`):
`id` and `provides[].id` are lowercase slugs (`[a-z0-9_-]`); an
`output_adapter` entry must be `"<module>.py:<ClassName>"` and is
imported from inside the bundle under an extension-namespaced module
name (no `sys.path` pollution), then checked against the
`aether_animation.outputs.OutputAdapter` protocol; the optional per-
contribution `config:` mapping (identifier keys) passes through as the
adapter's constructor keyword arguments; contribution ids are unique
per kind across the whole registry (v1 keeps one flat namespace per
extension point). The other known kinds parse but raise "not yet
supported" when loaded (except `parametric_feature`, loadable since
E2 — see below); unknown kinds are manifest errors.

Shipped `parametric_feature` semantics (E2 backend,
`aether_animation/features.py`): the contribution's `entry` is a
**YAML template file** inside the bundle (must end `.yaml`/`.yml`,
takes no `config:` — pure data, no Python ever runs, which is why the
example bundle declares `capabilities: []`). The template
(`anima_feature: "1.0"`, closed schema, typed pathed errors) declares
`name`, `description`, a `parameters:` list — each with `name`
(identifier), `kind` (`float|int|bool|choice`), required explicit
`unit` for floats (`deg|m|mm|ratio|count`, a form-display hint only:
values substitute verbatim, templates convert in expressions),
`default`, optional `min`/`max`, `choices` for choice kind, optional
`description` — and a `body:` of `parts:`/`joints:`/`relations:`/
`parameters:` in the exact shapes the character loader accepts, plus
two template-only constructs: `${expr}` substitution in scalar values
and mapping keys (a safe recursive-descent evaluator over numbers,
parameter/loop names, `+ - * /`, unary minus, parentheses — no
`eval`, no functions in v1; unknown names and division by zero are
typed errors) and `repeat:` blocks (`{count: <int-or-${expr}>, var:
i, body: ...}`, 0-based, nestable; a bool count makes an optional
block). `expand_feature(template, instance_name, parameter_values,
parent_part)` validates supplied values against the declared
parameters (defaults for unsupplied), prefixes every emitted
part/joint/relation-target/rig-parameter name with
`<instance_name>_` so instances coexist, rewrites internal
references to match, and resolves the reserved `$parent` part
reference to `parent_part` (default: unattached root part; `$parent`
inside a joint requires an attachment). `merge_fragment(character,
fragment)` inserts the fragment into a loaded character mapping with
collision errors; the merged document is then re-parsed by the
standard loader — expansion never bypasses loader validation
(composition rule: features emit standard primitives only).
**For E3 Studio rendering (Codex):**
`registry.load_parametric_feature(id)` returns the validated
`FeatureTemplate`; its `parameters` tuple (name/kind/unit/min/max/
choices/default/description) is the insertion-form model; the flow is
form values → `expand_feature` (instance name + optional attach part
picked in the UI) → `merge_fragment` → reload through the loader.
Example: `examples/extensions/parametric-linkage.animaext/`.

## Extension points — access to all the layers

| Kind | Layer | What it contributes | Trust model |
|---|---|---|---|
| `output_adapter` | Python runtime | A device/protocol backend consuming evaluated channel frames (DMX, OSC, UDP, vendor servo buses…) | Python code — installing = trusting, capabilities declared |
| `parametric_feature` | Format/Studio | A declarative template producing standard parts/joints/relations from parameters (a "custom feature" in the Onshape sense: a gripper, a Stewart platform, an N-link arm) | Pure data (YAML) — safe by construction |
| `scene_action` | Python runtime | A custom `.scene.anima` action/trigger (after scene execution ships) | Python code |
| `motor_backend` | Firmware | A C++ servo/motor signal backend compiled into the firmware build | Source, compiled by the user |
| `studio_panel` | Swift app | **Explicitly not planned for v1** — native plugin loading needs sandboxing/signing answers we don't have; declarative features cover the near-term need |

The composition rule (same as Onshape's): extensions **compose the
core primitives**, they don't add new kernel types. A parametric
feature emits standard mates and relations; an output adapter consumes
the standard evaluated-channel frame. Core contracts stay small.

## Discovery & install

- Install = drop the bundle in a scanned directory: user-level
  (`~/Library/Application Support/AnimaStudio/Extensions/`) or
  project-local (`<project>/extensions/`, shipping with the project).
- The runtime scans for `*.animaext/extension.yaml`, validates, and
  registers contributions; conflicts (duplicate `id`) are load errors.
  No pip requirement — everything packed in. Shipped as
  `extensions.discover_extensions(search_dirs)`: no default paths are
  baked in — callers pass the directories (Studio will pass the two
  conventional ones above). A `*.animaext` entry that is not a valid
  bundle fails loudly with a typed error, never silently skips.
- Distribution starts as git repos + zips; a community index
  (registry repo + site gallery) is a later packet, not a launch
  requirement.

## Packet sequencing

| # | Packet | Depends on | Lane |
|---|---|---|---|
| E1 | Manifest schema + discovery/registry + `output_adapter` point + built-in simulator adapter behind the same API + one real packaged example extension — **shipped 2026-07-15** (`aether_animation/extensions.py`, `aether_animation/outputs.py`, `examples/extensions/udp-wire-output.animaext/`; see STATUS.md) | — | Claude (Python) |
| E2 | `parametric_feature`: declarative template schema (params → parts/joints/relations), loader + expansion into the standard rig — **backend shipped 2026-07-15** (`aether_animation/features.py`, `examples/extensions/parametric-linkage.animaext/`; Studio rendering remains with E3) | format 2.0 | Claude format/runtime; Codex Studio rendering |
| E3 | Studio: Extensions browser (installed list, capabilities display, enable/disable), parametric features appearing in the Rig ribbon like built-ins | E1/E2 | Codex |
| E4 | `scene_action` point | `.scene.anima` execution | Claude |
| E5 | Firmware `motor_backend` build hooks | firmware v0 | Claude |
| E6 | Community registry + site gallery | E1–E3 proven | shared |

First real consumer rule (CONVENTIONS law 1): E1 ships with the
simulator rewired through the same adapter API plus one genuine
example extension — the extension point is proven by two consumers on
day one, or it doesn't merge. **Satisfied:** `outputs.SimulatorOutput`
wraps (never reimplements) `sim.SimulatedDevice` behind the
`OutputAdapter` protocol, and the packaged `udp-wire-output` example
is the second consumer, loaded from its real bundle in tests.
