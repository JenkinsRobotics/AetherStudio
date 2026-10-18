# Runtime language decision record

CAD refinement, 2026-10-13: the product-owned
[engine evolution roadmap](../../../../Aether-CAD/dev/docs/roadmap/CAD_Engine_Evolution.md)
retains Rust as the target for Aether's engine layer and FreeCAD as the current
default. Direct OCCT is the continuity candidate; SMLib from NVIDIA USD BRep is
an evaluation candidate, not an adopted dependency. Compare geometry quality,
document compatibility, native/WASM portability and measured end-to-end costs
before replacing the backend. The existing parked TypeScript geometry engine
does not become a second new-feature implementation lane.

Decided with Jonathan, 2026-10-10. Prompted by the ArtCraft "Crafting Apps"
review (all-Rust, egui, one codebase for desktop and web).

## Requirements that drive it

- **Performance and efficiency first, period.**
- Hundreds of simultaneous real-time live connections to the server. The
  server runs on a Mac Studio-class machine; small hardware means players and
  devices (Pi, microcontrollers).
- Independent, offline, downloadable apps **and** the full hosted server.
- Command-line and MCP automation of every app.
- Standard file formats for exchange.
- FreeCAD was a stopgap, not the long-term CAD engine.

## Decision

| Layer | Language | Notes |
|---|---|---|
| App UI | **React + TypeScript** (unchanged) | Same UI in the browser and the desktop app; `UI_Framework_Decision.md` still holds. egui rejected: it discards `@aether/ui` and is weaker for accessibility, text and complex panels. |
| Desktop shell | **Tauri** | Rust links in-process; no Python sidecar. Linux WebKitGTK lacks WebGPU, so the viewport keeps its WebGL2 fallback. |
| Engines | **Rust**: native for desktop, server, CLI and MCP; WebAssembly in a browser worker | CAD document/features/solver over Open CASCADE behind a narrow kernel interface; animation evaluator (`no_std` core shared with firmware); Map player. |
| Server | **Rust** (Tokio/Axum) | Studio-only real-time hub, accounts, sessions, SQL storage and durable document history. Standalone apps link product engines and file adapters, not the server/storage crate. |
| Firmware | Rust | Shares the animation evaluator crate. |

TypeScript that already runs offline in the browser and in Tauri (Sketch,
the Map editor) stays TypeScript unless profiling says otherwise.

## Migration order (incremental; nothing breaks)

1. **Command protocol:** one versioned, typed command set per engine, shared by
   the UI, CLI and MCP. Start from CAD's command registry.
2. **Formats:** document the native formats; export STEP, 3MF/STL, glTF, DXF,
   SVG and PDF.
3. **Rust real-time hub**, beside the Python host through authenticated contracts. Keep one write authority; migrate Studio storage to Postgres only after import/restore/rollback acceptance. Do not have two implementations write the legacy schema.
4. **Port the Python host** route by route behind the same HTTP API, with the
   existing Python tests as the contract. Retire Python when they all pass.
5. **Tauri shell** with ordinary local file saving, editing undo/redo and crash
   recovery. Studio connection is optional; do not embed SQL, durable revision
   history or a Studio server. Native engine capability must pass before claiming
   offline CAD; keep the existing FreeCAD deployment until replacement parity.
6. **Spike:** build Open CASCADE plus Rust for WebAssembly. Fallback: drive the
   existing opencascade.js in the browser and native Open CASCADE on desktop.
7. **Engines one at a time:** animation evaluator first, CAD last. FreeCAD stays
   the default until the Rust CAD path matches it.

## What this supersedes

- The "no Rust / no engine replacement" line in `aether-platform/AGENTS.md`.
- "No new feature investment" in the parked own-engine: its own document,
  stable identity and Open CASCADE shape is the long-term direction, now
  targeted at Rust.
- Vector editor: planned after release 1 with the creative-suite line
  (see `Aether_Apps_Catalog.md`).
