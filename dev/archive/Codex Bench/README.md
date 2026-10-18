# Codex Bench — retired 2026-09-23

The standalone renderer-comparison application has been removed at Jonathan's
request. Its Swift/C++ targets, four renderer experiments, older Qt/Unity
prototypes, WebKit payloads, vendored Three.js dependencies, build scripts,
compiled app and build caches are no longer needed by the current web products.

## What remains useful

- **Measurement evidence:** all 78 original files under [Reports](Reports/)
  remain byte-for-byte unchanged. They record workload, import/upload timings,
  batching experiments and the limitations of app-only memory measurements.
  Their 2026-07 recommendations are historical, not current product direction.
- **UI framework:** `WorkbenchWindow` in `core/ui/src/WorkbenchWindow.tsx`
  retains the split-window anatomy as a product-independent Aether UI template:
  220–340 px resizable/collapsible sidebar (265 px default), sidebar header and
  footer, detail toolbar, canvas/overlay slots and status strip. Collapse keeps
  the sidebar mounted. Pointer and keyboard resizing use shared `SplitPane`.
  Launch `/ui/workbench-window.html` on the Studio host, or
  `/workbench-window.html` on the Aether UI development server.

## CAD dependency audit

There are no current imports, package references, build scripts or runtime
consumers of Codex Bench/GeomBench in Aether CAD, Aether UI, Studio, the host,
AnimaCore or the Animation web product. The archived native Anima renderer
copies remain in `aether-animation/archive/`; this retirement does not remove
them or claim completion of the separate Anima migration.

Current CAD already owns the useful capabilities:

| Bench responsibility | Current product ownership |
|---|---|
| Geometry kernel and STEP data | `Aether CAD/freecad-engine/` (default parametric backend, FreeCAD/OCCT); existing browser OCCT path remains under `Aether CAD/aether-engine/` |
| WebGPU rendering | `Aether CAD/src/viewer.ts` uses Three.js `WebGPURenderer` |
| Face/edge identity, selection and camera | CAD's viewer, topology/kernel and viewport modules |
| Appearance/materials/edges | CAD's `viewport-appearance.ts` and viewport appearance modules |
| Measured frame/upload/backend statistics | `Aether CAD/src/cad-viewport-metrics-store.ts` and its viewer publisher |

No Bench code needed to be copied into CAD. Open CASCADE is the geometry
kernel, while WebGPU is the rendering API; retiring a renderer-comparison
harness does not remove either. No new CAD engine dependency was added to UI.

Validation: Aether UI typecheck, 250 tests and production build passed;
CAD build outcome is recorded in STATUS. Original report SHA-256s were
checked across removal. Live browser review was unavailable in this session.
