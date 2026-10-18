# Local server cutover

**Executed2026-10-12:** the Rust host now serves `http://localhost:8780`.
Both legacy authorities were stopped, captured and merged before activation.
The original LaunchAgent is disabled;8781 is retired. Two users,31 files,8 folders
and549 revisions are retained. Deployed Map/CAD opening preserves account/history
records. A native backup has also been created and independently restored.
The procedure and dated entries below retain the plan and implementation history.
Current paths/evidence/limits are in [CUTOVER_STATUS.md](CUTOVER_STATUS.md).

Read [the current cutover status](CUTOVER_STATUS.md) first. The 2026-10-12 audit
found unique accounts/files/history in both 8780 and8781. Final capture and
reconciliation must preserve both; the earlier single-source rehearsal is stale.

Jonathan authorized stopping the old server and starting the replacement after
framework integration is ready, then continuing the server-side web applications.
That local cutover is complete. The first-push hold remains separate and binding.

## Current observed authority (2026-10-10)

- Port8780 is `python -m core.host serve` launched from the preserved
  `/Users/jonathanjenkins/GITHUB/Aether Studio` checkout (with a space).
- Its open database is under
  `~/Library/Application Support/Aether Studio/studio.sqlite3`, with WAL files.
- New code lives in `/Users/jonathanjenkins/GITHUB/AetherStudio` (no space), with
  separate sibling app repositories. The development host on8781 is still Python.
- The Rust gateway on8879 forwards commands to an explicitly selected legacy host.
- The native host defaults to8880 with identity and optional authorized document
  operations. It has opt-in frontend hosting and installed product adapters;
  the latest combined app and restored-demo qualification is in CUTOVER_STATUS.
  Its process/schema health is **not** readiness to replace8780.

Recheck process, launch mechanism and data location immediately before deployment;
PIDs and working state can change. Do not kill a listener based on port alone.
Do not start a second authority on the production database.

## Exit gates before touching the running installation

1. Native host exposes existing browser status, account/setup/recovery/admin,
   app discovery/static assets and required product APIs with verified semantics.
   All migrated routes enforce user/app/team/document permissions, current session
   and service/agent scope. Unsupported features must not be silently exposed or
   omitted from the compatibility checklist.
2. Import supports the actual legacy schema and all installed product records.
   Preserve identities, references, ownership/shares, revision IDs, branches,
   named versions, documents, attachments and settings. Replay-safe imports and
   integrity reports must make omissions explicit and block cutover.
3. Rehearse from an isolated, consistent backup. SQLite's online backup mechanism
   or a fully stopped/checkpointed authority must capture the database; copying
   only its main file while WAL is active is insufficient. Capture referenced
   content/settings consistently, with a manifest and private permissions. Verify
   restore before depending on the backup. Never log credentials/content.
4. Build the independent apps and required services from the new repositories.
   Verify real sign-in, open/edit/save/reopen, revisions, access refusal, revocation,
   Map output controls and CAD native operations against the replacement authority.
   Migration tools/tests must not start hardware outputs or overwrite live data.
5. Run native and legacy contract acceptance, bounded concurrent HTTP/live-user
   checks, reconnect/conflict/recovery exercises and package boundary checks.
   No replacement route may redirect an unhandled write back to an old authority.
6. Define rollback explicitly. New stronger password hashes cannot be read by the
   old host. Before the first native write, the unchanged legacy captures can
   resume authority. After any native writes, preserve the native database/objects:
   use a compatible earlier native binary or back up the latest state, restore to
   a fresh target and repair forward. No native-to-Python reverse migration exists.
   Replacing new native data with the pre-cutover snapshot would lose user work.

## Switch, once gates pass

- Record the current supervised launch configuration and rollback command. Build
  and stage the replacement first. Do not edit old and new application copies.
- Enter a brief maintenance/read-only window, drain in-flight work, stop the old
  supervised process without letting it auto-respawn, and take the final backup.
- Import/verify into the new authority; bind8780 only after its own readiness checks
  pass. Verify the new process identity, checkout, database and static build.
- Walk the same authenticated app/data flows on8780. Watch errors and verify saved
  results from a second session; retain the old checkout and backup for rollback.
- Update runtime/status documentation with measured results and actual deployment
  configuration. Do not call the full framework done merely because a page loads.

Desktop applications reuse the React UI but require working local file/recovery
adapters and local engines. Server SQL/history/collaboration stays in Studio.
Desktop packaging can be qualified independently of this local web-server switch;
it does not erase the remaining full-framework gates or authorize a remote push.

## Rehearsed demo transfer

The dated notes below retain earlier stages. The current two-source settings4
rehearsal independently restores2 users,31 documents and549 revisions, verifies
all file heads/folders through native HTTP, and opens saved Map/CAD content for
both owners without changing accounts/history. Private configuration and actual
macOS service crash/restart also pass. See NATIVE_INSTALLATION.md and
CUTOVER_STATUS.md for current evidence; the final consistent capture is pending.

The actual demo now has an isolated native data copy and verified portable restore.
See [LEGACY_TRANSFER.md](LEGACY_TRANSFER.md). This satisfies an initial real-data
rehearsal, not all import/cutover gates: network/TLS settings and workspace asset
adapters remain. Server name/theme now have a native store, admin APIs and import. Account preferences now have a verified native import and API. Imported Drive attachment reads now have a bounded native snapshot
adapter, and a fresh snapshot is mandatory after stopping final writes.

Native Main history/read-revision compatibility now preserves source notes,
original timestamp precision and parent references. The earlier history rehearsal
uses access schema6 and passed exact annotation comparison and portable restore;
all514 editor rows also matched through HTTP in a disposable copy. This closes the
history-read gap only. Branch/release-lifecycle/collaboration adapters and
other unsupported routes still block full editor cutover. Older staged imports
need fresh re-import to recover annotations before their history panel is usable.


Private per-user workspace reads and legacy editor content restore are now native.
The actual demo's workspace file and12 restores were qualified in a disposable
copy. This closes those two route gaps only: mutable workspace storage, uploads,
product services, release lifecycle/branches/collaboration and remaining administrative
services still block complete app cutover. No original/staged target was modified.


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


## Native collaboration — 2026-10-11

Main comments/tasks/reminders/notes now have native routes and verified legacy
journal import. The latest schema8 staged target is
`native-20261011T062112Z-collaboration`; its portable SQL/object restore and exact
record comparisons pass. Earlier targets remain untouched. The source demo has
no collaboration records; the richer fixture covers both current state and deleted
item history. Live sync, branches, uploads and remaining app/admin/device/agent
services still prevent a complete replacement of port8780.


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
