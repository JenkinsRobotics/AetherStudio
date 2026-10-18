# Native Studio document integration

`documents::Documents` joins Studio identity, permissions and PostgreSQL/object
storage in one authority. It is server-only; standalone apps still use ordinary
files. Existing product frontends and the installation on8780 have not switched.
These versioned integration routes are not full compatibility with Drive/library
routes, branches, app services or the existing admin interface.

## What is implemented

- Current native session, active account and completed password-change requirement.
  HTTP input cannot supply its own actor or tenant.
- Organization membership, private ownership, workspace membership/default-viewer
  access and inherited folder grants. Server administrators have no automatic
  private-file access. Legacy `shared` retains owner-only writes unless explicitly
  granted; an organization owner sees other people's shared files as a viewer.
- Active previously redeemed sharing links are evaluated, including expiry and
  revocation. Link creation/redemption/import APIs are not implemented here.
- Enabled applications and restricted-app team assignments. Unknown or disabled
  apps deny access. Administrators bypass team restriction, never file ACLs or an
  application's disabled state.
- Create/save/rename/restore, paginated revisions and exact operation replay.
  Creates attach permissions and revision1 in the same commit. Retries recheck
  current permission before returning a saved receipt.
- Permission-filtered document discovery, literal case-insensitive name search
  and optional app filtering, with generated TypeScript request/result types.
- Owner-controlled view/edit grants, folder creation, administrator app/team
  configuration and organization membership changes. Removing membership clears
  prior grants/workspace memberships/link visits; its enrollment marker persists.
  Rejoining therefore does not silently resurrect earlier shares.

A folder destination is explicit: its organization/workspace must match the
request. This strict typed API does not guess a destination from legacy UI fields.
Cycles, missing parents, cross-location ancestors, non-folder ancestors, trashed
ancestors and chains deeper than128 fail closed. Managed-workspace creators do
not become owners merely because they created a file. Organization/workspace
creation and workspace member changes are available through the native directory
API below. Resource lifecycle operations are described below; preferences,
legacy Drive projections and full legacy admin compatibility remain subsequent work.

## Commit and revocation ordering

Protected operations use one READ COMMITTED transaction, explicitly selected even
if the database's default isolation differs. The identity library refuses unsafe
caller-supplied isolation. Lock order is:

1. Shared tenant identity lock, then current session/account read. Identity changes
   use the exclusive counterpart.
2. Shared tenant access lock, then membership/ancestry/grant/application reads.
   ACL changes, first enrollment and document creation use its exclusive counterpart.
3. Store operation lock, document lock and event cursor publication lock.
4. Content durability, metadata/history/receipt commit, then return success.

Existing document saves can run concurrently. Creates currently serialize within
a tenant with access administration, which keeps duplicate create/ACL publication
atomic; production workload qualification and finer locking remain open.
Revocation waits for an already authorized operation holding its shared lock. If
revocation gets the lock first, the waiting operation reads the new permissions
and fails. Revocation cannot retroactively withdraw bytes already delivered.

The pool, Identity and HostedStore passed to Documents must use the same database
and object authority. They are trusted operator dependencies. There is no public
`AuthorizedScope` deserialization. SQL failure rolls back permissions and revision
metadata together; a pre-commit immutable object may remain unreachable, following
the existing storage contract. Failed/unknown commit acknowledgements never claim
success. Mutation timeout reports unknown outcome; repeat only the same operation
ID and semantic arguments. Administrative retries require checking current state.

The schema is checksum-verified and explicitly provisioned. Serving/ready checks
never migrate. This is new-schema provisioning, not import of the user's legacy
SQLite or proof of production restore readiness. No public tenant event feed is
exposed; future live delivery must check each document before disclosure.

## Native HTTP routes

All routes below are POST, use the native session cookie, require exact Origin and
JSON, and return no-store responses. Missing/inaccessible documents both return404.
Identity errors retain401/403; stale revisions and reused operation IDs return409.
Internal SQL and object details are not returned.

