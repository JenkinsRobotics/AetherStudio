# Local server migration completed — 2026-10-12

This is the current deployment record. Older chronological notes in README,
LOCAL_DEVELOPMENT and NATIVE_HOST are implementation history, not a count of open
work. This checklist does not change the full-framework first-push gate.

**Local replacement is active at `http://localhost:8780`.** Both Python listeners
were stopped on2026-10-12 after confirming their process identities and no active
connections. Final captures were merged under the original sign-in, imported into
private PostgreSQL and independently restored before activation. The old launch
agent is persistently disabled;8781 is retired. macOS LaunchAgents supervise the
native database/server after login. Old data and source checkouts remain intact.

The deployed authority retains 2 users, 31 files, 8 folders, 549 revisions, 388 blobs,
5 Map media manifests and both attachment/workspace asset sets. All file heads and
folders verified through native HTTP. The final live browser check opens the actual
Cube Test/Map and CAD editors for both owners, including the saved seven-feature
CAD solid, with zero page/API errors. Accounts and document history remain unchanged.
Temporary verification sessions are removed. Original password hashes are retained;
interactive sign-in with the user's actual password was not exercised. Fresh
sign-in is required because old sessions are intentionally not transferred.

The frozen Rust release passed369 ordinary document checks, both512MiB transfers,
21 storage checks, combined built-app flows,500-user bounded load and restored-data
qualification. The first deployed browser run found a transient429 during cold
editor startup; a subsequent traced run opened all four imported editors without
errors and measured one CAD request at1.16s. Visual review then found that the
CAD shell check had returned before geometry completed. The tightened browser
gate waits for actual parts and the rebuild overlay to disappear. It exposed a
503 caused by the two-worker pool rejecting a third overlapping startup request.
The correction admits at most8 product requests with2 executing and a10s bounded
wait. HTTP admission retains20 total document slots,4 regular handlers and a
separate4-handler pool for history/discussion reads; its burst wait is2s.
All 9 admission tests and the final 45 product checks pass. The full repeat ran
366/369 successfully; the three failures were two stale Map catalog expectations
and a non-atomic test PID handshake, all corrected and covered by those final
45 checks. The earlier complete 369-check baseline and both large transfers remain
separate evidence; the repeat is not relabeled as a full pass.

Live launchd qualification exposed a second difference: `ProcessType=Background`
throttled the host and its child CAD workers, causing a roughly 38-second geometry
failure despite successful foreground qualification. The operator plan now uses
Interactive scheduling for user-requested HTTP/SQL work, retaining bounded queues
and process deadlines. `rehearse_imported_apps.py --launchd` now tests the real
supervised server, waits for rebuilt geometry and verifies unchanged stored data.
It passes with both the original frozen frontends and the latest UI72 snapshot.
The final live geometry calls completed in 566ms and 357ms; these two observations
are smoke-check timings, not a performance benchmark.

Current generation: `service-interactive-20261012/service-generation` under the
private native installation directory. Binary SHA256:
`02d794385461ecf64705af2853c78d3dc252817fd37c9fc31876adfb21d6eb48`.
The server runs as an Interactive LaunchAgent. The existing database process was
retained; its original job was not restarted during this correction. The separate
UI72 frontend promotion is preserved. The live marker identifies the exact binary,
configuration and data paths. All temporary browser sessions have been removed.

The first post-switch native backup was independently restored into a stopped
private target. Recovery after new writes must preserve native SQL/objects; do not
resume an old snapshot as the authority. There is no reverse migration to Python.

Private operational records: `~/Library/Application Support/Aether Studio Native/`
contains `current-installation.json` and `cutover-context.json`; the final captures
are under `Aether Studio Migration/cutover-20261013T054603Z`. Frozen frontend/product
snapshots contain31,824 files. Original and development `agents/` directories were
empty. Official Claude2.1.286/Gemini0.62.0 runtimes and isolated version checks are
installed;3 adapter fixture suites pass. Actual subscription sign-in and inference
remain unqualified. No external provider account was connected or billed.

