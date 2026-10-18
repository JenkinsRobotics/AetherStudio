# Original demo data transfer

The operator migration is separate from the application runtime. It uses Python's
existing SQLite reader and PostgreSQL tools once; the destination uses the Rust
identity/document authorities. It does not add SQLite/Python to the native server.

## Verified local copy — 2026-10-10 Pacific

The real demo was captured through SQLite's read-only online backup interface,
including committed WAL contents. The original database, server and checkout were
not changed. The private snapshot is outside Git:

`~/Library/Application Support/Aether Studio Migration/demo-20261011T062112Z/`

The stopped native target and portable recovery set are beside it:

`~/Library/Application Support/Aether Studio Migration/native-20261011T062112Z-history/`

| Data | Verified result |
| --- | --- |
| Users | 1; same ID, username, password hash, role, active/reset flags, name, email, appearance, personal theme and avatar |
| Library | 18 entries: 14 documents and 4 folders; IDs, names, ownership, location, parent, trash state preserved |
| Revisions | All 516 Main revisions; exact content bytes/hashes, revision numbers, names, authors, events, notes, original seconds and parent references |
| Content objects | 358 verified content blobs |
| Access | Organization/workspace membership, enrollment, app restrictions and existing grants transferred |
| External assets | 2 Drive attachments and 1 workspace file copied and hashed |
| Recovery | Portable PostgreSQL dump restored to a second database; copied object storage passed Rust integrity verification |

The native target is **not running and not authoritative**. Its `transfer-report.json`
and `recovery-manifest.json` contain results and recovery hashes. Its `native.sql`
contains private accounts/documents: never commit or upload it. The original
snapshot contains credentials and old session tokens and must remain private.
Both roots and their subdirectories are mode0700; created content/report files are mode0600.

## What is active versus retained

Accounts, Main and validated branch documents, folder locations, permissions and
revision records are imported into native tables. The account hash is copied exactly;
fixture tests verify sign-in using the original password through the Rust HTTP API.
Real user passwords were neither requested nor printed. Existing sessions and
recovery tokens are not activated: sign in again after a future cutover.

Attachment and workspace bytes are retained under `legacy-assets`, but native
workspace delivery APIs remain unfinished. Imported Drive attachments now support
authorized native download/preview using the explicit private attachment root
described in `../../crates/server/NATIVE_HOST.md`. New native uploads use the
schema14 chunk/manifest service described in `../../crates/server/UPLOADS.md`;
in-flight uploads from the old server still cause import refusal. Account theme/avatar preferences are imported into identity
schema2 and available through native account APIs. Server name/theme and original history annotations are native; network/TLS settings, complete source audit context and every original SQLite table
remain in the private recovery snapshot; not every legacy setting has a native
runtime adapter yet. These are **cutover blockers**, not silently discarded data.

Legacy seconds are converted to native integer milliseconds for document revisions;
the original precision also remains in access schema6 import annotations. Import operation IDs are
synthetic and deterministic. Events use `history_backfill` in document/revision
order, not an invented cross-document chronology. Folder structural history is an
explicit retained-state baseline; unavailable old individual moves are not invented.

Nonempty service/device registrations and incomplete uploads cause import refusal.
Branch histories with unprovable origins, reused/discontinuous names or unresolved
comment aliases are refused for operator review. Share links use the qualified
credential/provenance adapter described below. Invalid account
themes/avatars are also refused, never silently replaced.
Those tables were empty in this demo. Missing/gapped history, mismatched head bytes,
corrupt/missing attachments, dangling locations and unsafe paths also cause refusal.
This importer is qualified for this schema and the branch cases documented below,
not every future or historical Studio dataset. The original complete database remains the recovery source.

## Reproduce safely

Build `aether-native-host` and install the existing PostgreSQL development tools.
Do not point preparation at an existing native database or object directory.

```sh
.venv/bin/python dev/rebuild/legacy_transfer.py capture \
  --source '/absolute/path/to/original-data' \
  --destination '/absolute/private/path/to/new-snapshot'
.venv/bin/python dev/rebuild/prepare_demo_target.py \
  --snapshot '/absolute/private/path/to/new-snapshot' \
  --target '/absolute/private/path/to/new-native-target'
```

