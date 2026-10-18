# Framework rebuild implementation

**Current shutdown checklist:** [CUTOVER_STATUS.md](CUTOVER_STATUS.md).
Both legacy authorities were stopped after final captures on2026-10-12. Their
combined data now runs on the Rust host at `http://localhost:8780`, under the
original sign-in. The following chronological notes are not a current blocker count.

Jonathan's 2026-10-10 instruction is framework first, then app completion.
`AGENTS.md` records that this supersedes the draft's parallel app-feature phase.
Map and CAD stay the first applications to finish afterward.

**First push is on hold (Jonathan, 2026-10-10).** Complete all remaining
framework gates before publishing any of these local migration changes. The
incremental acceptance command below is not a full-framework release certificate.

Repository ownership was clarified in the same session: `AetherStudio` (Python package `aether-platform`) is
Aether Studio (the server). Server-dependent workspaces and services ship there;
Drive now lives in `drive/`. CAD, Map, IO, Animation, Sketch and Vector retain
independent repositories and the target of account-free standalone operation.
Shared UI/protocol packages can be used offline; they do not require a server.

## Current migration state — 2026-10-12

Read [CUTOVER_STATUS.md](CUTOVER_STATUS.md) for the current shutdown gates. The
chronological notes below this table preserve incremental implementation history;
their old pending-work statements are not the current inventory.

| Area | Current state |
| --- | --- |
| Repository ownership | Local split complete. Studio contains the server, Drive and shared packages; CAD, Map, Animation, Sketch, Vector and IO have separate repositories. |
| Interface | React/TypeScript retained. All eight installed builds, including administrator-only Aether UI, pass the combined native browser fixture. App readiness now reports actual configured dependencies; it is not release certification. |
| Native authority | Rust identity, settings, PostgreSQL storage/access, guarded saves, history, restore, checkpoints/releases, branches and discussions have native adapters and transactional regression coverage. No fallback writer points to Python. |
| Drive and collaboration | Listing/search, details, favorites, recents, sharing/members/links, recycle, uploads/downloads, rename/move/copy, organization/workspace administration and SSE reconnect/draft retention pass HTTP and built-browser checks. |
| Agents | Scoped CLI/MCP grants and installed Map/CAD saved commands pass authority/retry/revocation checks. ChatGPT and optional Claude/Gemini conversation adapters run under native-owned isolated jobs. Real provider subscription sign-in/inference remains unqualified; conversations do not implicitly obtain document tools. |
| Administration | First-run setup, account recovery/mail, restrictions, scoped service credentials, diagnostics, scheduled verified backups, managed HTTPS/network changes and restart pass scoped HTTP/browser/executable checks. Operator secrets and external backup delivery are separate. |
| Map and CAD services | Installed product workers retain their existing engines. CAD saved commands/browser geometry/settings and Map media/search/exports/player distribution/device/cast APIs pass native checks. Physical hardware and full product parity are not certified. |
| Animation | Installed worker, private versioned workspace bytes, load/pose/save/reopen and confined image/video/GIF/sprite/procedural rendering plus matrix output pass product/native/browser checks. Explicit format/allocation limits remain. |
| Both demos | Final quiesced merge preserves2 users,39 entries,549 revisions,388 blobs and both asset sets under the original sign-in. Independent restore and all31 file heads/8 folders verify over native HTTP. The actual deployed Map/CAD files open for both owners; accounts/history remain unchanged. |
| Local operation | Rust serves8780;8781 and both Python processes are off. Immutable host/runtime snapshots, private PostgreSQL, login-session LaunchAgents and independent backup restore are installed. This is not a signed desktop/system installer. |
| Verification | Baseline:369 ordinary native checks, both optimized512MiB transfers and21 storage checks pass. Final rerun:366/369; the three fixture/catalog failures were fixed and all45 affected product checks pass. Final admission9/operator13 and supervised plus deployed Map/CAD geometry checks pass. Counts overlap. |
| Performance |500 synthetic users retain500 subscriptions while eight edit workflows complete1,500 guarded saves. This proves bounded functional load, not full LAN/company performance. Latest A/B shows faster concurrent reads/status, slower durable saves; flush investigation retained stronger durability and rejected an unproven cache. |
| Standalone/release | Ordinary-file/recovery foundations exist. Full offline desktop/engine qualification, signed installers, physical Pi certification and broader app completion remain separate. |
| Cutover and push | Local server replacement and deployed data/browser checks are complete. Full company-network/performance and standalone/release gates remain; remote push stays held. |

Evidence: `.verification/framework-native-media-operations-2026-10-12/summary.json`
and the preceding administration/company-load packet. There is no audited overall
migration percentage; passing these scoped checks does not complete the full
framework or authorize publishing.

The current service uses the R2 native binary with the latest UI72 frontend
snapshot. Final live acceptance waits for the actual rebuilt CAD solid and opens
both owners' Map/CAD files with no API/page errors. macOS service generation now
uses Interactive scheduling for responsive HTTP/SQL work; background throttling
had caused a deployed-only CAD timeout. Qualification includes the actual launchd
service plan through `rehearse_imported_apps.py --launchd`.

## Implemented: first migration boundary

- `crates/protocol-core`: versioned command transport, correlated success/error
  responses, execution certainty, limits and Rust-generated TypeScript.
- `core/protocol`: independently buildable `@aether/protocol` package, declaration
  files and runtime version export; generation drift and consumer checks.
- `crates/server`: asynchronous loopback command gateway with bounded admission,
  request/response sizes and deadlines. Legacy Python owns authentication,
  authorization, command semantics, document revisions, saves and history.
- Existing CLI and MCP adapters work against the Rust origin using compatibility
  routes. The new versioned route is available for future migrated clients.
- Disposable-host acceptance exercises actual saved revisions/history, stale
  edits, read-only permissions, immediate credential revocation and real CLI/MCP
  subprocesses, plus a deliberately dropped response after a committed save.
  No user database, hardware, or running installation is used.
