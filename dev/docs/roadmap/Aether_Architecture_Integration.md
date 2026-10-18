# Aether integration and ArtCraft adoption

Jonathan, 2026-10-09: strengthen the web platform, agent access, UI and architecture
before building the offline desktop package. This is the current development
sequence. Separate application repositories and React interfaces remain the chosen
structure. The native Studio host replaced the legacy installation on2026-10-12,
preserving the original accounts, files and revisions.

## Product repository boundaries — Jonathan, 2026-10-13 (approved direction)

Keep one repository per independently usable application. CAD owns its engine,
command API, UI and product-specific MCP/CLI access in `Aether-CAD`; Map, Animation,
Sketch, IO and Vector follow the same pattern within their existing repositories.
These boundaries are internal modules/packages. They do not create three CADs or
four new repositories per application. Shared UI/artwork/protocol packages remain
versioned dependencies with their existing ownership.

| Owner | Responsibility |
| --- | --- |
| Product engine/document model | Domain meaning, geometry/evaluation, constraints, features, rebuilds and file codecs |
| Product command API | Typed, validated operations and results shared by UI, agents and scripts |
| Product UI | Editing presentation, interaction and rendering; invokes product operations |
| Product MCP/CLI adapters | Product tool catalog, inspection, commands and verification through the command API |
| Studio PDM/Drive | Centralized files, identity, permissions, durable revisions, releases and collaboration |
| Shared infrastructure | Reusable UI, artwork and protocol/transport facilities without product editing semantics |

Browser, local desktop and headless usage are execution modes of the same product,
not separate implementations. Runtime adapters select supported engine, file and
connection services. This does not imply that the current CAD engine already runs
inside a browser or that every app works offline today. Standalone operation must
retain local files, undo/redo and recovery without requiring Studio; SQL and durable
PDM history stay on Studio. CAD's parametric feature history remains CAD-owned.
Studio may schedule and authorize product workers without owning their semantics.

### Implementation gates (planned)

1. Complete the common typed command coverage used by UI, MCP and CLI. Preserve
   validation, normal history and saves, cancellation and document/revision guards.
2. Keep engine execution independent of UI and AI. Agents use product commands
   and verification results rather than a second modeling implementation.
3. Qualify each supported execution adapter with real editing, save/reopen and
   numerical/visual verification. A hosted command test does not certify an
   offline desktop build, browser-native kernel or standalone MCP service.
4. Enforce dependencies and command consistency with boundary/contract tests.
   Make implementation changes within the existing repositories; new repositories
   require a demonstrated independent distribution need and a separate decision.

This decision records ownership, not completion of these gates. See
[agent coverage](../../rebuild/AGENT_COVERAGE.md) for implemented command surfaces
and remaining gaps. It does not replace the current CAD kernel, alter saved formats,
move files, promote an installation or interrupt independently assigned work.

## Reference sequence — Jonathan, 2026-10-13

