## Standard application regions — Jonathan, 2026-10-16

The standard app layout is Header / Left / Center / Right / Footer. Header owns
app controls, workspace selection and user/share UI; Left owns document controls;
Center is the workspace; Right owns workspace/selection properties; Footer holds
workspace-adjacent content. Header and Footer always span full width. Header is
fixed height; Footer follows content within shared limits. Left/Right span the
full body between them. Optional top/bottom toolbars belong inside Center only.
Use shared `AppLayout`, `APP_LAYOUT_METRICS` and `core/ui/WIDGETS.md` for sizing,
padding, spans and overflow. Apps provide widgets inside the shared containers.

## Shared overlay containers — Jonathan, 2026-10-14

The Aether UI **Overlays** collection defines the shared container standards:
sidebars, toolbars, floating panels, editing popups, settings windows, dialogs and
popovers. Apps supply widgets, elements, data and actions inside those containers;
different content or tabs must not create a new frame or interaction design.
Reuse the shared implementation and approved variants. New container designs
require separate review and approval before app adoption; reference specimens do
not imply approval. Review contents independently under Elements/Widgets, then
compose them in Workspaces. See `core/ui/WIDGETS.md` for the ownership contract.

## Local native installation active — 2026-10-12

The qualified Rust host now owns `http://localhost:8780`, backed by private
PostgreSQL and content storage. Both legacy Python listeners (8780 and 8781) were
stopped after final captures; the original launch agent is disabled. The duplicate
account was merged under the original sign-in; the other user stays separate.
All 2 users, 31 files, 8 folders and 549 revisions are retained.
The old checkout and `.dev-data` are preserved migration sources, not writers.
Do not restart either legacy authority against those sources. After native writes,
recovery must preserve native data; no reverse migration to Python exists.

The private `~/Library/Application Support/Aether Studio Native/current-installation.json`
locates the active immutable executable/configuration. `dev_server.py` reports
that installation; it no longer starts Python. New web development still belongs
in these split repos. See `dev/rebuild/CUTOVER_STATUS.md` and `LOCAL_DEVELOPMENT.md`.
Desktop, physical hardware, company-network performance and the no-push release
gates remain separate. Earlier running-installation statements below are history.

## Local cutover direction — Jonathan, 2026-10-10

Continue the framework integration, then stop the old local server and start the
replacement once existing app/data compatibility and rollback are verified. This
authorizes that eventual local cutover, not an early replacement with incomplete
framework modules. Continue server-side web app development afterward. Desktop
variants reuse the web UI with local file/engine adapters; offline capability must
be verified rather than inferred from the wrapper. The no-push gate still applies.

## GitHub checkout handoff — 2026-10-10

Active development is now in `AetherStudio`. The existing app snapshot was
imported from `Temp Aether` into this GitHub-linked checkout. Jonathan then
authorized removal of Temp Aether and explicitly discarded its older Git histories
on 2026-10-10. Migration evidence is retained in `migration/import-verification-2026-10-10/`;
this checkout keeps its existing GitHub history and origin. No upload or running-installation cutover was performed.
Studio (server, Drive and shared packages) lives in `../AetherStudio`.
Earlier migration notes below describe historical folder names.

# Aether Studio contributor contract

## One repository per product — Jonathan, 2026-10-13

Each independent application owns its engine, document meaning, validated command
API, interactive UI, and product-specific MCP/CLI tools in its existing repository.
These are internal modules/packages, not separate CAD products or repositories.
Apply this ownership rule to CAD, Map, Animation, Sketch, IO and Vector. Browser,
desktop and headless execution are adapters for the same product; capability in
each environment must be qualified separately.

Studio owns PDM and Drive, accounts, permissions, centralized files, revisions,
releases and collaboration. Shared protocol/transport infrastructure may be reused;
product command catalogs and editing semantics stay in the owning app. UI and
agent access must converge on the same validated product operations. That coverage
is a development target, not a claim of completed agent or offline support.
Do not split engine/UI/MCP/PDM into additional repositories as part of this work.
See `dev/docs/roadmap/Aether_Architecture_Integration.md` for the agreed boundaries
and implementation gates. Existing FreeCAD and shared-package rules remain in force.