- Independent Rust/framework CI is configured for Linux and macOS. Configuration
  is not evidence of a remote CI run; local qualification is on Apple Silicon.

This resolves the first database-transition choice: **one existing write
authority behind an HTTP boundary**, with no direct Rust access to its SQLite
schema. Future Postgres migration must have its own backup, integrity, restore
and rollback acceptance. This gateway does not solve the old host's global-lock
contention or provide a second write authority.

The migration now includes typed inputs/results and versioned effects/history/
retry profiles for the five existing Studio document commands. Discovery remains
grant-filtered; the authority still enforces its input constraints and ACLs.
Product-owned input schemas are still discovered from the authority; product
results remain JSON and their migrated semantics are explicitly unknown. Engine
capabilities and the full product command registry still need migration.
Existing applications are not silently rewired. See `COMMAND_PROFILES.md`.

## Implemented: Studio persistence foundation

`crates/store` now defaults to the Studio-only PostgreSQL adapter with immutable
server-side content objects. Tenant-scoped revisions, audit and operation receipts
commit together; content is verified and flushed before the metadata commit.
Exact retries, conflicting edits, bounded lock/statement times and integrity
checks use shared Rust command semantics. Full identity/document authorization
must be supplied by the host; this library is not a public access-control API.

Twelve real PostgreSQL tests cover tenant isolation, concurrency/retry, transaction
and content failures, schema upgrade/rollback, dump-plus-content recovery, abrupt
restart and commit-ordered change replay. Schema2 adds atomic revision events;
authorized current-state SSE invalidation is implemented (see `../../crates/server/CHANGE_STREAM.md`); browser adoption and operation replay remain separate work. The existing SQLite implementation is now a developer-only
reference fixture behind `sqlite-reference`, with CLI `aether-store-fixture`.
Default builds exclude its SQL dependencies. No standalone app ships this store.

Jonathan's clarified boundary is binding: standalone apps save ordinary local
files and retain editing undo/redo and crash recovery. SQL, durable saved-version
history, permissions and collaboration require a full Studio installation.
The original host remains the write authority for existing apps; no migration or
app cutover occurred. S3 remote qualification, large assets, legacy import,
production backup/rollback and complete legacy route integration remain open.
See `crates/store/README.md` for the precise contract and recovery limits.

## Implemented: ordinary standalone file adapter

`crates/local-files` provides native file IO and a CLI without SQL/server/network
transport dependencies. Saves use explicit fingerprints, OS writer locks and
atomic publication. Plain-file recovery retains separate session drafts and
requires explicit recovery/discard. Tests kill real processes before publication
and after completed save; current files and recovery remain consistent. This is
not revision history or a Studio service. The companion browser adapter now provides user-selected file handles and OPFS
recovery with the same generated fingerprint/error/receipt types. Real Chromium
tests cover tab coordination, restart recovery and worker file capabilities.
Tauri/editor integration remains.
See `crates/local-files/README.md` and `core/files/README.md` for size,
permissions and the distinct native/browser durability limits.

## Implemented: native Studio credential authority

`crates/identity` implements tenant-scoped PostgreSQL accounts, legacy-compatible
password verification, stronger versioned new credentials, expiring hashed
sessions, revocation, account administration and single-use recovery. Hashing
runs outside database transactions with bounded concurrency. Current identity
is rechecked before commits; audit failure rolls back changes. Its private
PostgreSQL acceptance joins the framework gate. The separate native identity host now connects it to browser HTTP routes, but
does not yet replace the legacy host. Initial native document/team/app permissions
are connected as described below; remaining Drive/admin parity,
agent/service credentials, remaining setup/mail/admin flows and import/rollback
remain required before cutover. A bounded-pool test exercises 500 simultaneous
identity reads before and after revocation; this is not 500 live HTTP/WebSocket
clients or a whole-company workload certification. See `crates/identity/README.md`.

## Implemented: native browser identity boundary

`aether-native-host` now serves native account HTTP using the identity authority:
login/logout, current session, password-confirmed profile/password changes and
selected admin actions. Explicit migrate/bootstrap/serve commands keep schema
changes and initial provisioning out of anonymous requests. Exact configured
origin, native-only HttpOnly cookies, strict bounded JSON, no-store errors and
per-request revocation checks are enforced. The original gateway remains separate.
Readiness explicitly says application migration is incomplete; no frontend or
unmigrated API silently falls through to Python. See `crates/server/NATIVE_HOST.md`.

Jonathan authorized the eventual local stop-old/start-new switch after verified
replacement and recovery. The original port8780 still runs the preserved checkout;
this native integration is not sufficient for that switch. Existing app/data/API
compatibility, authorization and migration/rollback remain prerequisites. The
planned sequence and observed runtime are in `LOCAL_CUTOVER.md`. Desktop
variants share the React UI and need working offline file/engine adapters.

## Implemented: native authorized document operations

The optional native document authority now connects current sessions, app/team
restrictions, organization/workspace membership and inherited file permissions to
PostgreSQL revisions in one transaction. It preserves private-file boundaries for
administrators and legacy shared-library semantics. Create/save/rename/restore,
read/history, view/edit grants and selected administrative operations have strict
browser endpoints. Saves and permission changes use shared/exclusive commit locks;
revoked users cannot replay an old receipt to regain access. Default enrollment
cannot silently undo organization removal. Actor/tenant come from identity.

Eight private PostgreSQL/HTTP tests and512 comparisons against the existing Drive
policy cover permission and failure behavior. Full legacy library/Drive routes,
workspace preferences/full admin projections, link issuance/redemption and import
are still open. Opt-in frontend hosting is described below. See
`crates/server/DOCUMENT_ACCESS.md` for the API, lock ordering, explicit object-store
configuration and current resource limits. Readiness still reports applications
incomplete; this is not a server cutover or a completed rebuild.

## Implemented: native document discovery integration