Current development entrypoint: `.venv/bin/python dev_server.py` reports the native
installation and cannot silently reopen `.dev-data` through Python. Use
`AETHER_DEV_SERVER=http://localhost:8780 npm run dev` for app hot reload. Working-tree
builds do not replace the installed frozen snapshot automatically.
The target here is replacing the hosted server while preserving the existing apps.
Desktop signing, new CAD features and physical Pi certification remain separate
release gates; they must not be misreported as complete after server cutover.

## Completed cutover work and historical gate detail

The numbered sequence below records the qualification work leading to the switch;
its earlier "final capture pending" references are superseded by the state above.

1. **Studio administrative compatibility.** Source audit of `core/host/server.py`
   against `crates/server/src/native/` now has qualified adapters for the remaining administration endpoints:
   - Storage/backup: native consistent snapshots and actual merged-demo independent
     restore pass. Browser creation/download and persistent schedules are now
     qualified by actual HTTP/browser and schema-upgrade tests: `/api/admin/storage`,
     `/api/admin/backup`, `/api/admin/backups/{name}`. A verified operator restore command now restores into a new stopped target. External-folder delivery remains separate operational work.
   - Network configuration/lifecycle: `/api/admin/settings`, `/api/admin/restart`.
     Operator-configured native HTTPS and browser edits/restart are qualified.
     Candidate sockets/certificates are validated before interrupting the current
     listener; saved per-installation settings and operator recovery are tested.
     Private configuration, immutable local service generations and actual macOS launchd startup/host-crash/database-crash recovery now pass against a restored merged demo. The combined built-app fixture and imported Map/CAD browser opening also pass; final capture/cutover remains required.
   The application enable/disable adapter `/api/admin/apps` has now been added
   over the native authority, including UI enablement without changing its admin-only
   catalog rule. Team and application restriction writes now also use native transactions, with a
   redacted directory at `/api/v1/admin/directory`. `/api/admin/state` now connects
   the actual admin frontend to these services, keeps disabled apps manageable,
   and declares unsupported operational adapters explicitly. Native setup and
   mail/recovery routes pass real browser qualification. Maintenance reports the actual
   native runtime and tenant counts. Service accounts use scoped native command
   credentials (365-day maximum, explicit write permissions), including CLI/MCP
   and isolated Animation RPC. Credentials retain current creator permissions,
   are never browser sessions, and are revoked by password resets. The browser
   create/use/revoke flow passes; a token-display refresh bug was fixed.
   Settings schema2 keeps SMTP secrets outside SQL backups; identity schema4 adds
   service credential classification without replacing existing agent keys. These
   administration paths now have qualified native implementations. Operator-specific
   secret provisioning, final deployment and external backup delivery remain separate.
   Native lower-level account/access/directory/settings services already exist;
   reuse those authorities. Do not stand up a second SQL writer or pass unhandled
   writes back to the old server. Presence of a new route alone is not acceptance:
   preserve permissions, retry/concurrency behavior and the actual admin UI.
2. **Remaining app compatibility audit.** Map search is now implemented alongside
   its previously verified device, media, distribution and export routes. CAD
   saved commands and browser services have separate evidence. Animation now has an optional native-owned installed-product worker: isolated
   session handles, workspace byte roundtrips, current access checks and bounded
   execution are tested. Private workspace file saves now retain imported originals and all later
   versions with hash guards, audit rollback and restart tests; the actual browser
   Animation client passes load/pose/serialize/save/reopen and stale-save refusal. Filesystem
   workspace RPC now uses confined versioned byte storage with private owner paths and hash guards. Raster/media rendering now uses bounded private asset bytes with the existing product compositor. Actual image/video/GIF/sprite/bitmap/procedural and matrix tests pass; native browser decoding, owner isolation and resource/path refusal are verified. Supported media/container and allocation limits are explicit; this is hosted preview compatibility, not hardware-output certification. Keep the current product engine during
   host migration; this does not require rebuilding its semantics in Rust first.
   Claude/Gemini now have optional native-owned official-CLI protocol adapters.
   Provider10 native checks,4 unit checks,2 adapter suites and the combined Plugins
   browser flow pass with local fixtures. Connections, settings, cancellation and
   cleanup remain isolated per provider; prior ChatGPT state is preserved. Actual
   provider accounts require separate reconnection and real subscription testing.