| Path under `/api/v1/documents/` | Request |
| --- | --- |
| `mutate` | `operation_id`, `document_id`, `change`; optional create-only `location` |
| `read` | `id`, optional `revision` |
| `history` | `id`, `after` revision number, `limit` 1–1000 |
| `list` | `limit` 1–100; optional `app`, `query` (default empty), `after` document ID |
| `grant` | `id`, `user`, required `role`: viewer/editor or explicit null to revoke |
| `browse` | Scoped mixed file/folder navigation; see below |
| `resource-state` | `{id}` → current resource organization and structural revision |
| `resource-change` | Guarded folder rename, subtree move, trash or restore; see below |
| `recycle` | Permission-filtered recycled roots with ID pagination; see below |
| `folder` | `id`, `location`, optional `name` |
| `admin` | Tagged `action`: app, team, organization_member; administrator only |

Create example (the caller's identity is derived from its cookie):

```json
{
  "operation_id": "create-show-1",
  "document_id": "show-1",
  "change": {
    "kind": "create",
    "app": "map",
    "name": "Opening show",
    "content_base64": "e30="
  },
  "location": {"organization": "default", "workspace": null, "parent": null}
}
```

Admin payloads are `{action:"app",app,enabled,restricted}`,
`{action:"team",team,members:[userIds],apps:[appIds]}` or
`{action:"organization_member",organization,user,role}`. Organization role is
owner/member or explicit null. Removing the last organization owner fails.
Team lists are bounded; updates and audit share a commit. No agent token may call
these browser endpoints. Application IDs must be enabled explicitly after setup.

Document requests have separate execution admission of4, before reading their bodies.
At most20 total document requests can be admitted; the remainder wait at most250ms
for execution, within the original deadline. Overflow and expired waits explicitly
report `not_started`, and cancellation releases reservations. Account admission is
separate, so document bursts do not consume its slots.
Mutation JSON permits24MiB to accommodate base64; decoded content still caps at
16MiB. Other routes retain16KiB. These limits are not large-media support or
whole-company performance certification. Configure the document authority by
setting `AETHER_NATIVE_OBJECTS` to an existing dedicated private object directory
before running `aether-native-host migrate`, then `serve`. It uses the same explicit
native database/tenant as identity. With no object directory, document operations
return503. Readiness reports documents_ready only for a configured compatible
schema, and always retains applications_ready=false at this migration stage.

## Document discovery

`POST /api/v1/documents/list` lists current document summaries across permitted
apps, or one `app`. It is a versioned native integration endpoint, not a replacement
for the old Drive listing response or a frontend connection. `query` matches a
literal substring of the current name, case-insensitively using PostgreSQL's
configured casing rules. Percent and underscore are literal; no regex or wildcard
syntax. Search is limited to 1024 UTF-8 bytes without control characters.

Results contain `document_id`, `app`, `name`, `revision`, `size_bytes` and
`saved_unix_ms`. No content objects are opened; content hashes, audit details,
private paths and tenant-wide counts are not returned. Identity, membership,
inherited grants/links, trashed or invalid ancestors and app/team restrictions
use the same authority as reads. A server administrator has no private-file bypass.

IDs are ordered lexically with explicit C collation. Pass the returned `next_after`
with the same filters, or stop when it is null. Only a returned authorized ID can
be a continuation, and another authorized matching result must exist to produce
one. Denied candidates never produce a public scan cursor or empty intermediate
page. Supplying another seek boundary conveys no access and does not probe whether
that ID exists. Authorization is checked again on every page; revocation while
waiting for an ACL lock is visible when the lock is acquired.

Pages are live, not a frozen cross-request snapshot: inserts before the cursor,
renames and newly granted access may require refreshing from the first page.
Metadata is read in batches of 64. Scans currently cap at 2048 candidates and 10 seconds;
exceeding either returns 503 without partial results or a private continuation.
Use a narrower app/name filter for such a directory. This is a bounded integration
implementation, not large-library performance qualification; indexed authorization
filtering remains necessary before broad company-scale rollout. Mixed folder navigation is now provided by `browse` below. Sorting by other
fields, trash and legacy library projections remain separate work.

## Organization and workspace directory

Native integration routes share the document service's session, same-origin,
strict-input, admission and body-size protections. No actor or tenant is accepted
from the request. These routes are not a drop-in replacement for Drive context.

| POST suffix under `/api/v1/documents/` | Request and result |
| --- | --- |
| `organizations` | `{after,limit}` → `{organizations:[{id,name,role}],next_after}` |
| `workspaces` | `{organization,after,limit}` → `{workspaces:[{id,organization,name,role,is_default}],next_after}` |
| `directory` | Tagged administrative change below → `{ok:true}` |

`after` is nullable/optional; limit is required, 1–100. Directory listing filters
membership before pagination and lookahead. Identifiers sort with C collation;
cursors refer only to returned items. An administrator who is not an organization
member does not see its private workspace directory. These are membership-scoped
views, not the future all-organization admin projection. Default workspaces confer
viewer access on organization members except the preserved legacy `shared` rule.

Server administrators can submit:

- `{action:"create_organization",id,name,default_workspace_id}`: creates the
  organization, creator's owner membership, default `Shared` workspace and its
  owner assignment in one transaction. IDs are caller-chosen, valid native IDs;
  reserved `default` organization and `shared` workspace are rejected.
- `{action:"create_workspace",id,organization,name}`: creates a managed workspace
  and a creator owner assignment. This does not enroll an administrator into the
  organization or grant access to its files.
- `{action:"workspace_member",organization,workspace,user,role}`: owner/editor/viewer
  or explicit null to remove an assignment. Target must be active and already an
  organization member; workspace must belong to that organization. Two concurrent
  removals cannot remove the last explicit workspace owner through this operation.
  Organization membership removal retains its existing broader revocation rules.

Names trim whitespace and allow 1–80 characters with no control characters.
Duplicate creates return409; they are not receipt-based idempotent retries. All
changes and access audit records commit together under the tenant's exclusive
access lock. Explicit file grants are separate: removing a workspace assignment
alone does not revoke such a grant or a default-workspace viewer entitlement.
Organization membership removal still clears earlier shares and workspace roles.

Access schema2 adds names and directory indexes through frozen
`002-directory.sql`; schema1 remains unchanged. Explicit migrate verifies the
version/checksum chain and atomically upgrades. Startup refuses schema1 until
migration, and rejects unknown/tampered schemas. Existing names derive from IDs;
locations, ACLs and default flags are preserved. It does not create or relocate
workspaces for historical organizations or import the user's legacy database.

## Named folders and mixed navigation

`POST /api/v1/documents/folder` accepts an optional `name` in addition to `id` and
`location`. Names trim whitespace and require 1–1024 UTF-8 bytes without control
characters. Omitted/null names keep the previous ID-as-name behavior. Folder
creation, its name and access audit commit atomically; a failed audit leaves no
partial folder. Duplicate visible IDs return409 and private duplicates return404.

`POST /api/v1/documents/browse` accepts:

```json
{"organization":"default","workspace":null,"parent":null,"app":null,"query":"","after":null,"limit":20}
```

It returns `{entries,path,next_after}`. Each entry is tagged `kind:"folder"` with
`folder:{id,name}` or `kind:"document"` with the existing safe `DocumentSummary`.
No content, content hash, actor, hidden item count or scan cursor is exposed.
Files use canonical current revision names; access resources do not duplicate
those names. A storage metadata accessor verifies head/app/ID consistency without
fetching the content object. Folders own their names in the access resource table.

This is an accessible-direct-children projection for exactly one explicit
organization/workspace/parent, not the complete legacy Drive personal/shared/
recent/trash view contract. Search is a literal, Unicode-lowercase substring of
names within that level (not recursive). App filtering applies to documents;
accessible Drive folders remain for navigation. Disabled/restricted applications
filter their entries, and opening a folder requires Drive access.

Root workspace navigation requires an effective workspace role. A separately
shared nested folder can still be opened directly without workspace root access.
Its path includes only the accessible breadcrumb suffix; inaccessible parent
IDs/names are withheld. Missing, nonfolder, mismatched, cyclic, or trashed parent
chains fail closed. Every child and pagination lookahead is reauthorized against
current identity/app/ancestor permissions. The transaction holds the same locks as
other document reads; a waiting request sees a committed revocation.

Pages sort by ID using C collation; only returned entries can become cursors.
Limits: 1–100 returned entries, 64-row batches, 2048 candidates and 10 seconds.
An exhausted scan budget returns503 with no partial result or private cursor.
Pages are live, not a frozen cross-request snapshot. Indexed access/search at
large-company scale still needs qualification.

Frozen access migration3 (`003-folders.sql`) adds folder names and a child lookup
index. Explicit schema1/2 upgrades verify their checksum chain and preserve file
locations, content and permissions; existing folders use their IDs as names.
Startup now requires schema4 (below). No legacy installation import is performed.

## Resource lifecycle and recycle navigation

`resource-state` reads one authorized resource, including an explicitly recycled
item, without fetching content. It returns its kind/app/name/owner/location,
`structure_revision`, optional canonical `document_revision`, and own `trashed`
flag. A document's name/revision always comes from the store. An inaccessible
containing folder is represented by `parent:null,parent_hidden:true`, never its
private ID. Normal document reads still reject recycled items and ancestors.

`resource-change` accepts this strict Rust-generated contract:

```json
{"operation_id":"move-1","id":"folder-1","expected_structure_revision":1,
 "change":{"kind":"move","destination":{"organization":"default","workspace":null,"parent":"destination-1"}}}
```

Other changes are `{kind:"rename_folder",name}`, `{kind:"trash"}` and
`{kind:"restore"}`. Folder rename requires editor access; move/trash/restore
require ownership under the current effective policy. Caller actor/tenant and
extra fields are rejected, including extras on parameterless actions. Document
rename stays in the canonical `mutate` contract with its content revision guard.
Folder names trim whitespace, require 1–1024 UTF-8 bytes and reject controls.

The structural revision guards organization, folder name and recycled state.
It is deliberately separate from product content revisions. Changing a folder
does not manufacture content versions. Every affected resource records a durable
before/after structural event and audit entry; the operation receipt, state edits
and events commit together. Concurrent requests with one expected structural
revision have one winner. Reusing an operation ID with different arguments is a
conflict. Replaying the exact request returns its original result and
`replayed:true`, after rechecking current account/app/resource permissions and
redacting inaccessible ancestors again. A retry never trashes a restored item.

Moves hold the exclusive tenant access lock, check every descendant's ownership,
app access and complete ancestry, then change the whole subtree atomically.
Destination write access is required. Cycles, nonfolder parents, inconsistent
locations and a resulting chain longer than128 are refused. All descendants,
including independently recycled children, move together; internal parent IDs
and recycle flags are preserved. Moving to a personal location assigns the actor
as owner, matching Drive. Crossing organizations clears explicit grants and
revokes sharing links on every moved resource. Document contents/history stay
unchanged. At most1024 resources move per request; larger trees return503 with no
partial result. The20s operation deadline reports an unknown outcome; retry only
the exact operation ID/arguments. There is no background large-tree job yet.

Trash marks only the selected root. Restore requires its containing folder to be
currently readable and active, and leaves independently recycled children alone.
No permanent-delete endpoint is added by this migration.

`recycle` accepts `{organization,workspace,app,after,limit}` (optional nullable
workspace/app/after; required limit1–100). It lists visible explicitly recycled
roots at that organization/workspace. Children of a recycled ancestor are omitted
until their ancestor is restored. App filtering preserves visible folders.
Current app/team/membership/ancestor permissions apply to each candidate and
lookahead. Private IDs/counts/scan cursors are never returned. ID ordering uses C
collation; only returned IDs become cursors. Like browsing, it has64-row batches,
a2048-candidate cap and10s deadline with explicit failure instead of partial data.

Frozen access migration4 adds structural revisions, event/receipt tables and a
recycle lookup index. Explicit migration verifies all prior checksums and rolls
back on DDL failure. Serving never migrates. Existing schema3 resources start at
structural revision1; locations, permissions and content revisions remain intact.
Protocol alpha.6 contains these contracts; intermediate alpha.5 and earlier
archives remain unchanged. The original frontends are not yet connected. Legacy
unique-name rules, full Drive view/metadata projections, copy/purge, preferences,
share-link management and data import are still separate compatibility gates.

## Acceptance

`dev/rebuild/document_policy_check.py` compares512 versioned cases with the actual
imported Python DriveAccess implementation using an in-memory fixture. Rust runs
the same cases. The private PostgreSQL runner adds8 integration tests covering:
HTTP identity spoof refusal, origin/body boundaries, revisions/replays, private
admin refusal, inherited/expired/revoked access, invalid ancestry, team restrictions,
membership removal/rejoining, forced password change, metadata inconsistency,
authenticated cross-tenant isolation, save/revoke lock races, atomic failure and
simultaneous duplicate creation, failed access-audit rollback, and the actual
executable configured with a private object directory. The fixture database defaults to SERIALIZABLE to
verify that native operations explicitly establish the required isolation.

Run the full gate with `.venv/bin/python dev/rebuild/check.py`. For targeted
iteration, `.venv/bin/python dev/rebuild/postgres_check.py --documents-only` still
creates and removes its own PostgreSQL cluster. Eight additional discovery tests
exercise real HTTP pagination over private candidates, literal current-name search,
metadata-only operation with unavailable content, workspace/app/team/link filtering,
session and membership revocation, cross-tenant isolation, invalid inputs and
metadata, lock-ordered permission changes and explicit scan-budget failure over
2051 real created documents. Tests never open installation data,
publish packages, switch applications or activate hardware.

The native document suite contains the original29 real PostgreSQL/HTTP cases. Six
additional directory integration tests cover real provisioning, pagination
privacy, effective roles and document revocation, concurrent last-owner changes,
strict requests/origin rejection, atomic create/audit failure, frozen schema1
upgrade and conflicting DDL rollback, tenant isolation and disabled sessions.

Seven browsing tests cover mixed pagination and hidden lookahead, content-free
metadata, breadcrumb privacy, invalid ancestry, literal search/current names,
application rules, lock-ordered revocation, atomic folder auditing, strict inputs,
scan-budget refusal, schema2 migration rollback, workspace roots and tenant scope.

Ten additional lifecycle/recycle cases exercise guarded edits and exact retry,
current permissions, private ancestors, cross-organization shares, document
revision preservation, descendant/destination checks, independent child recycling,
event/receipt failure rollback, concurrent edits and lock-waiting revocation,
strict inputs/tenant scope, frozen schema3 migration failure, recycle paging and
hidden scan limits, subtree bounds and recycled descendants. Protocol unit tests
also verify that parameterless actions reject extra JSON fields.

### Existing editor projection and schema5

`documents/library.rs` adapts Main-file read/create/save/rename to the native
identity/ACL/content transaction. `mutate_in` is shared with the versioned native
route; the adapter does not implement a second revision store. The requested app
must match the authorized resource before writing. File metadata and writable
state are calculated within that same authorization transaction. Private parent
IDs remain hidden and administrative status does not bypass file ownership.

Migration005 adds per-user library visits with identity/resource foreign keys.
Migrations001–004 remain frozen; upgrade rollback fixtures reconstruct their
actual prior schemas before migrating. Recent-visit failure rolls back the whole
accepted operation; durable unreferenced content objects may remain for eventual
safe collection, as in the existing object-store design. The compatibility
routes do not implement branches, folder creation, Drive blobs
or CAD project operations. Those remain explicit501s.

`documents/library_listing.rs` now projects personal/workspace/recent editor-home
lists using the existing visit records. It retains the same identity and access
locks through metadata projection; revoked grants, removed membership, disabled
apps and trashed ancestors remove entries on the next request. Personal ownership
and workspace filters never substitute for permission checks. Shared documents
may appear in recents after an authorized open, without exposing private parents.
Folder timestamps come from canonical creation audits and structural events.

This legacy endpoint cannot represent pagination, so it refuses an oversized scan
instead of silently truncating. Versioned browsing remains available for paging.
It returns no content blobs and does not mutate recent visits. No schema upgrade
is needed; named-version counts remain unavailable rather than fabricated. See
`NATIVE_HOST.md` for the exact input and response limitations before app cutover.

### Existing editor history and schema6

`documents/library_history.rs` projects the canonical store history under the
same current identity/access locks. Historical reads are read-only projections;
neither endpoint appends revisions nor updates visits. The listing captures a
head and verifies the complete immutable prefix through that revision. Concurrent
later saves cannot mix a newer row into that response. Metadata listing does not
read content objects. Both app and tenant boundaries apply to author/annotation
lookups as well as content access.

Migration006 adds `legacy_history_annotations`, keyed and foreign-keyed to the
canonical tenant/document/revision. Only the verified offline importer writes it.
It retains original notes, seconds precision and parent references without
rewriting native content history. Exact deterministic import operation IDs require
annotations; missing annotations fail explicitly. Native restore notes derive from
their canonical restored-from revision. Upgrading schema5 preserves its content;
earlier staged imports still need re-import to recover original annotations.

Six PostgreSQL/HTTP cases cover exact envelopes, historical bytes, current
permissions/revocation, imports, schema5 upgrade/rollback, tenant isolation and
the1,000-revision completeness limit. See `NATIVE_HOST.md` for unsupported actions.


## Authorized attachment reads

`Documents::download` resolves current file/revision access in one read-committed
transaction under the existing identity/access lock order. It verifies the stored
revision through `HostedStore` before resolving a Drive descriptor against the
operator's immutable attachment snapshot. The HTTP download adapter is documented
in `NATIVE_HOST.md`; it shares document admission and never accepts a filesystem
path. Public Drive create/save refuse reserved attachment descriptors, preventing
hash knowledge from becoming an ownership claim. A revoke committed while a read
waits for the access lock is observed before any bytes are returned. An already
authorized response may complete. No SQL schema changed.


### Workspace delivery and content restore

The native private workspace route reuses application_status's current identity
and ACL locks, scopes files by the returned user ID and reads an immutable private
snapshot. It adds no resource rows, recent visits or alternate permission store.
This is the old per-user workspace area, not an organization workspace directory.

The existing-editor restore adapter reuses mutate_in and the canonical store's
atomic revision/receipt/audit transaction. Optional preserve_name on the typed
Restore command retains current filenames for legacy callers; its default keeps
native full-revision restore behavior. The adapter does not implement another
history writer. Native history projects the stored restored-from source into the
legacy note. Current app/file permission is required before writes and retries.


### Studio named-version authority

`library_versions.rs` owns legacy Main checkpoint create/update/delete and the
read projection, using schema007. Labels reference canonical immutable revisions.
It holds the identity authority and an exclusive tenant ACL lock through head
validation, mutation, audit/event/receipt writes and commit; ordinary saves hold
the corresponding shared lock. Concurrent saves cannot invalidate the checked
head between validation and label creation. Current access precedes receipt lookup.

History and home projections hold the shared ACL lock. Home summaries query only
IDs that already passed permissions, returning checkpoint counts rather than
revision counts. Labels/events/receipts are tenant-scoped, with explicit rollback
and schema-upgrade tests. Checkpoint deletion retains its audited before-state and
all content revisions. Release lifecycle and nonlinear branches remain unsupported.


### Studio collaboration and schema8

The native collaboration coordinator shares current app/document access checks and
commit ordering with file saves and permission changes. Its discussion revision,
normalized item state, full before/after journal and operation receipts stay
separate from content history. The existing React panels call the same legacy-shaped
routes. See [COLLABORATION.md](COLLABORATION.md) for the supported API and boundaries.


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

### Drive Trash/Restore controls qualified — 2026-10-11

Drive now calls the same canonical structural mutation transaction with explicit
selected-row revision guards and stable operation IDs. The Drive adapter rechecks
current identity, app and owner permission without enrolling a user. Exact retries
acknowledge the original receipt without repeating or rewinding newer changes;
stale selection returns409. Audit failure leaves no resource/receipt changes.
Native Drive metadata exposes a separate structural revision so content saves do
not fabricate a new structural guard. Session alpha40 carries uncertain-outcome
handling and preserves old-host acknowledgement compatibility. Lost replies require
refresh/check; no automatic retry or false saved-draft promise. Native writes
require the guard; an old client without it is rejected.

Full168 native document checks, focused7 recycle checks, client44/typecheck,
strict Clippy and actual Trash/Restore browser controls pass. All eight consumers
build on immutable UI30/session40, with package/lock/installed byte verification.
Archive SHA256: c120dab630afdedb04749f83f1a350383d65cc4d5dfa873de2d7951bb6594b1a.
Evidence: `.verification/framework-drive-recycle-controls-2026-10-11/summary.json`.
No production writes, push or original8780 cutover.

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

### Drive Rename/Move controls qualified — 2026-10-11

Drive file renames use the selected content revision; folder renames use the selected
folder revision. Moves use the independent structural revision. UI payloads carry
stable operation IDs; unknown acknowledgements require refresh/check without auto
retry. Native writes recheck current identity, app and editor/owner permissions in
the canonical transaction, without enrollment. Exact file-rename retries return current
metadata and cannot rewind a later name; folder/move retries use canonical receipts.
Moving a folder preserves child bytes and content revisions. Case-insensitive Drive
name collisions now reject rename/move/restore without overwriting a sibling, matching
the original host's ASCII name comparison. Failed audit writes roll back mutations.

Full176 document checks, focused4, client48/typecheck, strict Clippy and real browser
rename/move/read-back pass. All eight consumers build on immutable UI30/session41;
archive, installed files and lock versions match. Package SHA256:
4bea349c188a76082c0ecfe7adc04a88f78ce2c68d701539d87f0f20daaff5dd.
Evidence: `.verification/framework-drive-edits-2026-10-11/summary.json`.
Create/upload/copy/sharing mutations and broader framework gates remain separate.
Original8780 unchanged; no publication or cutover.

## Native Drive creation

`POST /api/drive/create` accepts operation_id, name, optional kind (file/folder;
default file), app (default drive), organization (default default), workspace,
parent and data_base64. Unknown fields fail. Folders accept empty content only;
inline files are bounded to6MiB decoded. Names trim whitespace and cannot collide
with a live sibling under Drive's ASCII case comparison. Public callers cannot
create immutable attachment descriptors. Uploads and larger attachments remain
separate migration work.

Native transactions recheck current identity, Drive/product access and writable
destination without enrollment. Actor-scoped receipts reuse the canonical resource
receipt store and retain a compact request fingerprint, not a second copy of file
bytes. Exact retry returns current metadata plus operation_id/replayed; it cannot
rewind later moves/renames. Changed input with the same operation ID conflicts.
Audit and resource/content changes commit together. Timeout reports unknown
execution; clients keep the operation ID and never automatically retry. Explicit
Drive destinations take precedence over unrelated editor URL defaults.

Verified: native179, focused3, client50, strict Clippy, eight UI30/session42 builds
and actual browser Folder/Text document creation with exact readback. Evidence:
`.verification/framework-drive-create-2026-10-11/summary.json`. No schema change
(access13), production data writes, publication or cutover.

## Native Drive direct sharing controls

`POST /api/drive/grant` requires id, user, role (viewer/editor/remove), operation_id
and expected_role (viewer/editor/null). The expected role is the direct grant that
the owner inspected, separate from inherited folder/workspace access. Missing
expected_role and unknown fields fail. A stale direct role conflicts. Current owner,
Drive/product access and target membership/active status are checked without
enrollment. Removing an existing grant from a disabled user remains possible.

Native replies include ok, id, user, operation_id, role, applied_role and replayed.
Exact retries retain the original applied_role but return the current direct role,
without reapplying the old grant. Permissions are checked before receipt disclosure.
The canonical resource receipt store holds small actor-scoped receipts; grant and
original provenance changes commit with the audit. New grants cannot exceed the
existing sharing-details limit of1000 combined grants/links. Share-link creation,
revocation and redemption are separate work.

The browser preserves its inspected role and reports unknown write outcomes without
automatic retries. Legacy replies remain compatible. Native184, focused5, client52,
strict Clippy, all eight UI30/session43 builds and actual browser sharing controls
pass. The newer Create/Rename/Activity/Grant transactions explicitly select READ
COMMITTED regardless of deployment defaults. Evidence:
`.verification/framework-drive-grants-2026-10-11/summary.json`. Access schema13;
no production writes, publication or cutover.

## Native Drive Copy

`POST /api/drive/copy` requires id, operation_id, expected_revision (root content
revision, or folder revision), expected_structure_revision, destination and optional
name. The default name is `Copy of <source name>`. Current viewer/app access is
required for every included source node; destination must be writable. The canonical
exclusive ACL lock serializes the snapshot against saves/moves/permission changes.
No user is enrolled. Copies get independent ownership/IDs, new revision1 documents
and no source grants, links, checkpoints or older history. Trashed subtrees are
excluded; inaccessible included children cause whole-operation failure.

Copied attachments are verified against the configured immutable snapshot after
authorizing the saved source revision. The internal copy path can preserve those
references; public writes still reject forged descriptors. Bounds:256 entries,
128 levels,64MiB total resolved bytes and20 seconds. No partial copy is acknowledged.
Exact actor-scoped replay returns current copied-root metadata with operation_id
and replayed, never resets later edits or creates another tree. Current source and
copied-root permissions are checked before replay.

Full188 native checks, focused4, client54/typecheck, strict Clippy, eight UI30/session44
builds and actual folder-copy browser/readback pass. Evidence:
`.verification/framework-drive-copy-2026-10-11/summary.json`. Access schema13; no
production writes, push or cutover. Uploads and share-link lifecycle remain pending.


### Native Library Home qualified — 2026-10-11

Home folder creation and renaming now use canonical guarded native storage, with
stable operation IDs, current product access and explicit destination precedence.
Product folders no longer require Drive permission. Folder renaming checks its
structural revision and preserves content history. Existing Drive creation receipt
fingerprints remain compatible. Interrupted Home requests report an uncertain
result without promising an editor draft that Home does not retain.

Full192 native tests, focused4, client58/typecheck, strict Clippy, all eight
UI31/session47 builds and installed archive/lock/byte checks pass. Browser Home
Create folder → My files → reload → My files → Rename and all earlier Drive/history controls
pass; Home intentionally preserves its starting view after creation. Evidence:
`.verification/framework-library-home-2026-10-11/summary.json` and the comparison
browser run. No schema change, demo modification, publication or cutover.


### Native Main revision comparison qualified — 2026-10-11

The existing Compare entries panel now reads immutable native revisions under
current session/app/file authority. Main ancestry and original import annotations
are reused through the shared history projection; reads do not enroll membership,
mark files opened or change history. Content reports distinguish equal bytes,
text/JSON, binary and large files. Opaque saved feature IDs retain a structural
summary without evaluating product geometry. Main only; branch mutation is pending.

Full195 native document checks, three focused HTTP tests, one bounded-comparison
unit test, strict Clippy and the actual Map Compare panel pass. Browser comparison
is checked against the same immutable revision bytes, then prior release,
collaboration and Drive workflows run successfully. No crashes/static failures;
known device/catalog/CAD engine routes remain pending. The text view uses one
replacement hunk with three context lines and explicit truncation, not a minimal
edit script: 200,000 input bytes,500 lines/30,000 characters; histories over1,000
revisions fail explicitly. Evidence:
`.verification/framework-library-compare-2026-10-11/summary.json`. No schema change,
production writes, push or cutover.


### Native company administration and memberships qualified — 2026-10-11

Admin Center organization/workspace creation and member assignments now use native
Studio authority. Administration lists are bounded and do not grant private file
access or implicitly enroll the administrator. Creating an organization atomically
creates its default workspace and creator memberships; creating a workspace does
not join its creator to a private organization. Operation receipts prevent duplicate
creation and do not restore memberships removed after the original request.

Member writes require current server administration and the observed direct role,
retain at least one owner, and atomically audit and remove organization-scoped
workspace assignments, file grants and redeemed-link visits on removal. They use
the existing canonical access helpers. Exact retries report current roles without
reapplying an old decision, including after a username changes. Member projections
now distinguish assigned_workspace_role from inherited workspace_role, so the UI
uses the actual assignment as its concurrency guard. Interrupted writes are never
automatically retried. The organization page loads its own directory without waiting
for unrelated server/network settings APIs.

Combined202 native document tests,65 client/UI tests and typecheck, strict Clippy,
all eight UI31/session49 builds and archive/lock/installed-byte checks pass. Actual
browser checks create an organization and workspace, add an account, grant Editor,
reload, remove workspace access, and repeat existing file/history flows. No browser
crashes or static failures. The earlier198-test provisioning run had197 passes and
one stale assertion that administration was unsupported; corrected expectation is
included in the passing202. Initial membership queue test now uses the actual
identity authority lock rather than an unrelated SQL row lock.

Evidence: `.verification/framework-drive-provisioning-2026-10-11/summary.json` and
`.verification/framework-drive-membership-2026-10-11/summary.json`. Immutable session48
SHA256: 2e41cd28c3ad3d03d3211fbb2a4daa9bd6b621d7111aa3e8a047519d489f64de.
Current session49 SHA256:
af7b8e7bf183773c1ef5eae7316364fa5fa31f04e411d7193f9aff55713c4284.
Access schema remains13. Directory reads cap each organization/workspace list at
1,000 entries and fail explicitly when exceeded; membership reads cap1,000/4MiB.
Reads have10-second deadlines and writes20-second unknown-outcome deadlines.
Uploads, share links, remaining admin/product/agent routes, live synchronization,
matched A/B and full release/recovery/cutover gates remain open. No original demo
writes, production restart, commit or push.

## Native sharing-link lifecycle — 2026-10-11

Access schema15 adds hashed capabilities and issuance provenance to the existing
revocable link authority. Drive creation/redemption/revocation, current membership
and application checks, replay-safe issuance and atomic audit now run natively.
The importer preserves original organization links and visits; restored original
URLs remain usable until expiry/revocation. See `SHARING_LINKS.md` for contracts,
limits and qualification. This supersedes earlier sharing-link-pending notes;
branch editing and remaining application/admin/agent services are still open.
