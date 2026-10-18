# Aether Map release review — 2026-10-12

**Verdict: not ready for a general release or a full Lazy Lighting/ArtCraft parity claim.** The editor has substantial working functionality and passing unit/service tests. The remaining work includes product capabilities, browser acceptance maintenance, standalone delivery, physical output qualification, and platform release gates. This is a source-and-test review, not a physical projector or installed-desktop certification.

Reviewed the active Aether-Map and AetherStudio checkouts. Existing working changes were preserved. Original running installations were not replaced. The comparison uses Lazy Lighting's current official guides and the ArtCraft projects' published architecture/control documentation; those are upstream claims, not independently tested competitor builds.

## Release blockers and findings

| Priority | Finding | Evidence / required closure |
|---|---|---|
| P1 | Full agent control is not implemented despite the README previously claiming every action is available. | `Aether-Map/service/aether_map_service/automation-commands.json` now registers eight Map tools after the authoring follow-up below. Scene/surface creation and bounded bounds/rotation edits are implemented; new library shows/assets, corner/mesh edits and pixel previews remain absent. README corrected in this review. Close with a tested authoring command inventory, not more buttons in chat. |
| P1 | Standalone/offline editor release is not established. | `src/api.ts` uses hosted library/media services; there is no app service worker or native local-file picker integration in Map source. Player caching and browser recovery do not prove account-free offline authoring. README corrected. Require disconnected create/import/edit/save/reopen/export on a clean machine, including bundled models and media. |
| P1 | Browser release gates have drifted behind the UI. | Selected browser tests fail; autosave tests reference removed `.map-save-state`, while the status now lives inside the active document tab. This review updates those assertions and reruns recovery/conflict cases. Other failed flows need triage before certification. Unit results alone do not establish release readiness. |
| P1 | Real output/player acceptance is outstanding. | Player/service tests simulate updates and interruptions. Require actual supported Pi/projector cold boot, provisioning, disconnected playback, reconnect, schedule/timezone, audio sync, update failure/rollback and power interruption. Record hardware, OS, codecs, resolution and frame timing. |
| P1 | Replacement Studio deployment is still gated. | `dev/rebuild/CUTOVER_STATUS.md` records pending admin compatibility, combined acceptance and final migration/recovery. Another contributor owns that implementation. Do not confuse working Map adapters with a completed server cutover. |
| P2 | Map still has a large coordinating component. | `src/App.tsx`: 1,554 lines, mixing document loading, selection, layout, media, commands and output orchestration; `src/SurfaceCanvas.tsx`:951 lines. Existing pure modules and hooks are useful boundaries, but the no-god-file goal is not met. Extract document session/controller, workspace preferences and command routing behind existing tests; do not duplicate document state. |
| P2 | Lint passes with88 warnings. | React hook dependency, render-ref and memoization warnings occur alongside cosmetic warnings. Exit0 does not mean clean. Triage behavioral warnings first and establish a no-new-warning CI budget; avoid blanket suppression. |
| P2 | Performance qualification is incomplete. | Production main JS is1,493.46kB (376.43kB gzip), CSS388.21kB; ONNX WASM14.24MB is emitted separately. `src/main.tsx` statically imports editor/output/pairing into one entry. These are artifact sizes, not measured loading or frame-rate regressions. Profile role-based lazy loading, repeated source rendering and large timelines before changing the renderer. |
| P2 | Independent CI omits important release checks. | `.github/workflows/frontend.yml` runs npm tests/build only. Add maintained browser recovery/output tests, lint policy and packaged service/player checks. Hosted/native acceptance should remain a separate platform gate. |

## Lazy Lighting comparison

The older `Aether_Map_Lazy_Lighting_Acceptance.md` contains useful historical evidence but is not a current inventory. In particular, its earlier nested-timeline gap is superseded by current `timelines.ts`, `surface-timelines.ts`, `timeline-audio.ts` and tests. Current code implements reusable timeline instances, cycle rejection, local clocks and single nested audio evaluation. Full physical output agreement remains a release check.