3. **Reconcile both live data stores**, including accounts, documents, branches,
   history, permissions, media, workspace assets and settings. See inventory below.
   Existing importer support and old single-source rehearsals do not satisfy this.
4. **Combined acceptance** against the staged target: A native synthetic fixture
   now passes500distinct users/500live subscriptions,1,500guarded saves and4,500HTTP
   status/save/read requests with eight concurrent edit workflows, private access
   denial, live revocation and reconnect. This is not a full app/LAN performance
   certificate and does not resolve the prior save regression. The combined eight-app
   browser fixture now passes app discovery, original-format sign-in, Map save/reopen,
   history/branches/releases, Drive workflows, access/revocation, agent grants and
   reconnect/draft retention; installed Animation rendering passes alongside it.
   A fresh independent restore verifies all31 imported files and8 folders over
   native HTTP and opens the largest saved Map/CAD files for each owner, including
   the Cube Test scene and a seven-feature CAD part. All549 revisions and account
   records remain unchanged. Temporary sessions avoid changing original passwords;
   original-password interactive sign-in is not claimed. Full app/LAN performance
   and the final deployed installation are still unqualified.
   Preserve raw results; a burst with admission refusals is not a claim of hundreds
   of simultaneously productive users. Repeat the matched server A/B workloads.
5. **Operational rehearsal and switch.** Verify startup/supervision, private native
   configuration, database/object backups and independently restored data; define
   rollback after new writes without discarding those writes. Drain writes on
   both legacy authorities, take final consistent captures, import/verify, then
   replace the original listener and verify actual browser flows. Retain original
   checkout/backups. Local cutover is authorized once these gates pass; remote push
   stays held. See `LOCAL_CUTOVER.md` for the operational sequence.

## Data discovered during the shutdown audit

Read-only inventories on 2026-10-12:

| Authority | Users | Library entries (documents and folders) | History records |
| --- | ---: | ---: | ---: |
| Original 8780 | 1 | 19 | 518 |
| Development 8781 | 2 | 20 | 31 |

There are **zero shared library IDs**. One username exists under different user
IDs. The prior 18-entry/516-revision original rehearsal is stale. Neither database
may overwrite the other. All 39 current entries and both histories must be accounted
for, plus later writes. Account consolidation needs an explicit identity mapping;
matching username text alone does not authorize combining accounts/permissions.
Jonathan explicitly selected **combine under the original sign-in**. An offline
reconciliation now maps that development user to the original user ID and keeps
the original credential hash. The other development user stays separate;
development organization/workspace IDs remain separate to preserve access.

A verified two-source staged import on 2026-10-12 contains **2 users,39 entries,
549 revisions,388 content blobs,5 Map media files,2 Map media reference bindings,
2 attachment files and2 workspace asset files**. Original application policy was
selected explicitly (Sketch enabled there, disabled in development). Both source
snapshots and the identity mapping are retained privately. Native integrity,
exact records and an independent database/object restore passed again at access21/identity4/settings2. The native operator backup also
restored all549 revisions independently with401 verified snapshot files. Settings3
adds backup policy; settings4 adds per-installation network configuration.
Both upgraded independent restore rehearsals pass. The final
quiesced capture and deployed-binary acceptance remain required before cutover. Evidence is private under
`~/Library/Application Support/Aether Studio Migration/dual-source-20261012T221210Z`.