The native document authority now has a metadata-only `list` endpoint with optional
application and literal name filters. Each result and pagination lookahead passes
the existing current-session, app/team and inherited-document policy. Generated
TypeScript contracts describe the bounded request and summary page. Private file
IDs/counts are not returned as scan cursors; revocation is checked again on later
pages. It does not fetch content objects or replace the legacy Drive/frontend API.
Discovery introduced local protocol alpha.2; directory integration below advances
the browser file adapter to alpha.3 (subsequently alpha.4 for browsing). Earlier archives remain immutable. No remote
package was published.

Discovery is currently bounded to 100 returned items, 2048 candidate inspections
and 10 seconds per call. It fails explicitly rather than claiming an incomplete
scan is a complete directory. Indexed authorization/search qualification for large
company libraries remains open, along with legacy response
projections and frontend integration. See `crates/server/DOCUMENT_ACCESS.md`.

## Implemented: native organization/workspace directory

Native HTTP routes now create organizations with an atomic default workspace,
create managed workspaces, change workspace membership, and list a caller's
organizations/workspaces with permission-filtered pagination. Administration is
separate from private document access. Shared/exclusive access locks order these
changes with saves; explicit membership edits protect the last workspace owner.
A failed audit or conflicting default-workspace ID rolls back the entire change.

Frozen access schema2 adds names and directory indexes without moving existing
files or changing permissions. Explicit migration verifies checksum history;
startup refuses old or incompatible schemas. Generated request/result contracts
were introduced in local protocol alpha.3; browsing below advances the browser
file package pin to alpha.4. Drive/frontend
compatibility, rename/preferences and broader admin views remain open. See
`crates/server/DOCUMENT_ACCESS.md` for the strict integration API.

## Implemented: named folders and scoped browser navigation

The native authority now creates named folders and lists folders/documents together
at a requested organization/workspace/parent. It returns safe metadata, visible
breadcrumbs, literal name search, app filtering and authorized ID pagination.
Shared child folders never disclose inaccessible ancestor names; workspace root
access is checked separately. Revocation, app restrictions, invalid parent chains
and bounded scan failures use the same authority as document reads.

Access schema3 adds folder-only names and a child index through an explicit frozen
migration; document names stay in canonical revisions. Failed create audits and
failed migration DDL roll back. Protocol alpha.4 and its immutable core/files pin
include the generated browse contracts. The existing Drive/frontend is still not
rewired: legacy view projections, preferences, data import and app
serving remain. See `crates/server/DOCUMENT_ACCESS.md` for the API and limits.

## Run the acceptance gate

Prerequisites: Rust 1.97.1 with rustfmt/clippy, Node 22, Python 3.11 or 3.12
with the platform development dependencies, Chromium (`npm ci` then
`npx playwright install chromium` in `core/files`), plus PostgreSQL tooling (locally
verified with 17.11; set `AETHER_PG_BIN` if needed). From this repository:

```sh
.venv/bin/python dev/rebuild/check.py
```

It builds the executable, checks generated types and consumers, runs Rust
failure-path tests, and then launches disposable servers for compatibility tests.
The original host and product workers are not required. On macOS it selects the
installed Command Line Tools SDK if no explicit SDK was supplied.

Regenerate bindings after changing the Rust contract:

```sh
cargo run --locked -p aether-protocol-core --bin export-types -- core/protocol/src/index.ts
```

Do not edit generated bindings. They are an internal alpha package, not a
published dependency; apps continue consuming their existing pinned packages.

## Existing editor document API and app client adoption

The Rust host supports Main-file `/api/library/read/create/save/rename` through
its native authority, preserving the editor metadata shape. Studio-owned recent
visits commit with accepted saves; schema5 is additive. Branches, Drive uploads,
The later CAD project-container adapter now handles create/read/edit; unsupported library actions still refuse with501.

All six app frontends plus Studio/Drive now pin shared session alpha.8. Map and
CAD replaced duplicate file transports with that shared client. Unknown save
outcomes and refresh during an in-flight write retain recovery and block blind
retries. This upgrades app infrastructure without asserting that all app routes,
engines or production data have migrated to Rust. Opt-in native frontend hosting
is described below. Native
`applications_ready` remains false. See `crates/server/NATIVE_HOST.md` for the
supported compatibility surface and remaining work.

## Existing editor home listings

The native `/api/library/list` adapter now projects personal, workspace and recent
views for editor homes, including folder metadata/navigation, literal search and
current permission filtering. It reuses canonical resource/revision/audit records,
does not load content blobs, and never labels autosave counters as named versions.
Its legacy unpaged contract fails explicitly beyond 2,048 candidates or 10 seconds;
no partial success is returned. Versioned browsing remains paginated. See
`crates/server/NATIVE_HOST.md` for input semantics and remaining compatibility.
This listing adapter alone does not enable hosting or set applications_ready;
the opt-in hosting section below describes the separate browser integration.

## Native browser status and application discovery

The existing `/api/status` envelope now uses native PostgreSQL identity and app
permissions. Account initialization, anonymous/expired sessions, forced password
changes and operational failures remain distinct. App/team filtering shares the
same locked transaction as session validation; status has no enrollment or other
write side effects. Anonymous native status withholds the app catalog.

One packaged/embedded JSON catalog supplies metadata to both servers. Optional
operator-owned presentation configuration supplies the integration server name
and theme; native admin settings and legacy-settings import remain open. No
application is reported installed without its explicit native frontend snapshot.
`applications_ready` remains false. See `crates/server/NATIVE_HOST.md` for precise
compatibility differences, configuration and the remaining app connection gates.

## Before/after migration comparison — Jonathan, 2026-10-10

Deliver an A/B comparison after migration, before declaring the framework ready
for release. A is the preserved pre-migration application; B is the migrated
application. This is a required acceptance deliverable, not a completed benchmark.

Before retiring the old installation, capture a reproducible A baseline: source
snapshot including working changes, dependency versions, build configuration,
fixture projects, workload scripts and raw measurements. Keep these outside the
running installation with a hash manifest and environment record. Use disposable
data copies; do not benchmark destructive operations against production data.
The earlier audit summaries in the integration ledger are useful context, but
the referenced `.verification/platform-audit-2026-10-10` directory was not found
in either current Studio checkout during this review. Recover those raw artifacts
or recapture the baseline; summaries alone cannot substantiate an A/B result.