## Studio services and standalone apps — Jonathan, 2026-10-10

`AetherStudio` is the Aether Studio server repository, not a separate end-user
application. Server-dependent workspaces/services (Drive, accounts, permissions,
sharing, version history, collaboration, admin and job management) belong here
and ship with Studio. Drive's active frontend is `drive/`; its former sibling
repository was removed with Temp Aether after its source was verified in Studio.

Independently usable applications keep separate repositories: CAD, Map, IO,
Animation, Sketch and Vector. Their local operation must not require a Studio
account/server; collaboration and centralized storage are optional connections.
Shared UI and protocol packages remain reusable by offline applications without
a server dependency. This supersedes the earlier eight-repository split for Drive.

## Database and revision ownership — Jonathan, 2026-10-10

SQL databases, durable revision history, permissions, sharing and collaboration
belong to the full Aether Studio server installation. Standalone apps save ordinary
local document files and may retain editing undo/redo and crash recovery; they do
not ship a SQL database or the Studio revision-history service. This supersedes
standalone SQLite/history wording in the rebuild draft and earlier implementation
notes. `crates/store` is Studio-only. Its SQLite code is a developer reference
fixture behind `sqlite-reference`, excluded from the production/default build.

## First push gate — Jonathan, 2026-10-10

Complete and verify all framework updates before the first remote push. Keep
changes local until the remaining gates in `dev/rebuild/README.md` are satisfied.
Passing an incremental gate does not authorize publishing or installation cutover.

## Framework first — Jonathan, 2026-10-10

Complete the shared framework rebuild before returning to individual app
feature completion. This supersedes the parallel app-build-out sequencing in
the rebuild draft. Preserve existing applications, compatibility and data while
replacing infrastructure in verified slices. Map and CAD remain the first app
priorities when framework work is ready; no implicit deployment cutover.

## First full applications — Jonathan, 2026-10-09

Aether Map and Aether CAD are the first full Aether software releases. Prioritize
completing and verifying their end-to-end user workflows. Shared platform, UI,
agent and architecture work must support a concrete Map/CAD release need. Other
applications remain secondary; defer broad feature expansion unless it unblocks
these releases. This does not cancel another contributor's independently assigned
work. Existing product ownership and CAD engine boundaries remain in force.
See `dev/docs/roadmap/Aether_Architecture_Integration.md` for release gates.

This is the product's new local development home. The previous monorepo is
retained for historical reference and the currently running deployment. Make new
changes here; do not edit both copies. Local migration evidence and suite setup
are in `../AetherStudio/migration/` and `../AetherStudio/suite.py`.
Read `SOURCE_HISTORY.json` for preserved ancestry. The GitHub origin is configured; see SOURCE_HISTORY.json.

- This product owns its domain engine, document meaning, UI, and runtime adapters.
- Consume shared UI/artwork/session/sketch as versioned packages; do not import a
  sibling project's source or copy shared icon geometry.
- CAD's parked `@aether/core` belongs exclusively to CAD. New parametric features
  use its FreeCAD adapter; read its ATTRIBUTION.md before changing it.
- Animation semantics belong to `aether_animation`, not the UI or renderer.
- Shared UI must not import a product engine or implement network transport.
- Keep original artwork and third-party attribution. Never overwrite branding/originals.
- Test changes in the owning project and record remaining limitations honestly.

Original architecture contracts are preserved in the original Aether Studio
checkout. Web frontends remain React/TypeScript. Native desktop packaging is
planned; this extraction does not add Tauri or replace engines with Rust.

**Runtime direction (Jonathan, 2026-10-10):** performance first. Engines and the
server move incrementally to Rust; the UI stays React/TypeScript in a Tauri shell.
Read `dev/docs/roadmap/Runtime_Language_Decision.md` and the plan in
`dev/docs/roadmap/Aether_Rebuild_Framework.md` before engine or server work.
