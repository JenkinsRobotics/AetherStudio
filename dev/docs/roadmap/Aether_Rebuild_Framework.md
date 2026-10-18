# Aether rebuild framework

CAD refinement, 2026-10-13: see the product-owned
[engine evolution roadmap](../../../../Aether-CAD/dev/docs/roadmap/CAD_Engine_Evolution.md).
The replacement is Aether's document/feature/command layer over a qualified
kernel. Direct OCCT remains the initial candidate; SMLib from USD BRep will be
evaluated against the same workloads. FreeCAD remains the default until gates
pass. CAD-specific semantics and adapters stay in CAD; Studio schedules and
authorizes their jobs. CAD performance gates distinguish interaction, exact
rebuild, tessellation and transport instead of treating all work as a 16 ms call.

Drafted 2026-10-10 from Jonathan's direction in the ArtCraft review session.
Language choices and their reasons: [`Runtime_Language_Decision.md`](Runtime_Language_Decision.md).
This document is the plan for getting from the current code to a release.

Update from Jonathan, 2026-10-10: complete the framework before app feature work.
SQL and durable revision history belong exclusively to the full Studio server.
Standalone apps save local files with editing undo/redo and crash recovery.
First push is held until framework acceptance is complete.

## 1. North star

Aether is an engineering and creative **company backbone**: a server that many
people connect to and work on together, plus apps that also run alone, offline.

**Performance and efficiency come first, period.** Every requirement below is
binding:

| # | Requirement |
|---|---|
| R1 | Hundreds of simultaneous real-time users on one host. |
| R2 | The same software runs on one Mac Studio or a Windows/Linux server farm. |
| R3 | Every app is an independent, offline, downloadable desktop app. It also works in the browser and against the hosted server. |
| R4 | About 90% of code is shared between desktop and browser. |
| R5 | Every app can be driven by command line and MCP using the same commands as its interface. |
| R6 | Standard file formats for exchange; documented, versioned native formats. |
| R7 | Data protection: Studio version history, audit log and point-in-time restore; standalone atomic file saves and crash recovery. Validate failure cases; no absolute data-loss guarantee. |
| R8 | FreeCAD is a stopgap. The long-term CAD engine is our own document and feature layer over Open CASCADE. |

## 2. Target architecture

```
App interface        React + TypeScript + @aether/ui        (same code, desktop and browser)
        │  Command protocol: versioned, typed; one per product
        ├─ Desktop (Tauri): engine runs in the app's own process
        ├─ Browser: engine runs as WebAssembly in a background worker
        └─ CLI / MCP: same engine, same commands
Engines (Rust)       CAD · Animation · Map · IO     (Sketch's 2D geometry stays TypeScript)
Server (Rust)        identity · documents & versions · live sync · PDM · jobs · automation
Storage              PostgreSQL · S3-interface file store (content-addressed)
```

### Deployment modes: shared code, separate app and server packages

| Mode | Shape |
|---|---|
| **Standalone** | Desktop app alone. Local document files, editing undo/redo and crash recovery; no SQL database or account. |
| **Single host** | One Mac Studio (or one PC) running the server, with Mac mini/PC workstations on the office network. The host is found automatically. |
| **Farm** | Identical stateless server nodes behind a load balancer, with Postgres replicas, an S3-compatible store and separate job workers. |

### Where work runs

- **Workstation:** all interactive work (modelling, sketching, animating, viewport rendering), so there is no network wait. This is what lets one host serve hundreds of users.
- **Server:** shared truth (identity, permissions, documents and versions, live-edit relay, backups) and heavy background jobs (large exports, renders, simulations).
- **Devices** (Pi players, microcontrollers): the same Rust animation and player code as the workstation preview.

## 3. Standards (binding on every repo)

### S1. Command protocol
- Every product exposes one versioned command set. The interface, CLI, MCP and server jobs all call it; there are no side doors.
- The protocol is defined once in Rust, and TypeScript types are generated from it, never written by hand.
- Each command declares its inputs (with explicit units), its result, its errors and whether it can be undone.

### S2. Engine rules
- Engines have no UI, rendering, DOM or network code. The same crate builds natively and for WebAssembly.
- Engines are deterministic: same document and commands give the same result. Unit tests are required for every behaviour.
- The CAD geometry kernel (Open CASCADE) sits behind a narrow Rust trait, so it can be replaced later.

### S3. Interface rules
Existing contracts stay:
- `UI_Framework_Decision.md` applies.
- Library widgets, never local overrides.
- One theme engine and the icon packs.

React owns presentation only; meaning lives in the engine.