Run matched A and B workloads on the same hardware, with recorded OS, browser,
GPU, engine versions, project sizes and settings. Separate cold and warm runs,
repeat measurements, and record sample counts. Keep background load controlled;
use separate ports and disposable storage. Prioritize Map, CAD and the Studio
host serving company workstations.

| Compare | Required evidence |
| --- | --- |
| User experience | Matching screenshots and recorded editing flows: navigation, panels, open/save, timeline editing and asset/surface assignment |
| Responsiveness | Startup, project open/save, CAD recompute/import/export, viewport interaction and Map playback; latency distributions and frame timing |
| Resource use and scale | Steady/peak memory, CPU, throughput and errors at matching concurrent-user loads; distinguish session checks from real editing users |
| Correctness and quality | Same geometry, units, document content, asset links, permissions, timing, rendering resolution and output quality |
| Reliability and data | Interrupted saves, restart/reconnect, conflicting edits, backup/restore and migration verification; explicit checks for missing documents/assets |
| Local versus hosted | Separate hosted and standalone results; test offline operation only when the corresponding runtime exists |

Publish a readable side-by-side report with baseline/result values, percentage
changes, screenshots, reproducible instructions and links to raw evidence.
Include regressions, unsupported workflows and untested conditions as prominently
as improvements. Reused React UI or FreeCAD components must be identified; do not
attribute an end-to-end difference to Rust without an isolating measurement.

Apply the framework's existing performance targets and correctness gates. Record
workload-specific tolerances before the final B run rather than choosing thresholds
after seeing results. Data loss, access-control regressions and broken existing
workflows block readiness. Investigate performance regressions and document their
resolution or explicit acceptance. The comparison does not itself authorize a
push or bypass the migration/rollback requirements for installation cutover.

## Implemented: opt-in native frontend hosting

The Rust integration host can load a bounded, immutable snapshot of trusted public
Studio/shared/Map/CAD builds. Existing library and editor URLs remain distinct;
every app page and asset checks current native identity and app/team authority.
Shared branding and account UI are served from explicit roots. Unknown APIs and
user-file paths remain errors, never HTML or legacy-server fallback. Builds alone
do not enable an app or set `applications_ready`/`runtime_ready` true.

See `crates/server/NATIVE_HOST.md` for `AETHER_NATIVE_FRONTENDS`, memory/file limits,
Unix qualification, and the separate actual-build Chromium acceptance command.
The normal gate verifies snapshot boundaries and HTTP routing with fixtures; the
actual-build check requires sibling frontend builds and must be run explicitly.
Actual browser qualification identified `/api/cad/engine`, `/api/map/devices/list`,
`/api/agent/catalog` and library history/collaboration as unmet service dependencies
at that qualification point. History reads are now native (see the update below);
history mutations and collaboration remain unmet.
The current check verifies page/file loading, not full editor engine/device use.
Product services, server settings/admin UI, remaining data import and cutover/rollback
qualification remain open. Account preferences are now migrated as described below.

## Remaining framework gates, in order

Native resource lifecycle now has generated contracts and routes for guarded
folder renaming, subtree moves, trash/restore, resource metadata and recycle-bin
listing. Structural revisions/events/receipts are distinct from canonical product
content history. Access migration4 retains earlier checksums, protocol alpha.6
retains earlier archives, and moves validate all descendants before atomic change.
See `crates/server/DOCUMENT_ACCESS.md` for permissions, limits and outstanding
Drive compatibility. This does not wire apps to the new server or complete the
following gates.

1. Finish command contracts: the five Studio commands have typed compatibility
   profiles; product results/errors, explicit units,
   read/preview/write/undo effects, capabilities and document/engine revisions.
   Test equivalent commands on existing and replacement adapters.
2. Finish Studio document/operation storage: the PostgreSQL and local object
   foundation and initial schema2 upgrade are implemented; real S3 qualification,
   large assets, subsequent migrations and legacy import remain. Qualify repeatable migration, backup, restore and
   rollback against realistic workloads before any cutover.
3. Rust identity and host API migration: retain all existing access, sharing,
   session and account tests. Separate long jobs from interactive operations.
4. Authenticated live synchronization with durable event delivery, bounded slow
   clients, reconnect/replay and product-defined conflict semantics. A CRDT alone
   does not make conflicting CAD feature edits meaningful.
5. Ordinary local file saving, atomic recovery files and shared native/browser
   execution adapters; CLI/MCP use the same contracts. Optional Studio caches and
   pending-edit files must not introduce a local SQL/history service. Verify
   disconnect/reconnect, conflict handling and recovery behavior.
6. Tauri shell reusing the React interface; local file access and native engine
   capability checks. A wrapper does not make FreeCAD-backed browser CAD offline.
7. Engine migrations and the Open CASCADE native/WASM spike. Preserve current
   engines until replacement format, geometry and recovery tests pass.
8. Qualify the full framework: real multiuser workloads on the reference host,
   independently built packages, recovery exercises and desktop distribution.
   Complete the before/after migration comparison above with retained raw evidence.
   Only then resume individual app feature completion under the current direction.

The existing performance audit is the starting baseline, not proof that Rust
already meets the 500-live-session or interactive-edit targets. No deployment,
installer, signing, farm or device certification is included in this slice.

## Original-demo account/file transfer — 2026-10-10

A read-only SQLite/WAL snapshot of the actual original demo has been imported into
an isolated, stopped PostgreSQL/object-store target: 1 user, 18 library entries
(14 documents/4 folders), 516 Main revisions and 358 content blobs. IDs, password
hashes, owners, locations and current access records were compared; Rust integrity
verification and a dump/copy/restore rehearsal passed. Two Drive attachment files
and one workspace asset are preserved outside Git alongside the complete original
SQLite snapshot. Existing sessions require fresh login.