Preparation creates a dedicated PostgreSQL cluster with no TCP listener, an
explicit private Unix socket, fresh native schemas and object storage. The cluster
is stopped on exit. Stored configuration disables both default network listeners
and default socket directories; a later operator start must explicitly provide a
private socket. Native schema checksums are checked before import. SQL metadata
is committed in one transaction into an empty database; failure cannot partially
import users/files. Flushed immutable objects may remain after a failed SQL import;
retain the failed target for diagnosis and use a new target for the next attempt.
Never retry by overwriting existing target data.

The script compares source-derived records and calls the Rust `verify-store`
operator command, creates a portable dump, restores it to another database, and
verifies copied objects again. Success is published only after clean shutdown.
No HTTP import endpoint is added and no production service is stopped/started.

`test_legacy_transfer.py` uses disposable legacy and native servers to exercise
read-only capture, credentials, inherited read-only access, private-file refusal,
attachment preservation and authenticated native full/range download, corruption and unsupported-history refusal, occupied-target
refusal, SQL rollback and dump/object restore. It is part of the framework gate.

## Final switch-over still required

This is a point-in-time copy. The original remains writable and can change after
capture. When the framework/API gates pass, stop/drain original writes and capture
again into another fresh target. Reverify against that final snapshot before
switching authority. Keep the old installation and recovery set. Do not restore an
old snapshot after new native writes without reconciling those writes first.
See `LOCAL_CUTOVER.md` for the remaining deployment gates.

### Verification evidence

Local aggregate evidence is in
`.verification/framework-transfer-2026-10-10/actual-demo-report.json` and the
migration test log `transfer-final.log`. The actual target passed a native database
restore and object audit; an independent pass rechecked recovery-manifest hashes,
attachment hashes, directory/file privacy and the stopped state. The earlier
`native-20261011T062112Z` rehearsal is retained; the later `-verified` target includes complete folder baseline state. The subsequent
`-preferences` target additionally retains native account preferences and
has independently passed comparison and portable restore. All earlier targets
remain available. No source/demo records were edited.

The full incremental framework gate passed after the transfer changes: Rust70,
private PostgreSQL/HTTP92, Python102 (including seven migration tests), shared
session20, browser file13 plus real Chromium recovery, and 512 policy comparisons.
Strict formatting/lint and generated-package checks passed. The full application
migration/release gates remain open; this is not a readiness declaration.


### Native attachment qualification

A separate disposable import now verifies both original attachment revisions
through the Rust download API: 7,340,130 bytes matched the preserved source;
partial requests and anonymous refusal passed. Synthetic sessions existed only in
that disposable database, with no source password/session changes. The previously
prepared stopped target and original installation were not started or modified.
Evidence: `.verification/framework-downloads-2026-10-10/actual-demo.json`.
The regular migration fixture also signs in with the original fixture password
and checks full/range download plus private-file refusal after import.


### Account preference transfer qualification

The latest stopped target uses identity schema2. Exact native record comparison
and dump/restore now include theme, theme_id and avatar for the original account.
The immutable source snapshot remains the same; all516 Main revisions and358
content blobs are retained. Evidence:
`.verification/framework-preferences-2026-10-10/actual-demo-report.json`.
The migration fixture signs in with its original password, reads the imported
preferences through native status, changes only appearance and verifies the
personal theme/avatar survive. Unsupported account values refuse the import.


### Server display settings transfer — 2026-10-11

Imports now preserve the source server name and base/per-app themes in Studio's
separate `aether_settings` schema1. Both initial import and dump/restore compare
these records exactly. Snapshot format1 remains readable without changing old
immutable projections: settings are extracted from the verified SQLite archive.
Invalid names/themes refuse capture/import instead of silently replacing them.
Network addresses, TLS paths, public URL and other settings remain in that archive;
no listener or production configuration is changed.

The importer accepts only a fresh native database with exactly its untouched default
tenant settings row. Configured settings, other tenants, settings audit entries
or existing accounts/documents refuse import. Settings replacement occurs inside
the same transaction as users/files/history. Failed imports roll back the initial
settings as well. The launcher checks settings schema/checksum before import and
restored-data verification.