This is a point-in-time rehearsal while both sources remain live, not the final
quiesced capture. The merger refuses shared document IDs, asset path conflicts,
ambiguous account mappings and unsupported populated tables rather than skipping
them. New changes may require further reconciliation. Original-password browser
sign-in has not been exercised; preserving the credential hash is verified.

This inventory used separate SQLite read transactions with query_only enabled.
It contains no credentials, names or document content, and is **not** a consistent
cross-server backup. No live server or database was modified. Evidence:
`.verification/framework-cutover-audit-2026-10-12/live-source-inventory.json`.

Repeat the aggregate inventory before rehearsal with
`dev/rebuild/cutover_source_inventory.py --original <original-sqlite> --development <development-sqlite>`.
It refuses nonexistent/symlink/duplicate source paths and never writes to either
authority. Its readiness flag is always false: inventory is not reconciliation.


## Latest acceptance packet

The latest complete native run passes369 ordinary document integration checks plus both
optimized512MiB transfer checks. A separate500-user/500-subscription fixture
passes1,500guarded saves and4,500HTTP status/save/read requests with eight editing
workflows in parallel. These are separate scoped checks, not a count of500
simultaneously executing CAD/Map computations.

The focused packet also includes native network6 (actual browser and executable),
settings5, backups6, mail6, Animation4 (actual browser and private binary files),
workspace storage5, TLS transport3 and migration75. These subsets overlap with
the full suite and must not be added to its count. Studio build, Clippy, targeted
formatting and Python lint pass. The merged demo's settings4 backup independently
restores2users,31documents and549revisions with401verified snapshot files.
Raw failing exploratory runs and corrected passing results are retained in
`.verification/framework-native-admin-2026-10-12/` and the later
`.verification/framework-native-media-operations-2026-10-12/`. The latter adds
confined Animation product48/native6, network6, private installation config2/tool10,
actual launchd crash recovery, combined browser and imported-app evidence. Counts
overlap with the full suite; do not add them together.

The latest matched API A/B has zero request errors and correct readback. At16
concurrent requests, original/native median trial p95s were64.54/13.45ms for reads
and79.29/287.38ms for saves. Investigation identified expensive Apple full-drive
flushes in Rust file synchronization, alongside stronger native SQL durability.
A directory-cache experiment was removed because it did not establish a useful
gain; final code retains full file and ancestor-directory flushing. Saves still
regress. This is one account on loopback, not a company-load certificate. Step4
therefore remains partial even though the bounded regression/capacity tests pass.
See `SERVER_AB_RESULTS.md`.


## Frozen local replacement candidate

A private frozen runtime contains all eight frontend builds, shared assets,
Map/CAD bundles, Animation archive and player downloads (31,824 files/334,555,998
bytes). Node/Python/FreeCAD remain explicit external executable dependencies.
The exact release binary and frozen adapters independently imported/verified
both demos and opened all31 files/8folders without changing accounts or549history
records. A second restored-copy browser run also passed. Runtime staging refuses
source changes, symlinks, corrupt bundles and overwriting generations.

The committed-revision notification path passes rollback, two-host delivery,
reconnect, revocation and listener cleanup. The500-user optimized workload's p95
save and post-response visibility lag are155.52ms and4.41ms respectively. Durable
saves still trail the weaker legacy implementation; the measured tradeoff is
recorded in SERVER_AB_RESULTS, with the unproven optimization removed. Local
compatibility and bounded-operation checks are qualified. Office-network/full-app
performance and full-framework release remain separate from this local switch.
Final quiesced captures, exact re-import and installed-service verification are
the remaining local actions. Existing sign-ins need fresh sessions after switching.


### 2026-10-12 — Icon controls promoted to the live native installation

