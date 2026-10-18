# Aether IO direction

Jonathan requested an electronics product on 2026-10-01: individual PCB design,
component-level assembly/wiring, circuit testing and eventual firmware
execution, using the suite's standard home and three-column workspace.

The first delivery is a local interactive UI draft; shipped coverage and
verification are in `dev/docs/reality/STATUS.md` and `aether-io/README.md`.
No external electronics engine is integrated yet.

Detailed implementation handoff: [Backend development](../../../aether-io/BACKEND_DEVELOPMENT.md).
Seven UI routes now exist, including simulation setup, 3D inspection and
manufacturing preparation. These screens store setup and explain pending
services; they do not imply backend completion.

## Intended sequence — planned, not shipped

1. Establish a versioned electrical document: symbol instances, full pin maps,
   named nets, units, sheets, and separate schematic/board/assembly placement.
   Implement import/export round trips and host document persistence.
2. Choose a reusable circuit solver behind a product-owned boundary, then
   validate DC/transient results against known circuits. Electrical warnings
   must come from real rules/results, not presentation guesses.
3. Add real package footprints, layers, copper routing, net consistency and
   ERC/DRC. Validate fabrication outputs before offering Gerber/drill export.
4. Add a compiler/emulator boundary for explicitly supported MCU targets;
   connect GPIO/peripherals to the same circuit model and measured traces.
5. Extend assembly modules and harness wiring, physical 3D preview, and optional
   suite AI integration. AI suggestions remain editable authoring inputs.

Engine/format/tool choices need evaluation; this UI draft makes no compatibility
or simulation-parity claim. Electronics logic stays in `aether-io`; reusable
presentation/artwork stays in `core/ui` and `core/assets`.

## Interaction references

- User-supplied Flux screenshot: objects and checks at left, schematic in the
  center, agent conversation at right.
- [Flux PCB editor documentation](https://docs.flux.ai/reference/reference-pcb-editor).
- [User-supplied PCBX introduction](https://www.pcbx.com/article/Introducing-PCBX's-New-Tool-Simplifying-PCB-Design-and-Simulation):
  product direction only; this draft does not embed or depend on PCBX.