The server-settings rehearsal target is `native-20261011T062112Z-settings` beside the
preserved preferences and earlier targets. It passed exact record comparison,
native integrity verification and portable dump/restore with all516 revisions.
Its362 recovery files have verified hashes and private permissions. Evidence:
`.verification/framework-settings-2026-10-11/actual-demo-report.json` and
`recovery-check.json`. The original server remains authoritative.

### Original history annotation transfer — 2026-10-11

Access schema6 imports each revision's original note, floating-point seconds and
parent reference alongside its canonical native revision. Initial import and
portable restore compare all516 annotations exactly. Frozen snapshot format1 is
still readable; the preserved source is neither rewritten nor pruned. Earlier
staged targets stay retained. They require a fresh import to recover annotations;
an empty schema upgrade alone cannot restore original notes.

The earlier schema6 stopped target is `native-20261011T062112Z-history`. It passed native
integrity checks, exact record comparison, portable restore and independent
verification of362 private recovery files. In a separate disposable import, all514
editor history rows across12 documents matched the original fields through the
native HTTP API. Twenty-four first/latest revision previews matched36,597 bytes
and left history unchanged. The remaining two Drive attachment revisions use the
separately qualified download API. Synthetic sessions existed only in that test
copy; neither the prepared target nor the original received test credentials.

Evidence: `.verification/framework-history-2026-10-11/actual-demo-report.json`,
`actual-demo-http.json` and `recovery-check.json`. The fixture also compares history
and historical reads directly with responses from the original Python host.
Main history reads and content restore now work natively; branches, release lifecycle
and collaboration still require adapters. Unsupported source branches
are refused, never omitted during import. No server cutover occurred.


### Private workspace delivery and restore qualification — 2026-10-11

Native serving can now opt into the preserved per-user workspace tree using
AETHER_NATIVE_WORKSPACES. The actual demo's one2,295-byte workspace asset matched
through the authenticated native route, including its SHA-256 revision header;
anonymous access was refused. Imports still preserve these bytes outside SQL.
The existing stopped history target remains unchanged; no new target was required.

In a separate disposable import, all12 editor documents restored their first
revision through the legacy-shaped native endpoint, retained current names and
all previous history, and safely replayed the same request. Native integrity then
verified528 revisions (516 imported plus12 test restores). Synthetic test sessions
and those extra revisions existed only in the disposable copy, which was removed.
Evidence: .verification/framework-workspaces-2026-10-11/actual-demo.json.
This does not broaden the source importer's accepted branch/version/event shapes.
Native uploads, mutable workspace files and product services still require work.


## Named checkpoint preservation — 2026-10-11

Access schema7 now imports Main checkpoint names, referenced revision IDs, authors,
original timestamp precision, messages, statuses, origins and status notes. These
are separate from autosave revisions. Labels are extracted from the verified
SQLite archive after frozen projection comparison, so existing snapshot files and
hashes remain unchanged. Unknown fields/states, invalid references or values,
non-Main checkpoints and more than1,000 labels per document refuse explicitly.

The migration fixture now includes a released checkpoint and verifies exact history
HTTP output, home counts, protection against deletion, import rollback and portable
SQL/object recovery. The retained actual demo has no named checkpoints; its new
stopped schema7 target is `native-20261011T062112Z-versions` alongside the older
rehearsals. It retains1 user,18 entries,516 revisions and358 content blobs, with
successful exact record comparison, integrity and dump/restore checks. Native
workspace serving is opt-in private snapshot delivery; uploads/mutable assets,
branches, release lifecycle and remaining product/admin services still block cutover.


## Collaboration preservation — 2026-10-11

Access schema8 imports Main discussion state and its complete item journal. The
adapter replays the old event sequence, checks each before-state and compares the
reconstructed final state before writing anything. Invalid/missing events, unknown
fields, invalid authors/references, unsupported branches and oversized states stop
the import. Deleted text and images remain in before/after history; source IDs,
item order, assignment, dates and timestamp precision remain unchanged. Native
retry receipts are not fabricated for imported operations. Frozen projection.json
and already captured recovery manifests are unchanged.

