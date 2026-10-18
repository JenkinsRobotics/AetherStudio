# Where should Aether CAD's mates be solved?

Measured 2026-09-12 against the installed FreeCAD 1.1.3. Written because an
earlier note in STATUS said "FreeCAD does no mates", which is true of *our
binding* and false of FreeCAD, and the difference decides an architecture.

## What is true today

CAD assembly mates go to **aether_animation**, the animation engine, over
`/{app}/rpc`:

- `aether_animation/mates.py` (674 lines) defines ten typed mates; `kinematics.py`
  (577) solves them by forward kinematics over a tree.
- `aether_workspace.py` advertises `supported_mate_type_ids` and accepts
  **three**: fastened, revolute, prismatic. The rest are refused with
  `unsupported_capability`. This is the deliberate Assembly v1 slice.
- It is real and tested: `test_mates.py` covers every kind's schema,
  `test_bridge_aether_workspace.py` (746 lines) exercises `add_mate`,
  `solve_assembly`, `set_dof_value`. A live call to `/cad/rpc` answers.
- Loops are explicitly not solved: `can_solve_loops: false`.

## What FreeCAD already has, verified headless

FreeCAD 1.1.3 ships an **Assembly** workbench with the Ondsel multibody
solver. It needs no GUI:

```
asm = doc.addObject("Assembly::AssemblyObject", "Assembly")
asm.solve()          # -> 0
```

Verified end to end in `freecadcmd`: two parts, the base grounded, a Fixed
joint between corner vertices. The solver iterated
`33665571 -> 3176 -> 76 -> 0.087 -> 4.8e-08 -> 2.38e-12 -> 0` and moved the
block from `(120, 75, 33)` to `(0, 0, 0)`.

**Thirteen joint types**: Fixed, Revolute, Cylindrical, Slider, Ball,
Distance, Parallel, Perpendicular, Angle, RackPinion, Screw, Gears, Belt.

Note what is in that list and not in ours: Distance, Perpendicular and Angle
as first-class joints, and RackPinion/Screw/Gears/Belt as joints rather than
as the separate "relation" concept aether_animation models. It is a multibody
*dynamics* solver, so loops are its normal case, not an unsupported one.

## The decision

Not mine to make, and it is a real fork.

**Keep aether_animation.** The standing instruction (Codex -> Claude, Assembly
packet) is explicit: "Reuse existing `mate_types`, relation and rig semantics;
do not create CAD-specific semantics." One mate vocabulary serves both
products, a rig authored in CAD carries into Animation unchanged, and the
`.aether` persistence and BOM work already sits there. Cost: CAD inherits an
animation engine's shape — three of ten types exposed, no loop solving, and
every new joint type is engine work we write ourselves.

**Move to FreeCAD.** Thirteen joints and a real multibody solver arrive for
free, in the process we already run, behind the JSON boundary that already
exists — the same argument that made FreeCAD the geometry engine. It also
matches the suite's own tiering: Aether CAD is a product that owns its kernel
binding, and routing CAD assemblies through the animation engine crosses that
line. Cost: two mate vocabularies to keep reconciled, and the Animation
product still needs aether_animation's, so `.aether` persistence would have to map
between them.

**A third option:** FreeCAD solves, aether_animation keeps the vocabulary. The CAD
workspace would translate its three (later more) mate types into FreeCAD
joints, solve there, and store results in the existing `.aether` shape — the
same trick already used for geometry, where Aether owns naming and FreeCAD is
a calculator. This keeps one vocabulary and buys the solver, at the cost of a
translation layer per joint type.

## If the answer is FreeCAD

The work is bounded and looks like the geometry path:
`aether_freecad/assembly.py` alongside `worker.py`, a `solve_assembly` job in
the protocol, joints translated the way features already are, and the same
cross-lane guard that stops a joint type reaching the UI before the engine can
build it.