This is staging, not cutover: the original server remains authoritative. Native imported-attachment downloads now have an opt-in verified snapshot adapter
(see `crates/server/NATIVE_HOST.md`). Workspace delivery and
network/TLS settings adapters remain open; the originals are retained, not claimed as working native APIs. A final
snapshot/import after draining writes is required before switching. See
[transfer details](LEGACY_TRANSFER.md) for private paths, limitations and
reproduction. No production server was restarted or remote repository pushed.


## Imported attachment delivery

The native host supports authenticated GET/HEAD downloads for imported Drive
media, saved revisions, preview and explicit-start single byte ranges. An
operator-provided private snapshot verifies hash/size and bounds memory; public
writes cannot forge attachment references. See `crates/server/NATIVE_HOST.md`
for configuration and limits. No upload or workspace asset API is implied.

Actual-demo qualification imported the preserved snapshot into a fresh disposable
native database and verified both attachment revisions (7,340,130 bytes), full
and ranged HTTP delivery, and anonymous refusal. Test-only sessions were created
only in that disposable database; this was not a real user's password login.
The source snapshot and stopped prepared target remain unchanged, with all 516
revisions. Evidence: `.verification/framework-downloads-2026-10-10/actual-demo.json`.


## Native account preference migration

Identity schema2 preserves account appearance, personal theme and profile picture.
Existing Studio controls use native `/api/preferences`; status/session display
responses include the saved fields. Updates are current-user-only, bounded and
atomic with their audit. Imports now compare preference values during initial load
and portable restore. The latest private demo target is
`native-20261011T062112Z-preferences` beside the earlier targets; it remains stopped.
All516 revisions remain. Full administration/network settings, workspace assets, uploads and the other
product/service migration gates remain open. See `crates/server/NATIVE_HOST.md`
and `dev/rebuild/LEGACY_TRANSFER.md` for configuration, evidence and limitations.


Actual built-frontend browser verification now exercises the existing Studio
account controls: save theme, upload a PNG, reload, remove it and reload again.
The same run retains Map/CAD page and Map document round-trip checks. Evidence is
in `.verification/framework-preferences-2026-10-10/browser/`; its remaining API
failures are explicit migration work, not suppressed readiness errors.


## Native server appearance settings — 2026-10-11

The native host now stores its name and base/per-app themes in Studio PostgreSQL
(`aether_settings` schema1). Explicit migration initializes it; startup is read-only.
Admin saves are version-guarded and audited; status reflects updates without a
restart. The legacy theme endpoint is also native. Demo imports and restores now
include server appearance as well as account preferences. Seed configuration is
initialization-only; a conflicting seed at startup is refused.

This slice does not complete the legacy administration screen. Network/TLS/restart,
mail, workspace assets, uploads and remaining app services are still migration work.
See `crates/server/NATIVE_HOST.md` for the exact API and operator upgrade steps.

## Native Main history compatibility — 2026-10-11

Existing `/api/library/history` and `/api/library/read_revision` calls now execute
against native Studio storage under current account/app/file permissions. Listing
uses metadata only; historical previews are read-only and do not change recents
or the current revision. The old unpaged response is complete up to1,000 revisions;
larger histories fail explicitly, with native paging still available.

Access schema6 adds verified-import annotations for original notes, seconds and
parent references. Frozen older schemas remain unchanged. Missing annotations in
earlier staged imports require fresh re-import, never invented empty notes. The
earlier stopped demo target, `native-20261011T062112Z-history`, retains all516
revisions and passed portable restore and362 recovery-file checks. A disposable
HTTP import matched all514 editor rows and24 historical/current previews; the
two Drive attachment revisions use their separate download adapter.

Branches, release lifecycle, collaboration, mutable uploads and other
app/admin/agent services remain migration gaps. Subsequent additions below
implement content restore, private workspace reads and named checkpoints. This incremental gate does not make applications ready or authorize cutover.


## Native workspace delivery and editor restore — 2026-10-11

Private per-user workspace files can now be loaded through the existing app URL
with current native session/app authorization. Their bounded immutable snapshot
is separate from public frontend builds and uploaded Drive attachments. The real
preserved workspace file passed byte/hash comparison. Mutable workspace storage,
uploads, large media and product execution remain distinct migration work.

Legacy Restore now uses one canonical native transaction with expected-head and
operation-ID guards. It retains the current name and all history; exact retry does
not append again, including after later edits. Optional preserve_name is generated
in protocol alpha7; omitted/null retains original native semantics. Three focused
restore tests cover replay/concurrency/conflicts, permissions and audit rollback.
Three workspace HTTP cases cover bytes/headers/HEAD, isolation, revocation and
refusal; three unit cases cover snapshot/path safety. Actual disposable demo
qualification restores12 documents and verifies their preserved history/integrity.


## Native named checkpoints — 2026-10-11

Main checkpoint create/rename/remove and history/home projections now use access
schema7. Their transactions retain current permissions, guarded heads, exact retry
receipts and audit events; removing a label preserves its content/history. Legacy
import keeps all checkpoint metadata and protected release states without modifying
frozen recovery archives. The latest stopped demo rehearsal is
`~/Library/Application Support/Aether Studio Migration/native-20261011T062112Z-versions`.
The original installation remains authoritative. Release-lifecycle transitions,
branches, collaboration, mutable uploads, remaining product/agent/admin APIs and
full framework/desktop/performance qualification remain pending. No push or cutover.

The existing-browser qualification exposed ordinary panel bursts exceeding the
four-handler document pool. A bounded queue now admits up to20 document requests
while retaining4 executing handlers, waits at most250ms within the original
deadline, and refuses overflow as not_started. Account/control capacity stays
separate. Cancellation and queue/deadline tests protect those bounds.


## Native collaboration migration — 2026-10-11

Comments/replies, document notes, action items and reminders now have native Studio
routes using the existing UI. Independent discussion revisions, audited before/
after items and exact operation replay preserve content history. Current viewer,
author, assignee and editor rules remain enforced, including queued revocations
and moderation-receipt access after role changes. Frozen access migration8 upgrades
explicitly and atomically from schema7. Main discussion imports replay and verify
the entire source history; legacy timestamps, images and tombstones are retained.

