# Aether UI flow diagram standard

Implemented in the development gallery on 2026-10-13 at Jonathan's request.
Visual reference: the user-supplied ClassCAD flow-diagram screenshot. The SVG,
layout and animation are authored in Aether UI; no website code or image assets
are embedded. The specimen's Aether labels illustrate routing, not deployed
server architecture or live traffic.

Find it under **Aether UI → Widgets → Categories → Editors → Flow diagrams**,
or **Collections → Flow & signals**. Each selection opens a focused section;
see [UI_Showcase_Collections.md](UI_Showcase_Collections.md). The shared renderer, editor, inspector and document geometry live in
`core/ui/src/FlowDiagram*` and `flow-diagram-model.ts`. The gallery host lives in
`core/ui/gallery/FlowDiagramDemo.tsx`; `flow-diagram-example.ts` supplies the
12-node, 16-connection example.

## Visual language

- Use a quiet dotted canvas, a fine outline and rounded outer corners.
- Route signals along clear horizontal lanes with rounded diagonal transitions.
  Keep parallel terminal lanes at least 13 diagram units apart with the default
  4.4-unit stroke. Surface-colored clearance separates crossing paths.
- Mark source connections with hollow circles. Keep labels above their lanes;
  use small capsule gates for transitions and outlined modules for destinations.
- Give related routes a stable color. Colors resolve through Aether theme tokens;
  labels and the textual description must also communicate their meaning.
- Use small traveling cuts in each line to communicate direction. Avoid flashing,
  glows or moving the whole diagram. Signals follow the same SVG path as the route.
- Use sans-serif labels and monospaced module details. The processor enclosure is
  an optional visual variant, not a required symbol for every destination.

## Composition and motion

`FlowDiagram` accepts caller-owned SVG routes, an accessible title and connection
description, dimensions, a pause flag, playback rate and optional highlighted
route IDs. `FlowDiagramNode` supplies module, gate and processor variants;
`FlowDiagramLabel` supplies theme-aware labels. Compose nodes and labels as SVG
children; nested node children use local coordinates.

All three components and their prop types are exported from `@aether/ui` and the
`@aether/ui/FlowDiagram` subpath. The renderer remains independently usable. `FlowDiagramEditor` adds controlled
diagram editing; product execution and transport remain outside shared UI.

Animation uses CSS stroke-dashoffset without JavaScript frame updates. Durations
are in seconds, with phase offsets to stagger lanes. The demo provides 0.5×, 1×
and 2× playback, pause/resume and five keyboard-accessible signal-family choices.
Focusing a family dims other lines without removing context. An explicit caption
identifies this example as illustrative.

Honor `prefers-reduced-motion`: hide animated cuts and keep the complete static
diagram. Pausing freezes cuts in place. Printed diagrams are static. The editor
offers Fit diagram, 100% and 150% zoom. Fixed zoom uses a named, focusable scroll
region for readable labels; Fit shows the complete drawing. The inspector moves
below the canvas in containers narrower than 1100px. Controls wrap.

## Editing standard

`FlowDiagramEditor` takes a `FlowDocument` through `value` and reports immutable
changes through `onChange`. Optional undo/redo callbacks and availability flags
let a host use its existing history. The host also supplies pause, playback rate,
focused route IDs and optional extra toolbar actions. Exports are available from
`@aether/ui`, `@aether/ui/FlowDiagramEditor` and
`@aether/ui/flow-diagram-model`.

- Nodes have stable IDs, editable labels, detail and notes, position, dimensions,
  color and input/output ports. Drag nodes or set precise inspector coordinates.
- Ports have a stable ID, label, direction, node side and normalized edge position.
  Drag a port around the node, or change side/position in the inspector. Add and
  delete input/output points from the node inspector.
- Connections reference source and target node/port IDs. Their rendered routes
  derive from those references, so moving nodes, resizing them or moving ports
  reanchors the actual animated line. Connect mode joins an output to an input;
  duplicate pairs, self-node links and invalid endpoints are rejected.
- Select a line to edit its label/notes/color/dashes or reconnect either endpoint.
  Add, remove and drag route bends, edit exact bend coordinates, or choose Auto
  route. Routing is a rounded polyline, not obstacle avoidance or layout solving.
- Delete removes incident connections together with a node/port. A drag commits
  one history action on release; Escape or pointer cancellation discards it.
  Snap uses eight diagram units; Shift bypasses it during a drag. Arrow keys move
  a selected node/bend by one unit, Shift by ten; ports move by one/ten percent.
- All nodes, ports and connections are named keyboard targets. Enter/Space select
  or connect; Delete removes the selection. Cmd/Ctrl-Z and Shift-Z invoke history
  outside text fields. Text fields retain native text editing shortcuts.

The gallery supplies an 80-entry undo/redo history, short typing-group coalescing,
and an independent browser draft (`aether-ui-flow-diagram-v1`). Local storage
failure leaves editing available and reports that JSON export is needed. Restore
example and successful import are undoable. Import validates the version, numeric
bounds, IDs, endpoint references/directions and duplicates before replacing the
document; malformed data leaves the current document intact. Limits: 1 MB, 100
nodes, 400 connections, 40 ports per node and 20 bends per connection.

Export opens the complete editable JSON for copying or downloading. Clipboard
failure selects the JSON for a normal system copy. It includes node/connection
notes and authored geometry. Download reports a request, not a claimed saved file.
The gallery document is diagram geometry only: animation illustrates direction;
there is no network execution, hardware output or signal simulation.

## Verification and delivery

Focused model/editor tests cover reanchoring, cascading deletion, validated JSON,
notes and exact editing, create/reconnect, bends, keyboard nudges, undo/redo, local
save/reload, import failure, storage failure, single-commit/canceled drags and
export/copy fallback. All 570 tests across 121 files pass, including 11 focused
flow cases. Typecheck and gallery/library builds pass.

Actual browser checks cover node and port drags, connection creation and endpoint
replacement, bend editing, undo, browser reload persistence, file-picker import
and undo, JSON preview/copy, 100% versus Fit zoom, and paused animation. Earlier
renderer checks covered light/dark, animation progression/resume/rate, family focus
and a narrow viewport. Reduced motion is implemented by CSS; the system preference
was not changed. The in-app browser did not expose a download event for the Blob
link; JSON preview and Copy JSON were verified as working export paths.

This is shared-source and development-gallery delivery. No immutable published
package archive, app dependency pin or installed server generation was changed.
