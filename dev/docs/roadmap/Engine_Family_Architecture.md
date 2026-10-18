# Engine Family Architecture (decision record)

Decided with Jonathan, 2026-08-01. This is the standing strategy every
agent plans against.

## The family: the Aether ecosystem

**Aether** is the shared family name; **Aether Core** is the universal,
headless deterministic engine at its center — mathematical kernel, parametric
B-Rep DAG, geometric/assembly constraint solving, and shared state evaluation.
Modules baked into the engine carry the Aether prefix (AetherScene,
AetherViewport, AetherKernel); product-branded names (Anima*) stay in
their products and are renamed into the Aether identity when extracted.
The three projects temporarily co-locate in this repo as sibling root
folders and later split into their own repos:

- `aether-core/` — Aether Core, the engine (product-free)
- `aether-animation/` — Aether Animation, the animatronics/animation product
- `Aether CAD/` — Aether CAD, the CAD authoring product (started 2026-08-01)

Later products (simulation, show control) sit on the same Aether engine. The
folders are scaffolds today; existing code (`aether_animation/`, `app/`)
migrates as the split solidifies rather than in one disruptive move.

## Layering

| Layer | Strategy | Today |
|---|---|---|
| Kernel (B-Rep math) | **Adopt, integrate, and distribute**: Aether Core owns the supported Open CASCADE build plus its stable WebAssembly/C++ seam, topology/tolerance policy, and STEP/IGES I/O | `app/Sources/AnimaCADShim` + `Aether CAD/` proof today |
| Aether / parametric state | **Build & own**: deterministic feature DAG, migrations, rebuild diagnostics, stable IDs, 2D constraints, 3D mates, DOF, kinematics, and evaluation | split across `Aether CAD/` and `aether_animation/` today |
| Aether / AetherScene | **Build & own**: the one 3D world — entities with a single stable ID space (part instances, connectors, mates), transforms, selection, interaction ops | being built inside Anima Studio |
| Aether / render contracts | **Build & own**: one entity stream consumed by Metal and WebGPU; GPU pick contract | `app/Sources/AnimaCADViewport` |
| Products | Thin front-ends over Aether | `app/` today |

Product responsibilities are explicit:

- **Aether CAD** — web-native parametric solid modeling, 2D constrained
  sketches, mechanical assemblies/topological features, and STEP/IGES export.
- **Aether Animation** — motion authoring, real-time puppetry, avatar/MoCap
  mapping, animatronics, show control, and routing trajectories to hardware
  buses.

Aether Core has no UI and no raw hardware drivers. It may compute deterministic
geometry, poses, and trajectories; products own presentation and I/O.

Renderer commitments: **OCCT and WebGPU stay** (with Metal as the native
co-primary). RealityKit is retired from CAD paths.

## Why AetherScene is the linchpin

Consistent progress on "place, interact, control, edit" stalled because
the 3D world existed as five hand-stitched partial copies (local rig vs
engine parts, rest vs resolved transforms, partID vs URL vs name keys,
per-renderer projections, per-feature join paths). Every regression of
the 2026-07-31 recovery week was one of those joins diverging. AetherScene
replaces the joins with one world model; renderers become "draw entities,
answer picks"; interactions become "read scene, write scene."

## The extraction discipline

Aether is extracted from working products, never designed in a vacuum:

1. Build capabilities inside the product that needs them.
2. When a second product needs one, move it to Aether unchanged-in-meaning.
3. A capability no product needs today does not enter Aether.

## Non-negotiables carried forward

- AnimaCore remains the single canonical owner of animation/mate meaning.
- Viewport elements are real 3D geometry (CONVENTIONS.md).
- Picking is a GPU task.
- Dedicated files per subsystem, with behavior-pinning tests.