See `crates/server/COLLABORATION.md` and `LEGACY_TRANSFER.md`. Earlier collaboration
route gaps in this chronological log are closed for request/response Main editing.
Live synchronization, branches, notification delivery, other host/product routes,
local-shell integration and full workload qualification remain open. No full
migration percentage or readiness claim is inferred from passing these checks.


## Native release and directory integration — 2026-10-11

Release candidate/withdraw/approve/obsolete actions now use guarded native checkpoint
transactions, preserving file contents/history and existing receipt compatibility.
Session alpha34 pins in Studio/Map/CAD supply operation IDs and handle uncertain
write responses. Built browser controls and old-host compatibility pass.
`/api/drive/context` supplies current organization/workspace/app navigation without
implicit membership changes; unpaged bounds, private visibility and current account
permissions are enforced. It does not yet implement workspace preferences or Drive
listing/uploads. Details and evidence paths are in `crates/server/NATIVE_HOST.md`.

No schema change or production data rewrite was needed. The original port8780 is
still authoritative. Earlier entries' pending-release references are historical;
branches, comparison, uploads, app/admin/agent services, live synchronization and
full framework performance/recovery/cutover gates remain open. No push/cutover.


## Preserved A/B source and build baseline — 2026-10-11

Captured the original `Aether Studio` checkout, including working source changes
and built Studio, CAD, Map and shared UI, without changing or restarting it.
The private baseline is:
`~/Library/Application Support/Aether Studio Migration/baseline-original-20261011T211636Z`.
It contains23,158 files and2 internal symlinks (372,150,735 source/build bytes),
a162,752,530-byte compressed archive, per-file SHA256 manifest, archive/file
checksums, original HEAD/status, OS/hardware/runtime/dependency inventory and the
capture script. Archive readback, every captured source hash afterward, unchanged
Git status and private0700 directory/0600 file modes passed. No user database is
included; the separately verified demo data snapshots remain under their existing
private migration paths. A final data snapshot is still required before cutover.

This captures a reproducible baseline artifact; it is not a completed before/after
performance measurement. Workloads still need to run in disposable matched A/B
environments with original dependencies and representative projects. Current native
app runtime gaps must be closed before whole-app parity/performance can be claimed.
Proof: `.verification/framework-baseline-2026-10-11/capture.json`.


## Stable-ID browser branch gate — 2026-10-11

UI35/session54/assets6 are immutable and installed in all eight frontends. Native
history, comments and Map tab labels preserve branch identity independently of
renamable text. Existing shared controls create/open/rename/delete branches,
handle structured guarded merge conflicts and explicitly replay an uncertain
metadata request with its original operation ID and body. Legacy hosts without an
explicit replay guarantee cannot use the new retry. Pending requests are currently
held by their initiating mounted panel, not a durable cross-navigation outbox.

507 UI,70 session,6 Map adapter,8 legacy transport,228 ordinary native document,
one optimized512MiB upload,23 server unit and14 final branch HTTP checks pass.
All eight builds, gallery build, package-content verification, browser flow,
Clippy, typechecks and doctor pass. Evidence:
`.verification/framework-branch-client-2026-10-11/summary.json`.
Validated legacy branch import is now qualified; live metadata delivery remains the next branch gate;
remaining app/agent/admin, offline/native-engine, workload and cutover work is not
claimed complete. Original installation and data remain authoritative.

## Legacy branch migration — 2026-10-11

The offline importer now carries independent branch heads, stable identities, merge
parents, restores, checkpoints and comments into schema16/store3. Identifiable
deleted branches remain tombstones with explicitly recovered creation metadata.
Unprovable or reused legacy names and old comment aliases stop transfer for review.
Existing Main archives remain unchanged and readable. Native branched history uses
resolved ancestry while original parent annotations remain intact.

Disposable migration/recovery and continued HTTP editing are covered by
`test_legacy_branches.py`, now part of `check.py`. The original demo was reimported
and restored in a new stopped private target with all 516 revisions and 358 blobs.
See `LEGACY_TRANSFER.md` and `.verification/framework-branch-import-2026-10-11/`.
Global `branches:false` remains withheld for live metadata delivery; no cutover.


## Authorized document invalidation — 2026-10-11

`GET /api/library/changes` now streams authorized, bounded current-state snapshots
from durable document/branch/checkpoint/discussion metadata. Reconnect always
sends a freshly authorized state; access revocation closes the subscription.
See `../../crates/server/CHANGE_STREAM.md` for the wire contract and limits.
This completes the initial server notification transport, not browser live editing,
per-operation replay, company load qualification or the overall migration. No
frontend pins or production installation changed. The next consumer gate is
safe history/discussion invalidation and reconnect without overwriting drafts.


## Browser live invalidation — 2026-10-11

UI36/session57/assets6 are pinned across all eight frontends. The shared history /
discussion panels and Drive dialogs consume negotiated native SSE, preserve draft
and pending-operation state, and refresh on reconnect without product reload.
One stream is shared per app/document. Offline/account changes close stale streams;
legacy hosts retain polling. Company-scale live workload, product concurrent-edit
semantics and the remaining service/desktop/cutover gates are still open.
Evidence: `.verification/framework-live-browser-2026-10-11/summary.json`.

## Native agent controller — 2026-10-11

The Rust host now serves the existing agent catalog and an opt-in ChatGPT
controller: administrator plugin settings, personal connections, model/chat jobs,
callback completion and cancellation. It reuses the existing JavaScript provider
adapter directly; it does not proxy the Python host. Bounded subprocesses and
current identity/product authority protect the service. Private provider storage
is separate from document objects and is not copied from the old installation.
See `crates/server/NATIVE_AGENTS.md`.

Qualification uses fake local provider processes and the actual built Plugins UI.
Real ChatGPT subscription inference, Claude/Gemini runtime migration, distributed
job orchestration, receipted uncertain chat startup and packaging remain open.
The native agent catalog no longer counts as a missing browser endpoint; that
does not close the entire agent or application readiness gate.