### S4. Local-first data
- Every app opens and saves local files with no account.
- With Studio, open documents and pending edits may be cached in local files. Work continues while the host is down; reconnect uses revision guards and product-defined conflict resolution. This cache is not a local SQL database or durable history service.
- Live co-editing requires Studio. Its durable operation log may use CRDT replication (`yrs`) where product semantics support it; conflicting CAD commands require explicit resolution.

### S5. File formats
- **Native formats:** documented spec, version field and migration tests (`.anima`, CAD part/assembly, Map show).
- **Exchange:** STEP, 3MF/STL, glTF, DXF, SVG, PDF, PNG; DWG later via `acadrust`.

### S6. Server rules
- Postgres and durable revision history belong to Studio on the server. Standalone apps use ordinary local files, not a SQL database.
- Files go through the S3 interface (local disk backend for a single host).
- No server state held only in memory, except caches that can be rebuilt.
- No platform-only APIs: discovery sits behind an interface with Mac (Bonjour) and Windows versions.
- Every write is versioned and audited.

### S7. Performance budgets
These are initial targets. Measure them in CI and tighten them.

| Measure | Target |
|---|---|
| App cold start to usable | < 1.5 s |
| Viewport frame time (reference CAD assembly) | ≤ 16 ms (60 fps); 8 ms on 120 Hz displays |
| Local command round trip (interface → engine → interface) | < 16 ms for interactive edits |
| Live edit relay, office network, 95th percentile | < 30 ms |
| Concurrent live sessions on one Mac Studio | ≥ 500 |
| Idle desktop app memory | < 300 MB |

### S8. Repo hygiene
- Each repo builds and tests on its own in CI.
- Shared code is consumed as versioned packages/crates, never imported from a sibling's source.
- Planned behaviour lives in `roadmap/`; shipped behaviour lives in `reality/STATUS.md`.

## 4. Repository layout (target)

Studio and six independently usable app repositories remain. Drive ships inside Studio. Apps gain Rust where their engines need it; SQL and durable history stay in Studio.

```
AetherStudio/
  crates/  protocol-core · server · store · sync · identity · cli · mcp · discovery
  core/ui · core/assets · core/sketch (TS)       ← unchanged
  drive/                                         ← server-dependent Drive workspace
  desktop/                                       ← reusable shell support; no embedded Studio database
  studio/                                        ← web home
aether-cad/        crates/{cad-protocol, cad-document, cad-kernel-occt}  + src/ (React)
aether-animation/  crates/{anim-protocol, anim-eval (no_std core), anim-output} + web/
aether-map/        crates/{map-protocol, map-player} + src/
aether-io/         crates/{io-protocol, io-engine} when its engine exists + src/
aether-sketch/     src/ (TS on core/sketch)
aether-vector/     planned after release 1 (shell only)
```

## 5. Current code → target

Current size (lines, excluding vendored and built code): platform 19k Python /
71k TS; CAD 7k Python / 85k TS; Animation 50k Python (includes examples) / 36k TS;
Map 3.5k Python / 37k TS; Sketch, IO, Drive and Vector 2k TS or less each.

| Current | Action | Target |
|---|---|---|
| `core/ui`, `core/assets`, app React interfaces | **Keep.** Finish the widget-override cleanup. | Same |
| `core/sketch` (TS) | **Keep** | Same |
| `core/host` + `core/session` (Python, ~8k) | **Port** route by route; the Python tests become the contract | `crates/server`, `store`, `identity` |
| SQLite on the host | **Migrate** | Studio Postgres; no SQL database in standalone apps |
| Host HTTP API | **Keep the shape**; formalise as protocol | `protocol-core` |
| `aether_animation` (Python engine, bridge, output) | **Port** evaluator first, then output/transport | `anim-eval`, `anim-output` |
| Animation `httpbridge` | **Replace** with Tauri commands / WebAssembly worker / server route | Command protocol |
| CAD `aether-engine` (TS, parked) | **Un-park as the design reference.** Port the document, identity and feature layer to Rust | `cad-document` |
| CAD `freecad-engine` (Python) | **Keep as default until parity, then retire.** Freeze new features unless needed for release. | Removed after parity |
| CAD `service` (Python) | **Fold into** server jobs | `crates/server` jobs |
| Map `service` (Python) | **Port** | Server routes |
| Map `player` (Python, Pi) | **Port** | `map-player` (Rust, single binary) |
| Original monorepo checkout | **Retire** after deployment cutover | Archived |
| `aether-vector` | **Planned after release 1** (see `Aether_Apps_Catalog.md`) | — |

## 6. Phases

Complete the framework before individual app feature work (Jonathan, 2026-10-10).
The interface calls commands, and engines are replaced underneath only after
compatibility and recovery checks pass. Each phase has an exit gate.

