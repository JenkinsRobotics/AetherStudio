# UI framework decision record

Decided with Jonathan, 2026-08-01 (proposed by the CAD lane, reviewed and
accepted by the engine lane).

## Decision

The Aether product family standardizes on **React + TypeScript + Vite** for
application UI, with shared widgets in the root **`core/ui/`** package.
Server rendering (Next.js) is rejected — local WebGPU editors gain nothing
from it.

## The three UI tiers

1. **The product engine (`Aether CAD/aether-engine/`) — no UI, ever.** In-world tools (gizmos, triads, snap
   nodes) are engine-drawn 3D geometry, not UI; their line lists live at the
   engine layer and renderers only upload them.
2. **`core/ui/` — the shared design system.** Framework-neutral **design
   tokens as CSS custom properties** (JSON source of truth, so a future
   Swift or other native shell can consume the same theme), plus **one React
   widget per file**, importable like a class. A widget lives here only when
   it is product-free: it takes data and emits events; it never names a
   product concept or calls an engine verb.
3. **Each app — compositions and workflows.** Screens, dialogs' contents,
   engine calls, workspace layouts. Apps compose `aether-ui` widgets.

## Binding invariants

- React owns chrome only. It never owns CAD/animation meaning, never
  duplicates geometry or mate state. Stores hold UI state (panel layout,
  tool mode, selection IDs, document references); the engine remains the
  state authority ("read scene, write scene").
- The viewport is a persistent imperative Three.js/WebGPU object mounted
  once inside a React component (`ViewportCanvas`); React never re-renders
  through it.
- OCCT stays isolated in its worker behind the `aether-core.ts` facade.
- Docking/layout uses an established library (e.g. dockview) rather than a
  hand-rolled system.
- Migration of Aether CAD is strangler-style, view by view, with behavior
  pins — the app must never have a broken week.
- The token JSON is the single theming source; widget CSS consumes only
  token variables.

## Baseline

The visual baseline is Aether CAD's current `src/style.css` — its palette,
radii, and type scale were extracted into `core/ui/tokens/` so the design
system's default theme IS the CAD app's existing look.


## Visual authority update — 2026-09-08

Jonathan selected the old native Anima Studio interface as the suite baseline.
Its StudioDesignProfile is ported through `core/ui/tokens/`; CAD and Animation
consume shared widgets and WorkspaceShell. Product tool sets and arrangements
may differ, but product styles must not fork shared control or ViewCube skins.
See `Aether_Studio_UI_Convergence.md` for implementation and parity/retirement gates.
