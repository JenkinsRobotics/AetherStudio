# Native CAD test window

The Aether UI gallery's **Widgets → Aether CAD → CAD test window** embeds a dedicated CAD-owned document. CAD owns the fixture, canonical Part history, native translator and evaluator, viewport, parameter editing and serialization. Shared UI only owns collection navigation and iframe presentation; it imports no CAD engine.

The development entry is `http://127.0.0.1:5174/gallery/test-window.html`; production builds include `cad/gallery/test-window.html`. `VITE_CAD_TEST_WINDOW_URL` can point the UI gallery at another CAD development entry.

Start `npm run dev:test-window` in `Aether-CAD` and `npm run gallery -- --host 127.0.0.1 --port 5198 --strictPort` in `AetherStudio/core/ui`. Keep these development processes running while using the showcase. The explicit CAD test mode serves the page and its local computation together, using the existing product `browser_runtime.execute` and FreeCAD adapter. It requires Python 3 and FreeCAD (`AETHER_PYTHON` and `AETHER_FREECAD_CMD` can select their executables). The footer identifies the local runtime. It needs no Studio account, imports no Studio host/storage modules, and only handles `/api/cad/engine` and `/api/cad/geometry`. Requests require the same loopback origin and JSON, with 1 MiB input, four concurrent request and 65-second runtime limits. Each computation closes its native worker; stopping Vite stops outstanding workers.

Ordinary `npm run dev` and production builds retain the authenticated Studio connection. A missing session there is reported with a sign-in link and retry. No synthetic solid replaces a failed native request. A failed local fetch now explains how to restart the CAD development command; a missing iframe reports unavailable after 15 seconds and offers Retry connection instead of leaving a blank window.

The sprocket fixture uses existing native operations: a stepped revolve, a through hole and circular feature pattern for tooth spaces, axial bore, keyway, radial set-screw pocket, four revolved tip cuts and a top chamfer. Seven visible history groups retain all 20 underlying sketch/feature operations. The red bar edits the canonical document's rollback index; a rolled-back save keeps the complete history. The model is a test part, not a qualified chain/sprocket standard.

Controls:

- Select a feature, drag the rollback bar, or use its arrow/Home/End keys.
- Play the build at three dwell speeds; playback waits for geometry and can be paused. Orbit animates the actual camera. The shared ViewCube, fit, pan, zoom and body picking operate on the product viewport.
- Edit six dimensions, apply a native rebuild, undo/redo parameter transactions, or reset dimensions.
- Rebuild forces native evaluation. Test save/reopen uses the canonical Part serializer/parser and compares rebuilt body identities, mesh positions, triangle connectivity and face counts.
- Run checks forces all eight rollback states, then serializes/reopens the final state and rebuilds it again. Any native error or mismatch fails the check.
- Download part uses the product file saver and retains current rollback and feature data. The fixture otherwise stays local to the open window and creates no Studio document.

One in-flight build and a single latest queued request prevent rapid drags or edits from publishing stale geometry. Evaluated states are cached only for the current document revision. Edits and reopen clear that cache; explicit rebuild/checks bypass it. The viewport lives for the dedicated iframe document, whose removal releases the browser realm and renderer. Theme messages preserve the CAD session; source/origin checks bound theme and resize messages.

Verification evidence is in `../Aether-CAD/.verification/cad-test-window-2026-10-13/`. Initial verification used an isolated browser fixture. The connection follow-up additionally qualifies the actual development gallery through its dedicated local CAD mode, including all eight native rollback states and canonical save/reopen. The installed Studio connection and data are unchanged.

The native visual check also corrected CAD stroke ordering in `src/viewport/styled-lines.ts`: strokes draw after opaque faces while retaining depth testing, so full-opacity/hidden-line edges are visible and rear edges stay occluded.