| Capability | Current Map result | Remaining work |
|---|---|---|
| Quad/corner mapping, ellipses, three-face cubes, masks, snapping/welds, bend | Implemented in geometry/mask/shape modules | Qualify touch/pen and real calibration; dedicated cube pose/inside-out workflow remains partial. |
| Image/video/camera, text masks, subject isolation, drawing replay | Implemented | Mobile camera switching, codec coverage, model asset availability and device performance qualification. |
| Reusable media, layering, Repeat/Span, nested timelines and audio | Implemented with deterministic tests | Full multi-source pixel/audio agreement and long-show/device stress evidence. Do not repeat the old claim that nested timelines are absent. |
| Procedural content |29 catalog entries including image effects | Expand original generators and licensed loop content before claiming the reference's40+ generator/library coverage. Variants are not separate generators. |
| Post-effects | Six: slide, rotate, zoom, blur, grayscale, hue | Kaleido, tile, CRT, vintage and fisheye are absent from `VisualEffect.kind`. The Kaleidoscope source generator is not a post-effect for arbitrary video. |
| Audio/LFO/MIDI modulation | Shader numeric inputs; four shared LFOs, audio bands and MIDI learn | General visual/effect parameter addressing, automation lanes, body-position modulation and MIDI LED feedback. |
| Performance view | Scene mixer and ordinary controls | A dedicated fullscreen assignable fader interface and physical controller qualification. |
| Video export | Browser output-window recording | Deterministic timeline rendering/encoding, cancellation, codec/resolution validation and reproducible audio sync. Requested4K capture is not a guaranteed4K master. |
| Wireless receiver | Pi/edge deployment and browser/OS output routes | Android/Google TV companion, QR/manual discovery and pairing, reconnect diagnostics, latency/audio qualification. Pi deployment is not equivalent to phone-to-TV casting. |

