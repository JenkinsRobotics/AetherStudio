# Map and CAD framework readiness

The first release products are Aether Map and Aether CAD. This is an evidence
map for their shared foundation, not a declaration of complete product parity
or a desktop release. New development lives in the separate local repositories;
the original Aether Studio installation has not been changed.

## Implemented foundation

| ArtCraft lesson | Aether implementation and evidence | Limit |
| --- | --- | --- |
| Separate document/engine/interface responsibilities | Platform `core/host` owns accounts, permissions, storage and history. Each product owns its model and engine. Shared UI/assets/session/sketch are versioned packages. `dev/check-project-boundaries.mjs` rejects cross-repository literal source imports and forbidden CAD-engine/UI dependencies; it recognizes import/export, dynamic literals, URL and glob dependencies. | Static dependency checks do not resolve computed imports or arbitrary bundler aliases. CAD still explicitly uses Animation's legacy workspace protocol. |
| One command path for UI and automation | Map's packaged worker reuses its document parser, normalization, timeline commands and compositor. Platform CLI/MCP shares a schema-described gateway with authorization, revisions and audit/history. CAD agents reuse its document parser, feature history and native translator; native rebuild and resolved body/sketch references precede revision-guarded saves. | Agent scope is bounded saved-document editing. Live editor/selection/pixel-preview adapters are not implemented. No hardware control is exposed through this gateway. |
| Preserve documents and reversible edits | Platform tests cover concurrent-save conflicts, history restoration, permissions after restore, backups, restart persistence and credential exclusion. Map adds seeded edit/undo/serialization invariants. CAD tests cover document links, edit history, native rebuild recovery and STEP round trips. | This is bounded coverage, not proof of every document migration or every CAD feature combination. |
| Reusable presentation instead of independent UI forks | Map and CAD consume the same packaged Aether UI and artwork: sidebars, document tabs, command palette, dock/panel primitives, context menus, focus and theme behavior. Shared UI tests and both app builds run in the release gate. | End-to-end accessibility, narrow-window usability and product-specific presentation still need release walkthroughs. |
| Independent packages with explicit compatibility | Both service wheels contain `compatibility.json`. It declares product identity, platform API 1, frontend/service versions and SHA-256 pins for all directly consumed shared archives. Host validates declared API/identity before constructing a service. Release preflight verifies metadata, locks, archive hashes and installed shared package versions. | Secondary legacy products may still omit a manifest. The release gate requires manifests for Map and CAD. This is not a signed updater or a frontend/server negotiation protocol. |
| Repeatable, honest acceptance | `suite.py release` builds shared packages, Studio, Map and CAD before running their tests, architecture guards, platform tests, installed-wheel tests, Map player and both CAD engines. Native FreeCAD is required, including the CAD document-to-engine UI integration tests; missing, skipped or empty native acceptance fails. Reports include checkout/change fingerprints, input archive hashes, output fingerprints, commands, times and logs. Failed preflight replaces old successful evidence. | UI tests use installed packages. Wheel tests isolate the product imports but use the development environment's dependencies. A fully clean-machine installer/update test remains separate. |
| Platform adapters without a second UI | Web frontends work with the hosted platform or a locally run server. CAD's installed adapter invokes an independently installed FreeCAD runtime. Map packages its Pi player/provisioning resources and stages complete playback updates. | Tauri/offline desktop installation, signing, updates and disconnected authoring are still planned. Actual Pi boot/Wi-Fi/mirroring/schedule/power-loss tests remain required. |