The expanded fixture includes seven real legacy operations covering comments,
replies, deletion, a named checkpoint/image reference, a task update, notes and a
reminder. Exact native collaboration output matches the old server; a new native
comment and its retry work after import. All normalized rows are compared after
both import and portable dump restore. Thirteen damaged-history cases refuse capture.

The actual demo's new stopped target is `native-20261011T062112Z-collaboration`,
under the same private migration directory. It preserves1 user,18 entries,
516 revisions and358 blobs. Its collaboration tables are empty, matching the
source; richer collaboration compatibility comes from the fixture above. Existing
staged targets and the original installation are unchanged. This closes Main
collaboration data/API gaps only, not branch/live-sync or full cutover readiness.


## Personal workspace preferences — 2026-10-11

Explicit access migration9 adds per-user workspace favorites, last-opened timestamps,
preference revisions, replay receipts and a before/after journal. No document content,
file revision or recent-file history changes. POST `/api/drive/workspace_favorite`
requires workspace, favorite:boolean and operation_id; `/api/drive/workspace_open`
requires workspace and operation_id, with server-assigned monotonic opened time.
Unknown fields/types are rejected. Actor identity always comes from the session.

Current Drive and workspace permissions are checked inside the locked transaction,
including exact retries and queued requests. Reusing an operation ID for different
arguments conflicts. Exact retries return the original applied_revision and
replayed:true with a freshly authorized workspace directory, preserving newer
preferences and withholding newly hidden workspaces. Audit, journal, receipt and
preference writes commit together; directory overflow or audit failure rolls back.
The existing 1,000-visible-workspace bound remains explicit rather than truncating.

Session alpha37 supplies stable operation IDs and uncertain-write handling for both
workspace actions, retaining compatibility with the original Python response shape.
Studio, CAD, Map and Drive use this immutable archive and UI29. The library emitter
now supports root transport declarations without emitting stray source-tree files;
Drive's test runner transforms shared TypeScript like the other app consumers.
The base Studio stylesheet loads before the Drive layout to preserve its grid.

Focused native7, import38 plus preference-validation10, old-host2, session29 and
Drive4 tests pass; all four consumers build. Real-browser account, release, collaboration and Drive preference controls pass,
including favorite reload persistence, workspace open and geometric layout checks
after the stylesheet-order correction. Full schema9 regression passed: Rust88, database/HTTP150, legacy Python158,
shared client29, browser files13 and real file-recovery qualification. Evidence is
`.verification/framework-workspace-preferences-2026-10-11/`.

Legacy preference values are validated against their original users/workspaces and
imported at revision0, without fabricating events. Frozen snapshot projections and
schema1–8 checksums remain compatible. The new private, stopped actual-demo target
is `~/Library/Application Support/Aether Studio Migration/native-20261011T062112Z-workspace-preferences`:
1 user,18 entries,516 revisions,358 blobs, portable dump/restore and exact comparison
passed. The actual snapshot has0 workspace preferences; a nonempty test fixture
qualifies preference preservation and subsequent native writes/retries.
Original8780 remains authoritative. No push, deployment or production data change.


### Native Drive listing and exact imported file timestamps — 2026-10-11

Drive personal/workspace/recent/search listings and folder navigation now use the
native resource, document and permission authorities. Results include actual
attachment sizes/hashes without downloading attachment bytes; browsing does not
record a file open. Responses have bounded scans, duration and size and refuse
partial success. Favorites/shared/recycle/activity remain explicitly unported.

Actual-demo testing exposed two legacy details absent from the first fixture:
CAD/Map-labelled folders and file timestamps distinct from revision-save times.
Folders retain their app identity and permission checks. Access schema10 keeps
immutable imported file timestamps separately from unchanged revision history;
new saves retain original creation time and use their new modified time. Prior
schema checksums remain unchanged; explicit upgrade is transactional and repeatable.
The richer import fixture now covers both original behaviors.