Reference sources (retrieved2026-10-12): [mapping](https://lazylighting.com/help/mapping), [visuals](https://lazylighting.com/help/visualizer), [effects/modulation](https://lazylighting.com/help/effects), [wireless](https://lazylighting.com/help/wireless-cast). Pricing and watermark policies are not required parity features.

## ArtCraft lessons: adopted versus missing

| Pattern | Aether status | Map release action |
|---|---|---|
| Separate product semantics from UI/transport | Substantially adopted: product parser/evaluator/edits bundled into one worker; platform owns authority/storage | Continue reducing App.tsx orchestration without moving Map semantics into shared UI/server. |
| Discoverable commands shared by CLI/MCP | Adopted foundation; eight Map commands plus five general saved-document operations | Expand real authoring coverage with strict schemas and existing canonical mutations. |
| Inspect, act, render, verify loop | Partial: inspect/evaluate return structured scene/audio state | Add bounded pixel previews using the real renderer and explicit time/output identity. Current evaluation explicitly says `pixel_preview:false`. |
| Live editor control | Missing | Add editor-instance identity, unsaved revision guards, selection/context, undo transactions and reconnect/conflict semantics. Saved edits must not silently overwrite an open editor. |
| Local ordinary-file automation | Missing for Map | Integrate local file/recovery adapter with the same command catalog; test offline CLI/MCP on a fresh installation. |
| Long jobs and performance tooling | Partial worker/time bounds and tests | User-visible progress/cancel, render/export jobs and repeatable frame-time/memory benchmarks. |
| Authorization and reproducible changes | Strong hosted foundation: scoped expiring grants, current ACL checks, revision guards; native receipts | Keep this when expanding tools. Device output needs a separate explicit arming boundary. |
| Consistent familiar interface | Shared Aether UI shell/trays/menus adopted | Maintain end-to-end selectors, keyboard and narrow/touch acceptance; component adoption alone is insufficient. |
| Portable native/browser distribution | Web build exists; offline/native release not qualified | Preserve React/Tauri direction; no reason to copy ArtCraft's egui UI solely for consistency. |
| Cross-app references | Planned in Aether integration roadmap | Choose one concrete Map import/reference workflow and define pinned revisions, permissions, broken links and portable export. Not a prerequisite for a tightly scoped mapping preview. |

Sources: [ArtCraft principles](https://getartcraft.com/apps), [VectorCraft control protocol](https://raw.githubusercontent.com/storytold/vectorcraft/main/docs/control-protocol.md), [EffectCraft browser architecture](https://github.com/storytold/effectcraft/blob/main/docs/web.md). These demonstrate useful patterns, not a requirement to copy every other product's features. No upstream code or artwork was copied.

## Exact agent support today

Map commands: `map.show.inspect`, `map.show.evaluate`, `map.clip.move`, `map.clip.edit` (duplicate/delete/split/trim), `map.scene.create`, `map.surface.create`, `map.surface.bounds`, `map.surface.rotate`, `map.asset.place`. General commands: list, inspect, history, rename, named-version creation. The Rust `aether-agent` executable provides `list`, `run` and MCP stdio against Studio's permission-filtered catalog. Loopback transport only; remote trusted-server enrollment and offline Map MCP are unfinished. The native host supports installed Map workers and explicit retry receipts. Provider chat (`MapAssistant`/WorkspaceAgent) is separate and does not acquire editing tools merely because the user signs into an AI subscription.

Next command slices: (1) create library shows and corner/mesh edits (scene/surface creation and bounded transforms now implemented); (2) import/reference approved media, create assets (existing-asset clip placement implemented), assign targets and edit effects; (3) render preview/export jobs; (4) explicitly armed output/deployment commands. Each slice must test read-only denial, stale edits, retries, canonical normalization, save/reopen and UI-equivalent results. Do not expose arbitrary shell or raw document replacement to fill the gap.

## Ordered path to release

1. Restore trustworthy browser release acceptance and triage lint correctness warnings. Maintain save/recovery/conflict, import/map, nested timing, output reconnect and export fixtures.
2. Agree on a declared first release: hosted web mapping plus specifically qualified Pi playback is feasible sooner than full mobile/TV/offline parity. Keep missing capabilities labeled honestly.
3. Finish platform gates with the owning lane; qualify installation, migration/backup/restore and compatible packaged services.
4. Qualify physical outputs and publish a supported hardware/browser/codec matrix. Establish representative1080p/4K frame budgets, long-run memory stability and maximum supported show sizes.
5. Complete shared parameter/effect architecture and missing reference effects, then automation lanes/faders/body/MIDI coverage; require same saved/evaluated values in editor, output and export.
6. Expand CLI/MCP via the same domain commands and add preview/live editor adapters. Complete account-free local file operation and desktop packaging before advertising offline independence.
7. Add the TV receiver/content-library gaps if full Lazy Lighting parity is the release goal. Only then claim parity; a smaller honest release can precede it.

This audit does not certify hardware, complete feature parity, full offline operation or production migration. It identifies concrete implementation packets and their acceptance criteria rather than treating all ArtCraft-inspired work as finished.

## Fresh verification and changes

- `npm test`:635 tests/88 files pass.
- `npm run lint`:exit0 with88 warnings; not a clean lint gate.
- `npm run build`:TypeScript and production/automation builds pass.
- Map service/player pytest:69 pass.
- `cargo test --locked -p aether-automation-client`:14 integration tests pass.
- Real host automation suites (`test_automation`, `test_automation_products`, `test_automation_native_client`):50 pass with the Rust executable supplied. These used disposable legacy-host fixtures; previously recorded native PostgreSQL evidence was reviewed, not rerun in this audit.
- Autosave browser assertions now target the active tab's status rather than the deleted detached label. Rerun:2 pass (overlapping saves and conflict/copy),2 fail (immediate refresh and offline resume). Both failures retain the draft with “Saved in this tab” and the interrupted-save message. `core/session/autosave.ts:117` intentionally persists a recovery block before sending a write; do not remove that protection or assert success merely to turn tests green. Add explicit saved-head reconciliation / copy recovery acceptance.
- Other selected browser failures include old workspace navigation lookups, backdrop file-picker timeout, and an assistant-composer spacing assertion (85px versus <65px). These are not all proven engine defects: separate obsolete test expectations from broken user flows before release. The ordinary SVG/reference-package download test passes, as do three existing output-session/reload/disconnection checks.

Changed during review: Map README now states real CLI/MCP and offline limitations; four autosave browser tests use the tab-local status; this review records the current feature and release matrix. No production logic was changed to hide failures. Broad app restructuring and missing product features remain implementation work.

Raw command logs: `.verification/map-release-review-2026-10-12/`. Browser screenshots/traces are under `Aether-Map/test-results/9604/` (initial selection) and `9007/` (autosave rerun). These are disposable test accounts, not user shows.

Final selected browser run:14 tests,4 passed/10 failed (3.3minutes). After the tab-status assertion repair, the4-test autosave subset is2 passed/2 failed, as explained above. Counts overlap and must not be added. The full browser suite was not run.


## Recovery and browser acceptance follow-up — 2026-10-12

The first corrective packet is complete in the active Map checkout. This supersedes
this review's failed selected-browser baseline, but does not change the overall
release verdict or claim full browser-suite coverage.

- Interrupted writes to an existing show now clear their recovery block only when
  a fresh authorized server read confirms identical serialized contents. This
  accepts the confirmed revision without resending the write. Offline metadata
  and differing local content cannot confirm success. Saved shows expose **Check
  saved version**; uncertain new-show creation retains explicit **Save a copy**.
  Copies are intentional recovery actions, not automatic duplicate creation.
- Fixed a late output receiver missing a draft-to-saved channel handoff. A hello
  on an older channel now receives the current destination; ordinary current-channel
  handshakes do not trigger another rekey. Unit and browser regression checks pass.
- Browser acceptance now follows the current shared workspace switcher, quick
  controls, tab-local save status, Media Pool and nested surface timelines.
  Clip playback assertions inspect the scene preview separately from the surface
  editor. Assistant footer checks include its shared status and review reminder.
  These update real UI interactions without dropping conflict, media-protection,
  audio, pixel-export or output-isolation assertions.

Verification: **638 tests in 89 Map unit files pass; all 14 selected Chrome tests
pass in one final run; production/automation build passes.** Focused recovery and
output-session tests:11 pass (included in the638 total). Scoped lint exits0 with
three remaining React mutation warnings in output-session/ref test plumbing;
this is not a lint-clean claim. The isolated host logs an expected broken pipe
when an interrupted-save fixture aborts a response. Browser tests use disposable
accounts/data and the Python fixture host; they do not certify native-host cutover,
physical projection, Pi playback or provider authentication. No running installation
was restarted or replaced. Evidence: `.verification/map-release-fixes-2026-10-12/`.

Next release work remains the full acceptance/lint inventory, declared hosted
release scope, broader canonical CLI/MCP authoring and preview commands, offline
packaging and device/performance qualification described above.


### Map saved-scene/surface authoring via CLI/MCP — 2026-10-12

Added `map.scene.create` and `map.surface.create` to the product-owned catalog,
worker and both host integrations. Canonical editor constructors and document
normalization supply scenes/surfaces and their timelines. Commands target an
existing saved show, return created IDs, preserve existing content/editor focus
and output bindings, validate bounded names/artboards/counts, and require current
revision plus content-edit permission. They neither start playback nor control
unsaved editors. Native receipts preserve IDs and avoid duplicate writes when the
same operation is retried through MCP/CLI; changed/stale requests are rejected.

Validation:651 Map unit tests/90 files;11 Python host/worker tests including real
MCP discovery and creation;45 native PostgreSQL product tests including actual
Rust MCP-to-CLI scene replay and surface receipt/stale checks; production and
worker build pass. Scoped TypeScript/Python lint pass without warnings. Native
build retains existing ts-rs attribute warnings; frontend build retains vendor
module-directive warnings. No live host, account, device, installation or remote
publication changed. Evidence `.verification/map-authoring-commands-2026-10-12/`.
Full Map release, new library document creation, media/geometry authoring, pixel
preview, live editor and offline automation remain incomplete.


### Map saved mapping geometry commands — 2026-10-12

Added `map.surface.bounds` and `map.surface.rotate`, bringing Map's product catalog
to eight commands. Edits target an explicit saved scene/surface at mapping time
zero. Bounds scale the existing warped shape; rotation is a relative angle around
the visible bounding-box center. The editor's transform functions preserve masks,
curve handles and animation keys. Its weld transaction propagates connected
corners and refuses the whole operation if a locked neighbour blocks movement.
Results report all changed surface IDs. Aspect-ratio locks, degenerate transforms,
finite input/output limits and no-op/full-turn refusal are checked before saving.
Unrelated legacy geometry is left untouched. These do not arm or play outputs,
edit individual corners/meshes, or control unsaved editor tabs.

Validation:661 Map unit tests/91 files pass (10 geometry cases);11 packaged-worker/
host tests pass, including real MCP bounds/rotation, stale refusal, full-turn
no-save and restricted grant tests.45 native PostgreSQL product tests pass,
including geometry receipt replay, stale guards and permission-filtered catalog.
Production/worker build and scoped TS/Python lint pass. Native run covered the
initial geometry worker; final edge-case hardening was rebuilt and rechecked by
the full unit suite and real hosted MCP suite. Existing vendor-directive and
Rust ts-rs attribute build warnings remain. No physical projection or native/live
installation certification claimed. No live cutover, push or device interaction.
Evidence: `.verification/map-geometry-commands-2026-10-12/`.

Release blockers still include approved media/asset authoring, pixel preview,
new library-show creation, live/offline automation and device qualification.


### Follow-up: saved asset placement

Added `map.asset.place` / `map_asset_place` to the shared product catalog for
CLI/MCP. It places an existing pool asset using the same `placePoolAsset` operation
as the editor; source inheritance, track targets and media duration stay canonical.
The small product-owned placement module adds bounded timing/count guards and
refuses missing assets/media, locked tracks and incompatible media types. It
returns the created clip ID and preserves saved editor focus and outputs.

This closes existing-asset placement only. Creating/importing assets, pixel
preview, live editor control, offline adapters, device qualification and the
remaining Lazy Lighting feature gaps remain release work. Nine product commands
are now available in the built catalog. No active installation was modified.

Verification:668 unit tests,12 hosted automation checks,45 native product checks,
production/worker build and scoped lint pass. Evidence:
`.verification/map-placement-2026-10-12/`.