These decisions follow the [VectorCraft development checks](https://github.com/storytold/vectorcraft/blob/main/docs/development.md),
[VectorCraft command boundary](https://github.com/storytold/vectorcraft/blob/main/docs/control-protocol.md),
[PhotoCraft package boundaries](https://github.com/storytold/photocraft/blob/main/Cargo.toml),
and [EffectCraft web adapters](https://github.com/storytold/effectcraft/blob/main/docs/web.md).
No upstream implementation or artwork was copied. They do not require replacing
React, FreeCAD or the existing renderers with Rust/egui/WebGPU. A renderer change
needs measured benefits and a supported deployment path.

## Run the first-release framework check

After the local setup in `LOCAL_DEVELOPMENT.md`:

```sh
.venv/bin/python suite.py release --workers 2
```

A working FreeCAD installation is mandatory. Use the CAD adapter's documented
`AETHER_FREECAD_CMD` override if it is not discoverable. No deployment, user-data
migration, remote publishing, or device connection occurs.

The latest report is `.verification/release/results.json`; each job has its own
log beside it. Native acceptance also writes JUnit results. `passed` means the
listed framework jobs ran successfully on the recorded source state; it is not a
product shipping decision. `running` without completion is incomplete evidence.
Changing source during a run invalidates it. Re-run on the final release checkout.

Shared archives are immutable. When updating one, create the new package version,
update the product's dependency/lock and compatibility hash deliberately, then
run this gate. Do not overwrite an archive just to preserve a filename.

## Latest verification — 2026-10-10

The final local run passed all 23 jobs and 3,339 tests: CAD app894, parked
engine745, native162, installed CAD service17, Map app621/service8/player54,
shared UI478, Studio10, platform298, Sketch24, Session6, architecture12 and
framework gates10. Native document, engine and installed-wheel tests ran without
skips. Both app builds passed; all 12 repository boundaries and local doctor
passed separately. The report retains the verified source/change fingerprints;
completion documentation was added after the run.

Browser9480 used a disposable part: edited a 90° Revolve to reverse direction
with a 30° opposite angle, applied/rebuilt and reloaded. The saved revision2
retained both angles, reversal and body identity. Symmetric preview hid the
opposite field; cancel preserved the saved document. Screenshot review confirmed
the compact shared UI. The temporary tab/server were closed. No production
deployment or real user files were changed.

## Still required before broader release claims

- Broader CAD agent feature creation and live editor selection/preview, beyond the
  implemented saved extrusion/revolve extent and feature history commands.
- Product release walkthroughs: CAD author/edit/recompute/save/reopen/exchange
  workflows from `FreeCAD_Parity_Acceptance.md`; Map playback, routing and real Pi
  provisioning, independent playback and live mirroring.
- Measured interactive performance and memory budgets for large models/timelines.
  Build/test durations in the report are not viewport or memory benchmarks.
- Fully clean-machine install/update/backup/restore/rollback qualification and,
  later, offline desktop packaging. Existing backup and staged-player tests are
  useful prerequisites, not substitutes for these workflows.
- Cross-product references only after selecting a concrete Map/CAD workflow and
  specifying permissions, pinned revisions, missing targets and portable export.


## CAD agent and modeling update — 2026-10-10

CAD service 0.2.0a5 requires platform 0.2.0a4 and packages its fixed Node runtime alongside its native adapter.
Eleven schema-described commands inspect/evaluate parts and exact body faces,
preview/change depth, Up-to-next end offset and Revolve angular extents,
suppress/restore and reorder
features. Agent edits use the same document/history/native translation and
resolved body/attached-sketch helpers as the editor. Native errors never save;
permissions, revisions and recoverable history stay in the platform. Read-only
preview and topology inspection do not mutate documents. Tests exercise the
real MCP/HTTP host boundary and an extracted installed wheel. This is not an
arbitrary feature-creation, live-editor or pixel-preview API.

Jonathan redirected the next work to CAD modeling for AI mapping. Interactive
performance/memory and fully clean-machine installation qualification remain
queued; the installed-wheel tests do not close those broader gates.


## Native browser branch integration — 2026-10-11

CAD and Map, with the other six app frontends, pin UI35/session54/assets6. Shared
history/collaboration controls now use permanent native branch selectors, guarded
merge conflict choices and explicit exact-request retry when the native host
advertises support. Map autosave metadata/file tabs keep readable branch labels
separate from IDs. The built Map browser flow passes creation, rename/open,
lost-reply recovery, comments, merge and history-preserving deletion. All app
builds and exact installed-package checks pass. Evidence lives in
`.verification/framework-branch-client-2026-10-11/summary.json`.

This does not qualify CAD geometry or Map devices on the native host; those service
endpoints, legacy branch import, live delivery and wider framework gates remain
open. No production cutover or remote push occurred.