Jonathan subsequently authorized starting ClassCAD feature integration and putting
its useful feature families in the CAD tool tray. The first source implementation
adds six-domain discovery, an exact editable Cone, shared primitive creation for
agents and canonical history-reference inspection. Remaining ArtCraft acceptance
work remains open; this does not mark it completed. The existing
[CAD applicability review](Aether_CAD_Onshape_Parity.md#classcad-review-and-applicable-patterns--2026-10-12)
is retained: measured incremental previews, reliable geometric
references, repeatable visual checks, consistent named parameters and verified
agent modeling workflows. See the product-owned
[feature integration inventory](../../../../Aether-CAD/dev/docs/roadmap/ClassCAD_Feature_Integration.md)
for the full comparison scope, implemented subset and remaining acceptance gates.
Reassess each candidate against the current code;
overlapping improvements such as agent snapshots should be implemented once.
Continue the FreeCAD-backed CAD architecture. This sequence does not authorize
installing ClassCAD, replacing the kernel or adopting its licensed engine.
It does not interrupt independently assigned CAD implementation already underway.

## Website integrations — Jonathan, 2026-10-13 (planned)

Jonathan clarified the intent behind Map's online assets: a reusable browser
integration for websites that lack a usable public API. Open the real website
inside Aether, let the user search and interact normally, and capture a completed
download into the initiating project's files and normal import workflow. Apply
the same approach to Aether CAD's McMaster-Carr integration. API access is optional,
not a prerequisite for this browser path. Existing API adapters can coexist.

| First consumer | Website interaction | Completed download goes to |
| --- | --- | --- |
| Aether Map / Pixabay | Browse/search the real media catalogue and choose Download | Project asset directory, then the Media Pool through normal media import; source credit and green-screen controls remain Map-owned |
| Aether CAD / McMaster-Carr | Browse/search the real parts catalogue and choose a supported CAD download | Project source directory, then the existing STEP import review/preview; units, placement and geometric validation remain CAD-owned |

### User flow (planned)

1. Choose a website integration from the owning application's existing Insert or
   asset tools. The browser window displays the destination project and folder.
2. Browse, search, sign in if needed, and select the file using the actual site.
3. Aether captures the download and saves the completed file under that project's
   asset/source directory. The user does not hunt through Downloads or reselect
   the same file. Show progress, cancellation and a useful failure message.
4. Register the asset through the product's existing import command. Map adds it
   to the pool; CAD opens its normal STEP review/placement flow. Saving bytes and
   inserting geometry are separate operations, so cancelling placement need not
   discard the downloaded source. Preserve normal undo and save/reopen behavior.

The project destination is the user's project/repository directory, not the
application's source-code checkout. Unsaved projects select their destination
once before capture. A browser session binds to its initiating document; switching
tabs must never silently import into another project. Hosted documents use the
existing authorized project asset store, with the same visible destination and
product handoff. Standalone desktop capture must not require a Studio account.

### Shared responsibilities (planned)

The reusable desktop/browser adapter owns windows, browsing sessions, download
lifecycle and handoff receipts. A website integration contributes its catalogue
URL, allowed navigation/download origins, supported file types and product import
action. Start with those small configurations; DOM scraping and scripted clicking
are not prerequisites for user-driven browsing. Optional metadata extraction must
not prevent an otherwise supported download/import.

Keep the host interface narrow: completed file identity, display filename, verified
media type/size, original page/download URL, integration ID and initiating project
identity. The runtime resolves a confined project destination, uses unique staging
files and publishes only completed validated bytes. Handle duplicate names,
concurrent downloads, cancellation and rejected formats without overwriting an
existing asset. Retain useful source/part/licence metadata when available; do not
invent it. Remote pages get no general filesystem or product-command bridge.
Website cookies/login state stay in the browser session rather than the document.

Shared UI supplies presentation only. Browser and filesystem operations belong in
the reusable desktop runtime adapter; engines and import interpretation remain in
their owning applications. Do not add a cross-product CAD-engine dependency or
put supplier transport in core/ui. Choose a package location at implementation,
using Map and CAD as the two concrete consumers rather than creating speculative
plugin infrastructure.

### Runtime evidence and acceptance (planned)

Tauri provides a download-request hook with a writable destination and a completion
event. This is a candidate mechanism, not proof that either supplier's live site
works in a packaged Aether browser. On macOS the completion event omits the saved
path, so retain the destination from the request and qualify correlation and file
completion before import. See the official
[download event contract](https://docs.rs/tauri/latest/tauri/webview/enum.DownloadEvent.html)
and [webview download hook](https://docs.rs/tauri/latest/tauri/webview/struct.WebviewWindowBuilder.html#method.on_download).

Acceptance must demonstrate a real supplier download into a chosen project folder,
correct project binding across tab switches, duplicate-name handling, cancelled/
failed downloads, file validation, normal product import/undo, and saved reopening.
Qualify website login/new-window behavior and downloads on every supported desktop
platform; a callback fixture alone does not certify site compatibility.

Current state: Map has a web popup/manual-file-selection fallback plus a development
Pixabay API integration. CAD has a catalogue/manual-STEP-selection fallback. Neither
captures a website download automatically into a local project directory today.
This records shared product direction; it does not promote a desktop build, replace
an installed application or interrupt the existing ArtCraft-first work sequence.

## Current agent checkpoint — 2026-10-13

The next ArtCraft-inspired slice connects **Map's open editor** to the existing
provider tool relay, following the inspect/act/verify pattern in
[VectorCraft's control protocol](https://github.com/storytold/vectorcraft/blob/main/docs/control-protocol.md).
No upstream implementation was copied. Map's nine saved-document operations and
its live tools share the same product command function; editor commits use normal
history/autosave. Paged inspection and small mutation receipts fit the native relay.
Read-only documents, locks, active gestures, cancellation and changed editor
identity are guarded. Undo/redo act on ordinary editor history.

CAD and Sketch already have live tool adapters. The maintained scope matrix is
[agent coverage](../../rebuild/AGENT_COVERAGE.md). Provider adapters are implemented;
real external-account authentication/inference has not yet been qualified.

Next useful gaps: bounded **pixel previews** for the inspect/act/render/verify loop,
approved media/generator creation/import, trusted company-server CLI/MCP enrollment,
and local-file adapters. Broader tools must reuse product operations and carry
actual end-to-end evidence. Desktop/offline, physical outputs and company-scale
performance remain separate release gates, not implied by passing command tests.

## First-release focus — Jonathan, 2026-10-09

**Aether Map and Aether CAD will be the first full Aether applications.** This
priority governs the implementation sequence below. Shared infrastructure and
ArtCraft-inspired improvements serve these products; completing the entire suite
is not a prerequisite for their releases. Other applications are secondary, with
maintenance and necessary shared compatibility preserved. Independent contributors'
assigned work is not implicitly cancelled.

Prioritize complete user workflows and release blockers before extending the
agent catalog or adding broader framework abstractions. Agent access is one
capability of a usable product, not the product's completion criterion.

| Product | First-release focus | Evidence required |
| --- | --- | --- |
| Map | Surface creation/mapping; reusable media and generators; layered surface/compound timelines; precise asset placement and clear previews; show export, independent playback and live mirroring to supported outputs/Pi | Create a real show, save/reopen without loss, verify preview/export agreement, transfer to a supported device, and demonstrate boot/schedule/loop, reconnect and recovery on actual hardware. Separate automated checks from hardware checks still outstanding. |
| CAD | Reliable FreeCAD-backed sketch/constraint and parametric modeling workflows; assemblies/drawings within declared release scope; usable selection/viewport/inspectors; supported import/export and document history | Complete representative models through the production engine, edit/recompute/save/reopen, verify dimensions/topology and supported exchange round trips; review against existing FreeCAD acceptance gates. Do not infer full parity from adapter tests or icon coverage. |
| Studio/shared UI | Files, accounts, permissions, version history, consistent navigation/panels and scoped agents needed by Map/CAD | Both applications work against the same supported platform release with clear errors, recoverable saves and tested permissions. |

For each product, maintain a concrete list of verified workflows, partial flows
and blockers before calling it release-ready. Preserve the web-first shared UI
and separate owning engines. CAD new features stay on the FreeCAD path; the parked
browser engine remains maintained. Native/offline distribution stays a separate
acceptance milestone requiring installation and disconnected editing tests.

Immediate sequencing: assess Map and CAD against these workflows, prioritize
blocking product gaps, implement and verify bounded fixes, then polish performance
and release packaging. Broader suite-wide shell changes and cross-app references
are undertaken when they solve an identified Map/CAD need.

## Reference review

Reviewed primary source/docs on 2026-10-09. These are architecture references, not
independently verified feature-parity or performance claims. No upstream source,
branding or artwork was copied in this work.

| Evidence | Useful pattern | Aether decision |
| --- | --- | --- |
| [VectorCraft MCP implementation](https://github.com/storytold/vectorcraft/blob/main/crates/mcp/src/lib.rs), [MCP docs](https://github.com/storytold/vectorcraft/blob/main/docs/mcp.md), [control protocol](https://github.com/storytold/vectorcraft/blob/main/docs/control-protocol.md) | A discoverable command surface behind agent/UI adapters; inspect state before editing; return previews and errors | Adopt a schema-described command catalog. Expose tested existing commands incrementally, preserving authorization, revisions and history. Live editor selection/preview is a separate product adapter. |
| [PhotoCraft workspace](https://github.com/storytold/photocraft/blob/main/Cargo.toml) | Explicit document, operation, engine, rendering and UI boundaries; property testing and performance tooling | Preserve product engines, measure hot paths, add invariants and file round-trip fixtures. Evaluate Rust/WASM components only against an actual bottleneck and a web-compatible license/dependency audit. |
| [EffectCraft workspace](https://github.com/storytold/effectcraft/blob/main/Cargo.toml), [web architecture](https://github.com/storytold/effectcraft/blob/main/docs/web.md) | Time/project/track/render/automation boundaries; platform-specific adapters | Keep Map projection and Animation motion semantics separate. Share platform contracts and proven presentation widgets, not a universal timeline evaluator. |
| [CADCraft workspace](https://github.com/storytold/cadcraft/blob/main/Cargo.toml) | Drafting geometry, constraints, formats, engine and UI boundaries | Useful drafting/interchange reference. Does not justify replacing Aether's FreeCAD parametric path or expanding its parked browser kernel. |
| [VectorCraft development](https://github.com/storytold/vectorcraft/blob/main/docs/development.md) | Layering and build checks, repeatable verification | Expand Aether's existing boundary/build/test gates around concrete workflows and compatibility, rather than counting feature declarations. |

The pasted comparison is background, not current ownership authority. In particular,
Aether does not need one shared domain engine or an egui rewrite. Platform owns
identity/files/access/history; products own document meaning and engines;
UI/assets/session and the authorized sketch geometry package remain shared.
The older claim that these projects share no code is not a safe current assumption:
EffectCraft's manifest now pins FilmCraft media dependencies. Any reuse proposal
must inspect the specific component, revision, license and transitive dependencies.

## Implementation order

### 1. Agent command access — foundation and Map/CAD saved-document adapters implemented

Implemented in `core/host/automation/`: a version-1 command catalog, strict argument
schemas, per-user expiring app grants, and one gateway backed by Library/History.
Studio's personal Plugins page creates and revokes grants with existing shared
Aether fields/buttons. MCP stdio and CLI consume the same catalog.

Currently exposed: saved-document list/search, bounded inspection, history,
revision-guarded rename and named-version creation, plus Map show inspection,
scene-composition evaluation and move/duplicate/delete/split/trim of saved clips.
The Map adapter builds the existing parser, normalization, timeline edits and
compositor into an independently packaged worker. The editor uses the same
normalization entry point. No parallel Python document semantics were added.

Default grants are read-only. Saved-document editing is a new explicit permission;
existing rename/version grants are unchanged. Changes use file history and latest
revision checks. Real MCP → temporary host → Map worker verified changed output
state, stale-revision rejection and history recovery. This does not alter an open
editor's Undo stack. Provider chat now supports product-owned live tools for CAD,
Sketch and Map; other products remain conversational.

Next (planned): pixel previews and broader product operations. Live editor control
now carries explicit editor/session identity. Current evaluation returns geometry/audio state and
labels itself non-pixel. CAD now exposes eleven saved-part commands through its
owning adapter: native evaluation/topology, extrusion depth/end offsets and
dependency-aware feature history changes. Native validation, body identities and
attached-sketch frames resolve before platform saves. No raw model/SQL/
shell mutation endpoint. Hardware requires a distinct explicitly armed path.
Atomic batches remain unclaimed until transactions span product and persistence.

### 2. Consistent application shell and document workflow (planned)

Audit the shared global sidebar, file tabs/save state, workspace navigation,
command search/shortcuts, panels, context menus and account/document controls in
CAD, Map, Animation, Sketch, Vector and IO. Map/Vector are existing examples, not
permission to fork more widgets. Drive was assigned to another agent earlier;
coordinate its integration and address it last unless that assignment changes.

Use shared UI components, icon artwork, focus/keyboard rules and theme tokens.
Keep each app's tool set and layout appropriate to its work. Verify expanded and
collapsed sidebars, narrow layouts, panel docking, keyboard focus, and unsaved-file
navigation. Preserve browser editing gestures in text inputs when overriding
context menus. Implement changes per application with a shared-widget regression
check; do not redraw the whole suite in one unreviewable change.

### 3. Cross-application references (planned)

Select one demonstrably useful producer/consumer workflow before designing a
format. The platform reference must carry stable file identity and pinned revision
or explicit follow-branch policy. Resolve permissions on every read; define
missing/trashed targets, cycles, stale references and portable exports. Each
product interprets its own content. Acceptance includes upstream change detection,
permission removal, version pinning and reopening a downstream document.

### 4. Reliability, performance and framework work (release gates implemented; broader qualification planned)

- Map now has a deterministic 100-edit move/round-trip/undo invariant test, plus
  command/compositor/lock/boundary/recovery coverage. Expand this approach to other
  owned semantics and products.
- Establish measured initial-load, viewport, large-tree/timeline and memory
  baselines. The current Studio build reports a large initial JS bundle and emits
  artwork variants. Audit on 2026-10-09 found 3,462 Studio SVG files and zero
  byte-identical duplicates; similar names are distinct artwork variants. The
  FreeCAD icon catalog explicitly includes light and dark palettes. Do not delete
  them as duplicates; measure actual loading before changing packaging. Do not force a rendering migration solely by framework name.
- Move measured long-running work off the UI thread where feasible, with progress,
  cancellation and bounded memory. Preserve exact CAD geometry and unit contracts.
- Implemented: packaged Map/CAD compatibility manifests, pre-construction host API
  validation, pinned shared archive checks and `suite.py release` with mandatory
  native CAD workflow/installed-wheel execution and artifact evidence. See
  [framework readiness](../reality/Map_CAD_Framework.md). Full clean-machine
  install/update/migration/backup/rollback qualification remains planned.
- Maintain import/export round trips for supported STEP/DXF/SVG/glTF paths in the
  owning products. Report unsupported content instead of silently flattening it.

### 5. Desktop distribution (planned, after the above foundation)

Package the same interfaces with a local runtime, product engines and assets.
Verify no-network create/edit/save/reopen without cloud login; then installation,
updates, platform-specific native capabilities and signing. Hosting remains a
separate deployment mode. Local folders and a successful browser build do not
by themselves establish a complete offline desktop release.

## First-slice limitations

The initial agent CLI/MCP client connects only to a literal `127.0.0.1` HTTP origin,
with no redirects or ambient proxies. Remote hosting requires explicit trusted
server enrollment before credentials can be forwarded there. It is a stdio MCP
server, not a Streamable HTTP MCP endpoint; the host has an ordinary authenticated
command API. Connection scopes cover accessible files in selected applications,
not a selectable individual-file subset yet. Read-only commands may update the
normal recently-opened list and audit trail but do not change document content.

### First-release verification follow-up — 2026-10-09

Installed CAD/Map service packaging and Show output scene binding are repaired;
see reality STATUS and each product README for the strict release checks. Next
Map acceptance must verify the staged Pi update mechanism under real network and
power interruption, plus boot/offline/pairing/mirroring/schedule flows on hardware.
Simulated failures and local HTTP generation switching now pass. CAD still follows FreeCAD_Parity_Acceptance.md for
complete author/edit/rebuild/save/reopen/exchange workflows; packaged adapter tests
do not establish drawing/assembly/full modeling parity. Desktop/offline distribution
remains a separate milestone after these product workflows are dependable.


### Shared agent visual feedback —2026-10-13

Implemented a provider-neutral bounded image-result contract in shared UI and
the native relay. ChatGPT/Claude/Gemini adapters carry real image content;
products retain rendering, semantics, current-document guards and history.
Sketch supplies full drawing PNGs from its SVG exporter. Map supplies explicitly
labelled calibration masks from its existing projection exporter; composed
shader/video output still needs dedicated capture support. Other applications
can implement the same contract without creating a second provider integration.
See `dev/rebuild/AGENT_COVERAGE.md` for budgets, source/installed distinction and
remaining product-specific work. This does not complete suite-wide agent parity
or advance the separate ClassCAD reference phase.

### Shared agent operation lifecycle — 2026-10-13

UI83 separates authenticated status polling from product execution so a slow
CAD rebuild or preview can respond to cancellation/lost access. Actions remain
serial and cached receipts retry without repeating edits; bounded request/action
waits and explicit unconfirmed-result states make interrupted work reviewable.
The shared controller is used by every WorkspaceAgent consumer. Products retain
all geometry, commit, undo and persistence responsibilities and must check their
AbortSignal before an asynchronous commit. No host deployment or new app tool
catalog is implied. See the source/installed distinction and limits in
[agent coverage](../../rebuild/AGENT_COVERAGE.md).