### Phase 0: Realign (now, ~2–3 weeks)
- Adopt this framework and the language decision in every repo's AGENTS.md.
- Write the **command protocol spec** for each product from what exists (CAD command registry, Animation bridge verbs, Map service routes, host API).
- Write the **native format specs** that are missing; add version fields and round-trip tests.
- Measure **performance baselines** against S7 so improvements are measured, not assumed.
- Finish in-flight work that stays valid: Drive details, the widget-override cleanup.
- Freeze new feature work in Python engines except what release needs.
- **Exit gate:** specs merged; baselines recorded; every repo's CI green.

### Phase 1: Foundations (~6–10 weeks)
- Rust workspace in platform: `protocol-core` with TypeScript type generation.
- **Document and version store:** Postgres plus the content-addressed file store, version history, audit log and restore. Every later feature depends on this.
- **Rust real-time hub** (`sync`, `yrs`) beside the Python authority through authenticated contracts. One write authority; no dual writes to the legacy schema.
- **Tauri shell** opening local files without SQL or Studio; optional Studio connection and host discovery.
- **CLI and MCP** skeleton driving the command protocol (start with Drive/document commands).
- **Spike:** Open CASCADE plus Rust for WebAssembly. Decide on the fallback by the end of the phase.
- **Exit gate:** two workstations co-edit one document through the Rust hub; a CLI command and an MCP tool perform the same action as the interface; restore from backup demonstrated.

### Phase 2: Port the engines and server (~3–6 months, in parallel lanes)
- Host routes move to Rust one at a time until Python serves none (then delete it).
- Animation evaluator in Rust (shared with firmware), then output/transport.
- Map player as a Rust single binary on the Pi.
- CAD document/feature layer in Rust over Open CASCADE; FreeCAD remains the default until parity tests pass.
- Standalone mode: each app runs in Tauri with no server.
- **Exit gate:** no Python in the server; Animation and Map run fully on Rust engines; S7 budgets met or explained.

### Phase 3: App build-out to release
Begins after framework acceptance, gated on the release scope (§7). Each app needs:
- **Release checklist:** core workflow end-to-end, open/save native format, standard exports, CLI and MCP coverage of every interface command, undo/redo, offline mode, real-time co-editing (where relevant), docs.
- **Exit gate:** each in-scope app's checklist done and walked on Mac and Windows workstations against a single host.

### Phase 4: Release
- Signed, notarised installers (macOS, Windows), auto-update, and a server installer and service.
- Backups and restore runbook; upgrade/migration path; monitoring.
- First external pilot company on a single host.
- **Exit gate:** pilot runs for 2 weeks with no data loss and the S7 budgets held.

## 7. Release 1 scope (decision needed)

**Proposed default:**
- **Platform:** server, accounts, Drive/document management.
- **Aether Animation:** the hardware-animation milestone; this is the unique product.
- **Aether Map:** projection and show control with the Pi player.
- **Aether CAD:** parts, sketches, assemblies and drawings; may ship on the FreeCAD path if the Rust CAD path is not at parity yet.
- **Aether Sketch:** freehand drawing and sketching (an Adobe Photoshop Sketch–style app).

**Later:** IO (electronics, an early draft); the creative-suite line in `Aether_Apps_Catalog.md`.

## 8. How in-flight work maps

| Item | Disposition |
|---|---|
| Drive details/inspector integration | Finish (Phase 0) |
| Shared-widget override cleanup | Finish (Phase 0); it is the S3 baseline |
| CAD Drawing producer slice | Defer the core implementation to the Rust CAD document; the interface and spec stay valid |
| Python engine features | Release-critical fixes only |
| Map functional backend packet (token issuance, document ACL, device media reads) | Fix in Python if release needs it before the Rust port; otherwise implement in Rust `identity` |

## 9. Risks

| Risk | Mitigation |
|---|---|
| Open CASCADE plus Rust for WebAssembly is hard | Phase 1 spike. Fallback: opencascade.js in the browser, native Open CASCADE on desktop, behind the same trait. |
| CAD parity with FreeCAD takes long | FreeCAD stays the default; parity tests decide the switch, not a date. |
| Two backends during the port | Route-by-route port with the shared database and the Python tests as the contract; delete Python promptly. |
| Linux web view lacks WebGPU | Keep the WebGL2 renderer path tested in CI. |
| Scope creep before release | §7 scope plus the per-app checklist; anything else goes to "later". |

## 10. Open decisions for Jonathan

1. Release 1 app scope (§7).
2. Whether CAD may ship on the FreeCAD path in release 1.
3. Target date for the first pilot.
4. Code-signing identities (Apple Developer ID, Windows certificate).