Focused native10/import41 tests and built-browser Drive listing passed. The real
18-entry demo listing matches names/IDs/locations/permissions, attachment metadata
and timestamps while preserving516 revisions. A new stopped recovery target
`~/Library/Application Support/Aether Studio Migration/native-20261011T062112Z-file-metadata`
passes dump/restore and362 portable-file hashes. Full regression is still running;
see `.verification/framework-drive-listing-2026-10-11/`. The original8780 process
continues unchanged; no cutover or push. These gates do not establish full app readiness.


### Drive qualification completed — 2026-10-11

Native listing10/opening5, exact demo metadata/516 revisions, schema10 dump/restore
and362 recovery hashes pass. The composed gate covers165 unique database/API
checks: store12/identity10/HTTP6 and137 documents. Initial document run passed136;
the one new cross-app fixture had not enabled CAD. The corrected fixture and all10
listing tests pass without a production change for that failure. Later original
gate stages passed: Python161/session29/browser-files13, real browser file recovery
and dependency boundaries. Strict server Clippy passes. Shared session tests ran
on UI lane's released alpha38 (UI30 peer); accepted immutable browser snapshot used
UI29/session37. Drive Actions→Open enters the saved Map file without changing its
revision/hash, and details/open requests respect current permissions. Early browser
harness attempts used a response body invalidated by navigation and a stale initial
revision assertion; accepted check compares metadata immediately before/after open.
Evidence: `.verification/framework-drive-listing-2026-10-11/summary.json` and
`.verification/framework-drive-opening-2026-10-11/browser-accepted/`.
Original server remains PID82929/8780. No cutover, push or full-framework completion.


### Native file favorites qualified — 2026-10-11

Schema11 stores actor-private file favorites with current permission checks before
exact retry, atomic preference/receipt/audit events and no content revision changes.
Legacy favorite rows import as baseline state without inventing historical events.
Typed session39 transport retains UI30 and is pinned and byte-verified in all eight
consumers; all eight builds pass. Native documents144, focused favorites7, import
plus validator48, client37, server units21 and old-host compatibility1 pass; strict
Clippy/lint pass. The real browser favorites/unfavorites, reloads, opens saved Map
files, checks workspace preferences and the other existing account/history/
collaboration flows. Shared-sidebar selectors replaced obsolete header assertions.
The schema11 original-demo rehearsal preserves1 user,18 entries,516 revisions,358
blobs; dump/restore, exact listing metadata and362 portable recovery hashes pass.
The actual target postgres directory is verified stopped. Original8780 unchanged.
Evidence: `.verification/framework-file-favorites-2026-10-11/summary.json`.
Remaining shared/recycle/activity/write services, app/agent engines, live sync,
matched A/B and compatibility/recovery gates still prevent full cutover.


### Shared Drive views and membership reads qualified — 2026-10-11

Access schema12 preserves optional direct-grant author/time; changing a role keeps
the original facts, and unknown imported history stays unknown. Shared With you /
By you lists use current ACL, active recipients, inherited grants and workspace
access without disclosing private ancestor names or recipient lists. Owner-only
`/api/drive/sharing` returns direct grants and existing link metadata without link
secrets. `/api/drive/members` returns current permitted organization/workspace
directory fields; server-admin directory inspection does not enroll the admin or
grant document access. Limits fail explicitly instead of returning partial results.
Legacy grant provenance imports exactly; nonempty legacy link tables and sharing
mutations remain separate work.

Full156 native document checks pass; final focused12 qualify five additional
sharing-detail/member checks and the final provenance refinement (161 unique
document checks across these runs). Import/validator51, server units21, strict
Clippy/lint and built-browser With you / By you / share-dialog reads pass. Earlier
member checks caught an ORDER BY alias/collation error, corrected before final
qualification. Schema12 original-demo dump/restore and362 portable hashes pass;
all14 files including2 attachments still match original bytes and516 revisions.
Original8780 unchanged; no cutover or publication. Evidence:
`.verification/framework-drive-shared-2026-10-11/summary.json`.

### Drive activity history qualified — 2026-10-11

