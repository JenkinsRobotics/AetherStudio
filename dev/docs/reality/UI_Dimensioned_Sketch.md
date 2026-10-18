# Dimensioned sketch annotation standard

2026-10-13 — Aether UI development gallery and reusable DimensionedSketch.

The supplied reference is filed under Widgets → Aether CAD → Dimensioned sketches
and App collections → Aether CAD. Open
`http://127.0.0.1:5198/#tab=widgets&section=showcase-dimensioned-sketches&collection=app-cad`.

## Presentation

Keep the profile prominent on a fine graph-paper grid. Construction geometry uses
violet dashed lines, vertices and constraint markers use green, and dimensions use
extension lines, arrowheads and monospaced values. A named reference sits directly
below its value. Selected annotations highlight their associated geometry. The
red accent in this reference identifies emphasized dimensions, not an error or
solver status. Colors adapt to light/dark appearance.

Dimension labels have generous transparent hit areas, focus outlines and accessible
names containing their value and reference. Constraint markers expose descriptive
names instead of relying on their single-letter glyphs. Hidden overlays leave the
keyboard order. At narrow widths, the canvas retains a readable drawing scale in
its own scroll region; the inspector stacks vertically without page overflow.

## Functional sample

Six named inputs drive the illustration: cap radius, blank diameter, working
radius, seat radius, center offset and pitch height. Both working-radius annotations
reference the same value. The tangent horizontal/vertical distances are measured
outputs and remain read-only. Direct circle construction updates the displayed
curves and measurements when a valid edit is applied.

Select geometry, a dimension or a constraint to inspect its relationships. Double-
click a dimension or press Enter to focus editing. Numeric values accept the shared
arithmetic syntax (numbers, parentheses and `+ - * /`). Range, finite-value and
circle-relationship validation reject impossible edits before replacing geometry.
This is a bounded illustration; it is not a general expression graph or solver.

Each dimension has an editable note. Drag its label or use arrow keys to reposition
it; Shift increases the keyboard step. Leaders stay attached to geometry. A pointer
drag commits one history entry and cancellation discards its preview. Restore label
returns to its original position. Undo/redo cover values, notes and label placement;
text fields keep native text undo. Confirmed reset restores the sample and can be
undone. State lasts only while this showcase section is mounted.

Grid, construction, constraints and references have independent display toggles.
Zoom buttons and Fit control the view; drag paper or focus the canvas and use arrows
to pan. Double-click paper restores the initial view. Display changes are separate
from editing history.

## Ownership and component contract

`core/ui/src/DimensionedSketch.tsx` renders host-supplied SVG paths, dimension line
segments, label positions, formatted values, reference strings and constraint
annotations. Selection, label movement, edit requests and viewport changes are
callbacks. The surface uses presentation-space coordinates and knows no CAD units,
document format, network transport or solver. Marker/grid IDs are instance-scoped.
It is available from the package root and `@aether/ui/DimensionedSketch`.

`gallery/dimensioned-sketch-example.ts` is an analytic drawing fixture: internally
tangent working/seat circles, a cap and a blank construction arc. It exists to
exercise the presentation, not to claim ASME compliance, engineering qualification,
production CAD editing or general constraint-solving capability. Those semantics
and validated operations remain in Aether CAD. Studio retains PDM and persistence.

## Verification and adoption

Focused tests cover selection and linked highlighting, keyboard movement and
editing, pointer capture/drag/cancel, unique marker IDs, overlay visibility,
read-only measurements, invalid edits, linked radius updates, notes, undo/redo,
reset and view controls. Browser checks exercise actual label dragging and leaders,
double-click focus, invalid circle combinations, shared values, constraint inspection,
pan/zoom, overlay toggles and light/dark rendering. At 472px content width, the
700px drawing scrolls inside its canvas and the inspector stacks without outer overflow.

All 609 tests across 126 UI files, typecheck and gallery/library builds pass. The
existing gallery chunk-size and unrelated React act warnings remain.

Development gallery only; no consumer package pin, installed assets, CAD document,
native server or deployment is changed.