User reported CAD still served old tooltips/hover sizes. Confirmed deployed r2
used r1 frontend snapshot. UI72 additionally centers text controls after actual
CAD inspection found Share/workspace labels top-aligned. All8 frontends adopted
immutable UI72 and rebuilt; shared gallery built,8 focused chrome tests pass.
Actual compiled CAD with stubbed backend verifies Appearance/Apps/More each55px
high at header top0; Share28px centered at13.5px. Screenshot/logs:
.verification/icon-cells-live-2026-10-12. Stubbed backend's missing branding request
is a fixture limitation, not claimed full authenticated document acceptance.

Staged verified runtime-v2 under private frontend-icons-20261012, copied server
configuration and changed ONLY AETHER_NATIVE_FRONTENDS. Native binary, product
workers, all data paths and the running PostgreSQL job remain unchanged. Server
LaunchAgent and current-installation pointer now use this new configuration.
Initial immediate bootstrap hit launchd's asynchronous removal delay; restored
registration then retried with bounded registration waits. Final health200 and
served account.css exact-byte check pass. Unauthenticated product assets correctly
return401; no claim of authenticated live browser acceptance. Previous config,
LaunchAgent and frozen frontend retained for rollback. Users must reload open
tabs on localhost:8780;8781 is retired. This also deploys the shared status footer.


### 2026-10-12 — shared tool tray scrolling / UI73

WorkspaceRibbon density labels are exactly Compact, Standard, Expanded. All
three use ToolTrayScroll: bounded horizontal overflow, native non-passive wheel
handling (horizontal or vertical wheel; pinch zoom preserved), endpoint arrows,
and focused viewport Left/Right/Home/End navigation. The implementation is shared
by suite consumers rather than copied into CAD.

UI73 immutable package adopted by Drive, Studio, CAD, Map, IO, Sketch, Vector and
Animation. All eight frontend typechecks/builds passed; UI typecheck, gallery
build and 20 targeted tests passed. Actual compiled CAD with stubbed APIs verified
horizontal wheel, right arrow and End in all three densities (end extents 1502,
739,1502px). Fixture branding404 remains; this is not authenticated live document
acceptance. Evidence: .verification/tool-tray-2026-10-12/.

Frontend-only snapshot promoted to private tool-tray-20261012/service-generation.
Preserved the concurrent Interactive native service binary, workers, database,
data paths and pointer metadata. Only frontend manifest/config location changed;
server restarted, PostgreSQL remained running. Health200 and served shared CSS
byte match passed; previous generation retained for rollback. Reload localhost:8780
tabs to load the new frontend. No legacy checkout edits or remote publishing.

Selection frontend promoted to selection-tray-20261012/service-generation.
First attempt rejected a nonprivate configuration directory and automatically
restored the prior registration. Corrected directory to0700; second promotion
passed health200 and shared stylesheet byte verification. Only CAD frontend
changed; native binary, other frontends, workers and PostgreSQL/data unchanged.
Previous generation retained. Reload localhost:8780 for the new Select tray.

Project tray frontend promoted to private project-tray-20261012/service-generation; health200 and served bootstrap stylesheet byte check pass. Only CAD frontend changed; native binary, workers, database and other app frontends preserved. Reload localhost:8780. Previous generation retained.

Contextual tabs frontend promoted to context-tabs-20261012/service-generation (runtime-v3). Health200 and served stylesheet byte check pass. Native binary, database, workers and other frontends unchanged; previous generation retained. Evidence: .verification/context-tabs-2026-10-12. Reload localhost:8780.

Solid groups frontend promoted to solid-groups-20261012/service-generation. Health200 and served shared stylesheet byte check pass. Native binary, workers, PostgreSQL/data and other frontends retained; previous generation preserved. Reload localhost:8780.

Construction frontend promoted to construction-20261012/service-generation. Health200 and served stylesheet byte check pass. Native binary, workers, PostgreSQL/data and other frontends preserved; previous generation retained. Reload localhost:8780.