## Native CLI/MCP bridge — 2026-10-11

The Rust `aether-agent` executable replaces the Python CLI/MCP transport while
consuming the existing authority's permission-filtered command catalog. The
framework gate builds it and runs real HTTP/stdio edit, conflict, grant and
revocation compatibility tests alongside its bounded-transport tests.

This does not migrate the automation HTTP routes: Rust Studio agent grants and
command dispatch remain open. CAD has11 and Map4 product command descriptors;
Animation/Sketch/IO/Vector do not yet expose product-specific MCP editing
catalogs. General document operations are not full application control.
See [coverage and remaining work](AGENT_COVERAGE.md) and
[the bridge contract](../../crates/automation-client/README.md).


## Native agent connection and command authority — 2026-10-11

Identity schema3 now stores hashed, scoped, expiring and revocable agent grants.
Native command routes use current identity/app/file authority inside canonical
Rust document transactions. The five general commands and browser Agent access
flow work without a Python host; product editing remains withheld pending native
product-owned workers. Explicit CLI/MCP operation IDs require advertised receipt
support and preserve canonical retries, without automatic replay after failures.

See `../../crates/server/NATIVE_AUTOMATION.md`. Evidence lives in
`.verification/framework-native-automation-2026-10-11/`. Recovery dumps exclude
sessions/recovery tokens/agent keys while retaining accounts and saved history.
This closes general automation authority; app services, native/offline integration,
company workload/farm qualification and final cutover remain incomplete.

## Installed Map product commands — 2026-10-11

The native host now accepts an explicit operator product-worker configuration.
Map's four existing saved-show commands reuse its packaged editor worker; Studio
keeps scope checks, content/history, guarded saves and atomic command receipts.
Access schema17 stores exact results so retrying a duplicate-clip command does
not generate another clip. Current authority is checked again after worker
execution, with no SQL locks held during product evaluation. CLI and MCP share
those receipts. The product worker and canonical catalog ship in Map's wheel.

See [installation and limits](../../crates/server/NATIVE_PRODUCTS.md) and
[remaining app coverage](AGENT_COVERAGE.md). CAD/browser product services, full
app/offline control, company/farm qualification and final cutover remain open.
Evidence is in `.verification/framework-native-products-2026-10-11/`.


## Installed CAD saved-part commands — 2026-10-11

All eleven existing CAD automation descriptors now run through native Studio,
CLI and MCP. The product packages its existing Node document operations and
FreeCAD adapter/worker in a hashed Python zipapp; no Python Studio host or Python
site packages are required for execution. Node/Python/FreeCAD paths are explicit
operator configuration. Current authority, guarded saves and exact operation
receipts remain in Rust. Validated no-ops check the current head and record a
receipt without adding a revision. The old Python service consumes the same
canonical catalog and execution module, preserving its existing behavior.

Real FreeCAD comparisons cover every command, including extrusion/revolve
preview/edit, topology, suppression and reordering. Native checks exercise
permissions, history restore, retries shared by CLI/MCP, no-op concurrency,
installed bundle integrity and Python-child cancellation/private-directory cleanup.
This completes the existing saved-CAD automation adapter, not browser CAD service
routes, full CAD feature coverage, provider sign-in or in-app agent tool access.
See `crates/server/NATIVE_PRODUCTS.md`; evidence is in
`.verification/framework-native-cad-2026-10-12/`. No installation cutover or push.


## Native CAD document settings — 2026-10-12

Native Studio now supports `cad_metadata` and these `cad_operation` actions:
`details`, `units`, `properties`, `delete_item`, `restore_item`, `rename` and `copy`.
The CAD-owned `CADDocument` codec is reused for both legacy and native paths.
Its units catalog is extracted at build time from CAD's fingerprinted shared-assets
archive and packaged in the wheel/zipapp, so it no longer imports Studio Python.
Project ZIP limits/checksums and installed-worker bounds also apply to settings.

The adapter reads an authorized immutable base, performs the product transform
outside SQL, then rechecks current authority when committing. Settings writes use
stable operation IDs and optimistic revisions; exact retries return the original
receipt. `save_named` is an additive protocol change that commits the embedded
CAD name and filename together in one revision, including on a named branch.
Protocol alpha10 is a new immutable local archive; existing client pins and wire
variants remain valid. No database schema change is needed.

Metadata reads recheck file/branch/account access after the worker. Linked-source
availability and latest revisions are projected under current source authority;
private source heads are omitted. Historical settings are read-only; authorized
readers can make a private copy. Copying does not transfer source access grants
or history. The browser keeps branch selection for settings and uses guarded
shared transport for writes; lost replies do not silently retry or reload drafts.
The internal `settings-read`/`settings-edit` worker services are not public CAD
HTTP routes or additional CLI/MCP commands.

`cad_operation` now also supports **move and update**. Main-file moves require
owner access and an editable folder in the same sharing location; folder state,
content revision, audit and retry receipts commit together through the existing
structural/storage authorities. A filename collision fails without moving the file.
Moving from a non-Main branch remains explicitly unsupported because folder
location belongs to the complete file, not one branch.

Updates reuse CAD's feature-format migration and linked-part replacement logic.
Studio resolves authorized source snapshots and verifies source heads and access
again at commit. Concurrent source changes return a conflict; exact retries return
the already committed result even if a source has since advanced. Replay still
requires current target/branch/source access. Branch updates leave Main unchanged.
Source accumulation is bounded by the existing 16 MiB worker-input limit before
dispatch; oversized batches fail without saving.
No database schema change, new public worker endpoint or new CLI/MCP command is
introduced. Map browser/show/device services, provider/tool coverage, full offline
apps, workload and final data/cutover gates remain open. No old-host fallback,
live installation cutover or push is performed by this slice.

Run `dev/rebuild/postgres_check.py --cad-settings-only` for the focused disposable
host and real React-dialog browser checks. The broader product and full native
suites include these tests. Settings evidence: `.verification/framework-native-cad-settings-2026-10-12/`; move/update qualification: `.verification/framework-native-cad-actions-2026-10-12/`.


