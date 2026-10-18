## Local repository structure — 2026-10-09

Use this repository for platform work and the sibling app repositories for product
work. See LOCAL_DEVELOPMENT.md and AGENTS.md. The original monorepo paths below
are historical context; semantic ownership rules remain applicable.

# Conventions

## Current suite direction — 2026-09-08

**Shared sketch foundation — 2026-09-29 (Jonathan).** `core/sketch/`
(`@aether/sketch`) is the explicitly authorized cross-product exception for
unit-neutral 2D drawing geometry and gestures. Sketch and Map consume its tools;
CAD currently consumes picking and SVG arc presentation helpers. It imports no
product, UI, renderer, DOM or solver. Develop common behavior there and exercise
it in Aether Sketch; keep CAD constraints/exact entities, Map projection and
product persistence in their owning products. This does not authorize consumers
of CAD's parked `@aether/core` outside CAD. See
`dev/docs/roadmap/Aether_Sketch_Standard.md` for current coverage and planned work.


Aether Studio is the umbrella suite; the animation product is **Aether Animation**.
The primary applications are web-based React/TypeScript: `Aether CAD/` and
`aether-animation/web/`, sharing `core/ui/`. The independent host and admin workspace now live in `core/host/` and `studio/`;
community plugin distribution remains planned. See
`dev/docs/roadmap/Aether_Studio_Suite.md`. The Onshape mockup is an interaction
reference, not the production CAD engine. Codex owns web GUI and cross-lane review;
Claude owns the Python backend/protocol. Older Swift lane/path instructions below
are historical and superseded: Swift is archived at `aether-animation/archive/`.
The `core/` parent groups shared infrastructure: `core/ui/` is `@aether/ui`,
the design system, and `core/assets/` holds shared artwork. The CAD engine
(`@aether/core`) moved to `Aether CAD/aether-engine/` (2026-09-11, renamed 2026-09-12) — a product owns
its kernel binding, solver and feature layer; only one product used it. The
server (accounts, sessions, documents) is `core/host/` + `core/session/`.
Existing semantic ownership and file-claim rules still apply.


The operating checklist for this repo. Inherited from the Jaeger
ecosystem's rules, trimmed to what Anima Studio actually uses.

## The two laws

1. **Modularize CONTRACTS early; modularize IMPLEMENTATIONS late.**
   One copy of every truth — format fields, wire commands, DOF
   semantics, dependency direction — from day one. A
   two-copies-of-one-truth bug is the worst kind: both copies look
   right in isolation. Don't split a boundary into a separate package
   or frozen interface until a *second real consumer* exists.
   **Units are part of the contract:** every contract field is SI with
   a unit-suffixed name (`_s`/`_ms`/`_m`/`_rad`/`_deg`/`_hz`; Swift
   spells them out: `timeSeconds`, `angleRadians`) — no bare numeric
   field ships without one.

2. **The nervous-system rule.** Lower layers never wait on higher
   ones; higher layers cannot bypass lower safety. Concretely here:
   AnimaCore's model/evaluation modules and the Swift model/evaluation targets
   never import UI or AI layers;
   hardware adapters consume evaluated targets and never reach into
   authoring state; firmware failsafes cannot be disabled from above.

3. **One file, one subsystem.** Every file owns one clearly named
   job; group related files in a module directory (the pattern:
   `Aether CAD/src/sketch/` — twelve focused files, not one editor
   blob). A file that accumulates a second subsystem, or grows past
   the point a human can read and edit it confidently (~500 lines is
   the smell threshold, not a hard cap), gets split — behind
   behavior-pinning tests, before new features land in it. God files
   block concurrent team work: two agents cannot safely edit one
   2,000-line file.

4. **Three tool surfaces.** Every tool launches from exactly one of:
   the left sidebar, the right sidebar, or the top ribbon — all tool
   icons live on those three surfaces. Floating editor windows are
   ribbon-launched tools; properties-style inspectors are right-sidebar
   tools. The window header carries only app chrome (settings, account,
   theme, layout/window menus) — never modeling tools, and never a
   duplicate launcher for a tool that already has a surface.

## Where things live

- **`aether_animation/` (Python) — AnimaCore, the engine** — the headless
  animation core: `.anima` loading, rig/DOF evaluation, relations,
  scene execution, wire protocol host, simulator, extensions.
  Mechanism-agnostic: domain vocabulary (faces, cars, arms) appears
  only in `examples/` data, never in core types. Cross-platform; the
  app and firmware author for it.
- **`app/` (Swift)** — the macOS
  authoring app. Package ownership table and boundaries live in
  `AGENTS.md`.
- **`firmware/`** — the open microcontroller firmware speaking
  `dev/docs/roadmap/Wire_Protocol.md`.
## AnimaCore is the one engine (canonical)

`aether_animation/` is the **single canonical implementation** of animation
meaning: typed mates/DOF/limits/relations, validation, keyframe and
scene evaluation, mate alignment + kinematic pose resolution, `.anima`
parsing/writing, output mapping, transport, hardware safety, and
node-graph compilation. There is **no second engine.** The Swift app is
a **front end** that speaks the Studio↔AnimaCore protocol
(`dev/docs/roadmap/Studio_Bridge.md`) to a bundled AnimaCore helper; it
owns presentation, editing, rendering, and `.animastudio` editor
metadata, and holds DTOs that mirror engine results — it never
independently defines what a rig, pose, or frame means. The Swift
`AnimaEvaluation`/`RigPoseResolver` logic is transitional and is being
*replaced* by bridge calls, not extended. (Superseded the earlier
"parallel Swift/Python implementations with fixture parity" policy,
2026-07-15 — parity of two engines invited drift; one engine removes
the failure mode entirely.)

## Versioning & contract changes

- A **contract change** (a format field's meaning, a wire command, DOF
  semantics) is announced in the active briefing before editing both
  producer and consumer — see `AGENTS.md` → Cross-agent communication.
- Inside this repo's own boundary, delete-freely applies — no
  back-compat shims for internal refactors (pre-1.0; revisit when the
  format has external consumers).

## No spec ahead of code

A doc never describes behavior the code doesn't implement yet. If it's
designed but not built, label it **`(planned)`** inline — planned
behavior lives in `dev/docs/roadmap/`, shipped truth in
`dev/docs/reality/STATUS.md`. A doc describing a phantom feature costs
someone a debugging session before they find out it was fiction.

## STATUS stays truthful

Any commit that changes behavior updates `dev/docs/reality/STATUS.md`
in the **same commit**. STATUS.md is the one place a new contributor
(human or agent) reads to get current truth without archaeology.
Stale STATUS.md is a bug.

## Walk the flow before shipping

Inspection is not verification. Before shipping a user-facing flow
change, run it start to finish as the operator would — launch the app,
click the flow, watch the servo move. Don't ship on "the code looks
right."

## Viewport elements are real 3D geometry

Anything the operator sees inside the 3D viewport — connector triads,
gizmos, snap indicators, reference frames — is world-space geometry
rendered by the engine and carried by the transforms of what it
annotates. Screen-space decals that imitate 3D (fixed-direction axis
icons, fake isometric triads) are forbidden; a 2D overlay may carry
only flat chrome such as labels and rings (per Jonathan, 2026-08-01,
after a screen-space connector triad shipped unflagged). If a
screen-space shortcut is ever unavoidable, it must be surfaced to the
operator as a compromise, never silently shipped.