Access schema13 adds the exact original Drive event journal and import markers
that distinguish folder timestamp baselines from observed creation events. The
frozen snapshot projection remains unchanged. IDs, actor, organization, nullable
purged-file references, action, timestamp and detail are preserved exactly; malformed
or unsupported source fields are rejected. Native Drive Activity reads that journal
and canonical native file/access audits without duplicating imported document
history or fabricating folder creation events. Recycle details use original deletion
facts when no newer native structural deletion exists.

Current session, organization, file and app access govern every event; purged-file
facts require current organization ownership. Private favorites are not exposed
through the shared feed. Global reads return the latest500 authorized events and
file details the latest20; candidate/response/time limits fail explicitly. Reads do
not enroll users, mutate activity or change saved revisions. Composite string IDs
keep original and native journal identities separate.

Full172 document checks, focused4 activity checks, import/validator52 (including
exact old-host Activity comparison), strict Clippy/lint, Drive build and real Activity
browser interaction pass. Actual demo schema13 import/dump/restore preserves1 user,
18 entries,516 revisions,358 blobs and2 Drive events; all14 files including2 attachments
match original bytes and362 portable recovery hashes verify. Target is stopped at
`~/Library/Application Support/Aether Studio Migration/native-20261011T062112Z-drive-activity`.
Evidence: `.verification/framework-drive-activity-2026-10-11/summary.json`.
Original8780 remains running; no push/cutover. Remaining writes, app/agent/admin,
branch/comparison and live/final qualification gates remain open.


## Schema14 upload storage qualification — 2026-10-11

A new stopped target, `native-20261011-uploads-schema14`, was prepared from the
same private demo snapshot. Import, portable dump/restore and Rust integrity
verification preserve1 user,18 entries,516 revisions,358 content blobs and the
three external assets. The recovery manifest still covers362 files. No source
revision was purged and neither running installation was switched.

New native uploads store chunks within the native object root. The local
`verify-store` command now also verifies uploaded manifests/chunks. Dedicated
fixtures restore both published and partial uploads into a separate database and
object root and continue the restored transfer. Existing imported attachment
roots remain required; native uploads do not relocate or remove those files.

## Sharing-link preservation — schema15, 2026-10-11

The importer now validates and transfers original organization links and redeemed
visits. Link IDs, SHA-256 credentials, roles, revoked flags, issuer/timestamps and
recipients survive both import and portable database restore. Expiry is compared
to PostgreSQL microsecond precision. No replacement secrets are minted, public
access is not introduced, and current organization/app checks still apply.
Existing snapshots are read without rewriting their projection or manifest.

The latest actual-demo recovery target is the private, stopped
`~/Library/Application Support/Aether Studio Migration/native-20261011-links-schema15`.
It preserves1 user,18 entries,516 revisions,358 blobs,2 Drive attachments and1
workspace file. The original demo has no sharing links; a separate original-host
fixture qualifies active, expired and revoked links and prior visits after restore.
Evidence: `.verification/framework-links-2026-10-11/import.log` and
`demo-recovery.log`. Original8780 remains authoritative; final recapture after
write draining, remaining services and rollback/cutover gates are still required.


## Branch-ready storage target — 2026-10-11

The importer now requires store schema3 (access15/identity2 unchanged). The additive
branch tables are empty for Main-only imports, and imported revision JSON remains
unchanged. Non-Main legacy histories are still explicitly refused until the branch
import adapter is implemented; the new storage foundation does not imply that port.

A new private stopped target,
`native-20261011-branches-store3`, retains the original snapshot's1 user,18 entries,
516 revisions and358 content objects,2 attachments and1 workspace file. Exact
record comparison, content verification and independent dump/object restore passed.
The immutable snapshot and prior stopped targets were retained. Neither live server
was restarted or switched. Evidence: `.verification/framework-branches-2026-10-11/`.

## Branch metadata target — access schema16, 2026-10-11

The empty-target guard now requires access16/storage3/identity2. Named Main
versions still import with their original fields and a null branch identity;
original records and receipt fingerprints are preserved. Importing non-Main
legacy branches is still refused until explicit ID/graph conversion is qualified.