## Native Map device control — 2026-10-12

Rust now owns Map pairing, player credentials, device ownership, assignment,
show delivery authorization and leased WebRTC signalling. Schema18 is additive;
legacy import refuses populated device tables until their conversion is qualified.
See [the device contract](../../crates/server/MAP_DEVICES.md). The unchanged Players
panel runs against the native endpoints; the product player stops cached output
on explicit authorization denial while preserving offline playback on network loss.
Media/export/provisioning services and real hardware remain cutover gates.

Qualification evidence: `.verification/framework-map-devices-2026-10-12/summary.json`.
Full native349, final focused devices14, compatibility156, cast/player39,
schema18 import/recovery47 and server-unit27 pass. The final focused pass includes
the last review's SQL lookup deadline tightening; full native was run immediately
before that bounded change. Clippy/format/package/installed-wheel/doctor pass;
five existing Map lint findings remain unchanged.

## Native Map media — 2026-10-12

Rust now serves the existing Map upload/read/delete routes with bounded streaming,
immutable filename bindings, private/shared-document access and assigned-show-only
Pi delivery. Schema19 retains media referenced by any native saved revision or
branch. Recovery's upload-manifest audit also verifies Map chunks and file hashes.
The Map browser adapter is unchanged. See [the contract](../../crates/server/MAP_MEDIA.md).

Run `postgres_check.py --map-media-only`; evidence is under
`.verification/framework-map-media-2026-10-12/`. Legacy asset ownership/history and paired-device transfer are qualified by the
following checkpoint; exports/provisioning, original-data review, physical hardware
and final cutover remain open. Original users, files and history have not been changed.


## Legacy Map media and device transfer — 2026-10-12

The offline importer now preserves Map assets, all history/branch media references
and qualified paired-device records into access schema19. It does not touch the
original installation, launch a replacement server or publish a repository.

Legacy uploads have no recorded owner. Before capture, an operator supplies a JSON
object mapping **every** filename in `map-media/` to an existing source user ID,
including unreferenced media. This explicitly assigns ownership; it is not a claim
about who originally uploaded the file. Referencing documents retain access through
their existing permissions independently of the selected asset owner. The decision
file is archived with the private snapshot and covered by its integrity manifest.
Do not substitute usernames, guess an administrator owner, or omit unused files.

```sh
.venv/bin/python dev/rebuild/legacy_transfer.py capture \
  --source /private/original-data \
  --destination /private/new-snapshot \
  --map-media-owners /private/map-media-owners.json
.venv/bin/python dev/rebuild/prepare_demo_target.py \
  --snapshot /private/new-snapshot --target /private/new-native-target
```

These are placeholder paths. Target preparation imports into an empty private
PostgreSQL instance, compares records, verifies immutable objects, dumps/restores
into another database, and stops both. Fresh browser login is required. The retained
original remains authoritative; a consistent final capture requires stopping writes
at the eventual qualified cutover. The tool refuses changing media during copying
or a changed media inventory, but cannot make an active legacy filesystem and SQL
transaction into one atomic point-in-time snapshot.

Each media file is streamed in1MiB chunks, limited to512MiB and copied without
following symlinks. Referenced but missing files, partial uploads, invalid names,
unknown/missing/extra ownership assignments and native capacity violations fail
closed. Empty-media older snapshots continue to work. The old host allowed media
overwrite; only surviving bytes can be transferred, never nonexistent old versions.

Claimed device owner/show bindings and unclaimed pairing codes survive. Bearer
secrets become hashes; the old installed player can authenticate, while native
current account/app/file authorization remains authoritative. Old devices without
a valid private pairing proof require re-enrollment before capture. The original
SQLite archive contains plaintext machine tokens and stays private. Cast sessions
are transient and are not imported; recovered machine credentials require the
operator's normal revocation review after restoring an older backup.

Qualification: `python -m pytest dev/rebuild/test_legacy_map.py`, also registered
in the full framework check. Covers immutable history including deleted branches,
private/shared media authority, cross-chunk HTTP ranges, installed credential
continuity/rotation/revocation, transaction rollback, private native backup/restore,
invalid source refusals, and a512MiB transfer with bounded Python allocation.
Evidence: `.verification/framework-map-transfer-2026-10-12/`.

Remaining gates include actual source ownership review, exports/provisioning,
physical Pi/offline/live-video qualification and the wider framework/release gates.
This checkpoint is not the full migration or Onshape feature parity.


## Native Map installation distribution — 2026-10-12

The Rust server now delivers the existing Pi installer, bundled setup script,
player/setup/receiver modules and authenticated built app archive. Map's product
builder emits a fixed manifest with file lengths/hashes; native startup verifies
and privately snapshots it. Downloads are bounded streams. Canonical server origin
sets the installer address; arbitrary Host/forwarding values cannot change it.
Browser/device authority is checked on app downloads, including current revocation.

Configure only an explicitly selected development/native installation with
`AETHER_NATIVE_MAP_DOWNLOADS`. See [the full contract](../../crates/server/MAP_DISTRIBUTION.md).
The original Python installation remains unchanged. No installer is executed as
part of verification. `test_map_distribution.py` is in the framework gate;
`postgres_check.py --http-only` runs the existing native HTTP boundary checks.
Evidence: `.verification/framework-map-distribution-2026-10-12/`.

Show-specific ZIP/SVG exports are now covered by `crates/server/MAP_EXPORTS.md`; physical Pi boot/network/offline/live
output and the wider framework/cutover/release gates are not completed by this slice.

## Native Map project exports — 2026-10-12

The ZIP/SVG compatibility gate is verified through the actual Map worker and
Rust HTTP host:108 checks, including128MiB media delivery and concurrent
authority/revision changes. See `crates/server/MAP_EXPORTS.md` and
`.verification/framework-map-exports-2026-10-12/summary.json`. External asset
search, hardware qualification and final installation cutover remain open.