A fresh stopped target at
`~/Library/Application Support/Aether Studio Migration/native-20261011-branch-metadata16`
verified the original immutable demo snapshot: one account,18 entries,516
revisions and358 content blobs, plus retained attachments/workspace assets.
Record comparison, integrity, dump and restore passed. The362-file recovery
manifest includes the dump and all retained object/asset files. This is a
point-in-time qualification; final cutover must recapture after stopping writes.
The running original and earlier recovery targets are unchanged. Evidence:
`.verification/framework-branch-metadata-2026-10-11/original-recovery.json`.

## Legacy branch adoption — 2026-10-11

`legacy_branches.py` now validates and adopts independent branch heads, empty
branches, merges with both parents, explicit content restores, named checkpoints
and branch-linked collaboration. Main remains its actual head even when newer
revisions belong to another branch. Revision numbers, bytes, authors, notes and
raw parent annotations are retained. The branch graph follows the original
`History.parents` fallback (previous revision on the same branch, never global
revision minus one). Native branch history projects those resolved parents while
keeping raw import annotations unchanged; Main-only responses remain compatible.

Permanent `branch-<sha256>` identities derive from the legacy-import namespace,
document ID, final branch name and fork revision. Existing immutable Main snapshot
projections are unchanged: branch metadata is derived from the archived SQLite
database outside `projection.json`. Import requires empty identity2/access16/store3
storage and writes adoption receipts/audit rows together with the branch rows.
These synthetic import receipts are not reconstructed legacy user commands.

A deleted branch with an explicit, continuous fork/history is retained as a
tombstone, including its checkpoints and comments. Its original creation record
was deleted by the old server. The recovery description and receipt mark this
explicitly; author/time come from its first known revision, not a claimed original
creation timestamp. Empty deleted branches without any surviving history cannot
be reconstructed. References to such branches refuse import.

The old server rewrote history/version names during rename but did not rewrite
comments or retain a complete alias map. Comments already using the final name
transfer; unresolved older labels stop import rather than guessing. Name reuse,
unknown fork parents, detached roots, unsupported fields and malformed restore or
merge ancestry likewise stop capture before publishing a snapshot. These limits
are operator review cases, not permission to discard records.

Qualification uses the real legacy writer and a disposable native server: capture
without source changes, all imported record comparisons, occupied-target refusal,
portable SQL/object restore, original-password sign-in, Main and branch reads,
checkpoint/comment identity retention, rename followed by continued branch edits,
and a second Rust integrity check. Deliberately changing a restored checkpoint's
branch identity is detected by record comparison. PostgreSQL's `0` versus `0.0`
JSON rendering is compared numerically without relaxing nonintegral timestamps or
boolean/string equality.

Evidence: `.verification/framework-branch-import-2026-10-11/`. The existing private
`demo-20261011T062112Z` snapshot was reimported into the new, stopped
`native-20261011-branch-import` sibling target. All 516 revisions/358 objects and
362 recovery files are preserved; the original installation remains authoritative.
Live metadata delivery and the broader deployment gates remain open.


## Agent authority schema3 — 2026-10-11

Current imports require identity3/access16/store3 and an empty agent-grant table.
The schema upgrade preserves existing accounts/documents; legacy sessions and
agent credentials are not migrated. The private operator recovery path now uses
`native_backup.IDENTITY_CREDENTIAL_EXCLUSIONS` for sessions, recovery tokens and
agent connections. A seeded valid grant is absent after restoration, while exact
account/document/history comparison still passes. Grants persist across normal
server restarts; recovery/import requires reissuing credentials.

The preserved demo was imported into a fresh stopped private target with
1 account,18 entries,516 revisions and358 content blobs; independent dump/restore
and exact record verification pass. Evidence:
`.verification/framework-native-automation-2026-10-11/demo-import.log`.
No original installation or earlier staging target was changed.

## Product command receipts — access schema17

Current imports require identity3/access17/store3 and empty agent-grant and
product-command-receipt tables. The additive table preserves native Map retry
results with the same content commit. Existing native data upgrades explicitly;
old demo users, files and history retain the existing import/recovery rules.
No legacy command receipt or agent credential is invented or activated.
