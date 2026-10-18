# Native Studio integration host

This executable is the active local Studio server at `http://localhost:8780`.
It owns identity, permissions, PostgreSQL history and content storage, and serves
the preserved web applications through installed frontend and product adapters.
It does not proxy the legacy Python host, share its cookies, open its database,
or fall back to its permissions. Native document routes enforce app/team/document access;
see `DOCUMENT_ACCESS.md`. Read-only live document invalidation and reconnect are
documented in `CHANGE_STREAM.md`; the shared browser panels consume the advertised
capability without reloading unsaved product content. Native administration,
combined built-app acceptance, final source reconciliation and independent recovery
have qualified coverage. Both legacy listeners are stopped; their data is retained.
Read [the current checklist](../../dev/rebuild/CUTOVER_STATUS.md) for deployment
qualification and remaining release limits. The dated sections below retain earlier
incremental states, including routes that have since been implemented.

## Explicit local operation

Build with `cargo build --locked -p aether-server --bin aether-native-host`.
Choose a dedicated PostgreSQL development database and an explicit tenant:

```sh
export AETHER_NATIVE_PG='host=/absolute/private/postgres/socket dbname=aether_dev user=aether_dev'
export AETHER_NATIVE_TENANT='development'
target/debug/aether-native-host migrate
```

Provision the first administrator with `target/debug/aether-native-host bootstrap`.
It reads a single JSON object from standard input containing `username`, `password`,
`full_name` and `email`. Supply it using an operator credential-input mechanism;
do not put real passwords in command arguments, shell history or committed files.
Bootstrap is a local operator action, never an anonymous HTTP endpoint. It refuses
a second initialization. No schema changes happen implicitly at bootstrap/serve.

Run `target/debug/aether-native-host serve`. It defaults to `127.0.0.1:8880`;
`AETHER_NATIVE_LISTEN` may select another loopback address, including port0 for tests.
Use the exact origin printed at startup for Host and Origin headers. This launcher
accepts only an explicitly configured Unix-socket PostgreSQL connection. It refuses
TCP rather than silently using unencrypted database connections. The underlying
Identity library accepts an operator-managed TLS pool; hosted TLS deployment is
not qualified by this local launcher. Windows/native distribution remains open.

To enable native document operations, set `AETHER_NATIVE_OBJECTS` to an existing
private directory before explicit `migrate` and `serve`. Provisioning also verifies
the storage/access schemas; serving only checks them. Without this setting the
document service is unavailable. Native organization/workspace directory routes
are part of this authority; explicit migration now upgrades access schemas1–20 to
schema 21 before serving. The opt-in frontend qualification is described below.

The existing `aether-server` binary remains the separately configured compatibility
gateway. `cargo run -p aether-server` still chooses that binary by default.

## Available HTTP routes

| Route | Behavior |
| --- | --- |
| POST /api/cad/{geometry,export,analysis,assembly,mate-kinds,engine} | Installed, stateless CAD engine services under current browser/app authority; see NATIVE_PRODUCTS.md |
| POST /api/library/{project_create,project_read,project_edit} | CAD containers through installed product codec, canonical native saves and source permissions; see NATIVE_PRODUCTS.md |
| GET /healthz | Process liveness; explicitly reports applications_ready false |
| GET /readyz | Read-only identity and optional document schema checks; applications_ready false |
| GET /api/status | Native login readiness, public account projection and currently authorized app catalog; applications_ready reflects configured app dependencies, not release certification |
| GET/HEAD /api/drive/download | Authorized file/revision bytes; streamed native uploads or verified imported attachments, preview and single explicit-start range |
| POST /api/drive/upload_{begin,status,chunk,finish,cancel} | Durable resumable native uploads and guarded replacement; see UPLOADS.md |
| GET /api/v1/identity/session | Current public identity, including must_change; 401 without a valid current session |
| POST /api/login | username/password; creates a native session cookie |
| POST /api/logout | Empty JSON object; revokes that session and clears its cookie |
| POST /api/password | current_password/password; atomically replaces the password and revokes every session |
| POST /api/preferences | Partial current-user theme/theme_id/avatar update; atomic audit; existing browser contract |
| POST /api/profile | current_password/full_name/email; confirms and rechecks the password at commit |
| POST /api/admin/users | username/password/role/full_name/email; admin only; new user must change the temporary password |
| POST /api/admin/user | action=update with id/role/active; reset_password with id/password; revoke_sessions with id |

Mutations return `ok: true`; create also returns the safe public user object. The
existing browser mutation field names are preserved where migrated. Native setup,
recovery, administration and installed product routes are described in the later
sections and linked contracts. Unsupported routes fail explicitly; there is no
legacy fallback. The supported library routes are listed below.
The separate `/api/v1/documents/*`
routes are documented in `DOCUMENT_ACCESS.md`. Unsupported methods return405 JSON.
Strict input types reject unknown fields, including caller-supplied tenant IDs.

## Browser and resource boundaries

- Trust comes from an operator-configured origin, not client Host or forwarded
  headers. Host must match; writes require the exact Origin and application/json.
  Cross-site/same-site Fetch Metadata, duplicate origins/hosts, URL query credentials
  and all Authorization headers are refused. No CORS access is enabled.
- `aether_native_session` is deliberately distinct from the legacy `aether_session`:
  browser cookies are scoped to host/path, not port. Running two test origins must
  not replace an existing sign-in. The cookie is HttpOnly, SameSite=Strict, Path=/,
  12h, with Secure for an HTTPS-configured router; the local executable uses HTTP
  loopback. Duplicate/malformed native cookies are rejected, never guessed.
- Credentials never appear in JSON success bodies or parse errors. Responses,
  including failures, are no-store, nosniff, no-referrer and same-origin resource
  policy. Password input structs are not Debug and use zeroizing owned strings.
- Identity checks re-read current account status, session expiry and revocation.
  Passwords and admin changes reauthorize under the identity commit lock. Profile
  edits verify the current password outside the transaction and compare the same
  credential under that lock; email changes invalidate recovery links.
- Identity admission is64 requests. Document routes retain4 regular executing
  handlers and4 independent metadata handlers for history/discussion reads,
  with at most20 admitted requests across both pools, including their wait queues.
  Waiting is limited to2s (or the remaining request deadline), before bodies/SQL handlers
  are read. Overflow/expired waits return429 `not_started`; cancellation releases
  capacity. The document queue does not consume account/control admission.
  Account/control overflow fails fast without a wait queue. Those bodies cap at16KiB
  (document mutation permits24MiB JSON /16MiB decoded),
  and each request has a45s deadline, including slow body reads. The identity pool
  caps at8 connections; hashing caps at2 jobs. Cancellation does not release an
  active hash worker's permit early. Host/identity objects are cloned, not rebuilt
  per request. No transport retries occur.
- Timed-out mutations report outcome_unknown even when they may have stopped
  before dispatch. Check current state rather than blindly replaying. Header/TCP
  resource protection and reverse-proxy configuration require deployment validation;
  these limits do not certify an Internet-facing production service.
- Peer addresses come from the accepted socket, never X-Forwarded-For. A reverse
  proxy deployment needs an explicit trusted-proxy design before using client-IP
  throttling. The local loopback account limit still applies.

## Verification

The framework gate runs fast request-boundary tests plus `native_http` against a
private PostgreSQL cluster and real loopback sockets. It exercises password/profile
changes, admin role restrictions, forced-password flow, immediate revocation,
expiry, secure-cookie attributes, origin rejection without mutation, bounded slow
bodies, read-only readiness and executable migration/bootstrap/schema refusal.
A 500-request HTTP burst verifies bounded admission before and after sign-out;
excess requests explicitly return429 without automatic replay. It uses one
identity and does not certify500 simultaneous editors or live collaboration.
HTTPS cookie tests use configured-origin headers over a local test socket; they
are not TLS termination or Safari/browser UI qualification.

No production database, launch agent, installed server or real credentials are
used. Full cutover remains conditional on the other gates in `dev/rebuild/README.md`.

## Existing editor file API (incremental)

POST `/api/library/read`, `/create`, `/save`, `/rename` and `/restore` now project native
Studio document operations into the file metadata used by existing editors.
`/branch_create`, `/branch_rename`, `/branch_delete` and `/merge` provide the
[guarded branch document API](LIBRARY_BRANCHES.md); browser branch parity remains
an outstanding gate.
These are authenticated native-cookie routes; they never forward a mutation to
the Python host. The same origin, admission and deadline rules apply. Method
errors on every route, including routes with a larger body limit, return JSON.

Read accepts `{app,id,branch?}`. Main/empty/null retain their original behavior;
non-Main selection requires a permanent branch ID. See [branch API](LIBRARY_BRANCHES.md). Create
accepts `{app,operation_id,name,data_base64,kind?,scope?,organization?,workspace?,parent?}`;
kind defaults to file. Save accepts `{app,operation_id,id,expected_revision,data_base64,branch?}`;
rename accepts `{app,operation_id,id,expected_revision,name}`. Unknown fields are
rejected. Names follow the legacy180-character/slash/dot-name restrictions;
file data is at most6MiB, with a9MiB JSON envelope. Drive blobs use the separate
upload service; library folder create/rename use the canonical structural service.
Name-only branch targets and unmigrated library actions return501;
they cannot fall through to Main or to the legacy server.

Responses preserve `id,app,name,kind,revision,scope,parent,organization,workspace,
owner,writable,size,created,modified`, with content on read. Times are Unix
seconds, owner is the display name, and private parents are redacted with
`parent_hidden:true`. Writes include `replayed`; an exact retry returns its
original revision, not a claim that it is the current head. Current permissions
are checked again before any replay. Create IDs derive from tenant, actor and
operation ID so an exact retry cannot allocate another file.

Access schema5 adds Studio-owned recent-file visits. A read/create/save visit,
content revision, audit and operation receipt share the same transaction. No
local app database is introduced. Unsupported library operations, product services,
media, setup/admin flows and import/rollback still block a
complete app cutover. `/readyz` continues reporting `applications_ready:false`.

The shared browser session alpha.8 supplies operation IDs, validates basic file
responses and distinguishes safe rejection from unknown write outcome. An
unconfirmed write blocks automatic retries and retains draft recovery. Recovery
also records a save before dispatch, so refreshing mid-save cannot silently
restart a create. Checking saved state or explicitly making a copy is required;
this is not automatic offline reconciliation or a durable operation outbox.

Chromium may retransmit a failed POST below the JavaScript transport. These
retransmissions retain the serialized operation ID; native concurrent replay
acceptance verifies one document/revision. The legacy Python host ignores that
new ID and does not acquire the native guarantee merely by updating its client.
Browser recovery prevents new application-level retries; it cannot disable the
browser's transport behavior.

## Existing editor home listings

POST `/api/library/list` accepts `{app,view?,parent?,query?}` and returns `{files}`
plus `capabilities.named_versions:true` and `version_lifecycle:true` (branches remain false). Views are `personal` (default),
`workspace` and `recent`. Personal contains the user's own files and folders;
workspace contains currently accessible workspace resources; recent contains the
user's previously opened/created/saved files whose access is still valid.
Each document is filtered by the requested app; folders also require Drive access.

Without search, personal/workspace lists show the selected folder's immediate
children. A nonempty trimmed, case-insensitive literal query searches across
folders, matching the existing editor home contract. Recent ignores folder
filtering, but a supplied parent must still be an accessible folder. Lists sort
folders first and then newest modification; recent sorts by last visit. ID is a
deterministic tie-breaker. Listing and renaming do not update recent visits.
Document metadata comes from canonical revisions without loading content blobs.
Folder timestamps come from creation audits and structural events, and its
`revision`/`structure_revision` refer to structure, never content history.

This legacy endpoint is intentionally unpaged: it refuses scans over 2,048 candidate
resources or over 10 seconds with HTTP 503, without a partial success or hidden IDs.
The versioned listing/browsing endpoints remain the paginated alternative. Query
input is bounded to 1,024 bytes without control characters and normalized to the
legacy 200-character search. Unknown fields/views are rejected. Private ancestors
are redacted, and session/app/membership/grant/trash authority is rechecked within
the same permission-locked transaction. No SQL schema or package bump is needed.

Drive-specific views, library folder mutation compatibility, sharing and product
routes remain separate migration work. Each visible entry now includes the actual
named-version count and newest checkpoint name, independent of autosave count. `applications_ready` remains false.

## Existing editor history reads — 2026-10-11

POST `/api/library/history` accepts `{app,id,branch?}`. Main/empty/null is the
only supported branch. It returns the existing editor's descending revision rows,
current writable/scope values, retained named versions and the Main head.
Authors are current display names; revisions retain names, events, notes, hashes,
timestamps and parent references. Current session, application and file permissions
are checked together; administrator status does not expose another user's files.

POST `/api/library/read_revision` accepts `{app,id,revision,branch?}` and returns
`{id,name,revision,data_base64,writable:false}`. This opens historical content without
creating a revision, changing the current file or recording a recent-file visit.
History listing also leaves visits unchanged and never loads content objects.
Drive descriptors use the authorized download endpoint instead; these two editor
routes return501 for Drive. Unknown fields and invalid revision types are refused.

The old history panel has no pagination contract. Histories over1,000 revisions
return501 explicitly rather than a partial list. Native paginated history and
individual revision reads remain available. Branches and comparison remain
unfinished; collaboration is now native as described below. These read APIs do
not complete the existing version-control panel or authorize app cutover.

Explicit migration006 adds immutable import annotations in access schema6. The
verified importer preserves original notes, floating-point seconds and parent
references there; canonical content/revisions remain in `aether_store`. There is
no client annotation writer. Earlier staged imports require a fresh import from
the retained source snapshot: merely upgrading their schema cannot recover notes.
Missing imported annotations return503 instead of inventing empty notes. Existing
native-created revisions need no annotation. Migration005 and earlier checksums
remain frozen, and serving never upgrades schemas implicitly.

## Browser status and application discovery

GET `/api/status` preserves the existing browser envelope: `ready`, `name`,
`theme`, `user`, `apps`, `installation` and `email_recovery_available`. Here
`ready` means that this tenant has initialized accounts, including disabled ones;
it does not mean app migration is finished. `applications_ready` is true only for
a nonempty visible catalog whose applications have their required configuration.
This does not certify feature parity, provider connectivity, hardware or cutover.
An unavailable identity database returns an error rather than a misleading setup
prompt or successful sign-out. Missing, unknown, expired, revoked and inactive
sessions return `user:null`; malformed or duplicate native cookies return401.
The legacy cookie alone remains anonymous. Forced-password sessions can see their
public identity, but receive no app access. No credential hashes/tokens are exposed.

The catalog uses the same identity and app/team authority as document operations,
inside one transaction holding the identity and ACL locks. It does not enroll
members, update recents or modify permissions. Disabled, unconfigured, unknown and
unauthorized applications are omitted. Native anonymous responses intentionally
return an empty catalog instead of the legacy host's synthetic-admin app listing.
With no document authority configured, the catalog is empty. The UI showcase is
available to administrators when enabled and installed; members cannot access it.

`core/host/application-catalog.json` supplies one set of app names/descriptions and
preview metadata to both hosts, embedded into the Rust binary and included in the
legacy Python wheel. It contains no executable paths or remote URLs. Catalog URLs
are same-origin `/{id}/` paths. `installed` is true only for apps loaded in the
explicit frontend snapshot below; sibling folders alone do not count. `coming_soon`
and `preview` retain the canonical catalog values. `runtime_missing` identifies
missing frontend/document storage, Drive/Map media storage, CAD engine services,
Animation runtime/workspace storage, or Map player distribution as applicable.
`runtime_ready` means this list is empty. The status and administrative catalogs
use the same projection. All eight installed builds pass the combined browser
fixture with their required dependencies configured; absent dependencies remain
explicit and keep launch controls unavailable.

`installation:null` remains the native installation projection. Recovery, browser
setup and server-settings capabilities reflect the configured adapters.
`frontend_hosting` reports whether the explicit snapshot is configured; it alone
does not imply application readiness. Database schema initialization remains an
explicit operator command. Status never discloses storage paths or offers
unrestricted anonymous setup. The setup, settings, backup, mail and network
sections below describe their separate configured capabilities and qualification.

To customize display metadata for this integration host, optionally set
`AETHER_NATIVE_PRESENTATION` to an operator-owned UTF-8 JSON file before explicit `migrate`:

```json
{"schema":1,"name":"Workshop","theme":{"base":"aether-default","apps":{}}}
```

The seed file is bounded to 16KiB; invalid input fails without echoing its contents.
Names allow1–80 non-control characters; theme identifiers allow1–64 ASCII
letters/digits/hyphens/underscores. App keys must name known applications or Studio;
unknown fields are rejected. Explicit migration creates `aether_settings` schema 1
and seeds this tenant only if absent. Repeating migration never overwrites saved
settings. Without a seed, the defaults are Aether Studio / aether-default.

The native launcher now requires this settings schema at startup (run explicit
`migrate` to upgrade an existing native integration database). Runtime checks
perform no schema or settings writes. If a seed file remains configured during
`serve`, it must equal the saved presentation; otherwise startup refuses rather
than silently overriding either value. Normally unset it after initialization.

`/api/status` reads the persisted name/theme on each request. Saved changes appear
without restart and across native host instances. Full `server_settings` capability
remains false; the separate `server_presentation` capability identifies this subset.
The old Python installation is unaffected.

### Persistent display settings API

- `GET /api/v1/server/presentation`: current administrator only; returns
  `settings: {revision, presentation: {schema:1,name,theme}}`,
  `restart_required:false`, `network_settings_supported:false`.
- `POST /api/v1/server/presentation`: same administrator and same-origin policy;
  body `{expected_revision, presentation}` replaces display settings. A stale
  revision returns409; reload before saving again. Unknown fields, invalid values
  and bodies over16KiB are refused. Response contains the saved revision.
- `POST /api/admin/theme`: existing `{base,apps?}` contract, trims theme identifiers
  and removes empty per-app overrides. Changes only the theme, preserving the
  server name; serializes with guarded saves and increments the same revision.
  This legacy endpoint retains last-writer-wins semantics for theme-only writes.

Studio owns these tables; standalone apps do not depend on them. Writes authorize
inside a READ COMMITTED transaction under the identity lock, then serialize on the
tenant settings lock. Demotion, disabled users, forced password change and revoked
sessions prevent later writes. Presentation and audit commit atomically; uncertain
commit responses instruct the client to reload. Public status exposes only name
and theme, never operator network configuration, paths or secrets.

This is not the complete legacy admin screen. `/api/admin/state`, general
`/api/admin/settings`, network/TLS changes, restart, mail and maintenance adapters
remain unimplemented. Network configuration from a demo import stays in its private
source archive; it is not activated by migration.


## Opt-in frontend builds

Set `AETHER_NATIVE_FRONTENDS` to an operator-owned JSON file before `serve`:

```json
{
  "schema": 1,
  "studio": "studio/dist",
  "session": "core/session",
  "icons": "core/assets/icons",
  "branding": "core/assets/branding/apps",
  "apps": {"map": "../Aether-Map/dist", "cad": "../Aether-CAD/dist"}
}
```

These example relative paths assume the manifest is in the Studio repository
root. Paths resolve against the manifest's directory; absolute paths also work.
Build each frontend first. The host does not compile apps or scan sibling repos.
Studio and each selected app need `index.html`; session supplies only `account.js`
and `account.css`. Icons supply SVG controls; branding supplies public identities
at `/icons/`. Only known catalog app IDs are accepted. Configure their native
app permissions separately; a build does not grant users access.

Startup reads these trusted public outputs into an immutable memory snapshot.
Changes on disk require an explicit restart. Never point build roots at source,
credentials or user documents. Supported public asset extensions are served;
dot names, source maps and TypeScript source are omitted. Symlinks and special
files fail startup. Directory-handle-relative opens avoid following swapped child
paths; no request opens a filesystem path. Limits are 16KiB configuration,
128MiB per file, 512MiB total asset payload, 100,000 entries and depth32. Memory
also includes indexing and startup copies. This is currently Unix-qualified,
not a Pi memory/performance certification or Windows filesystem implementation.

`/` serves Studio. `/map/`, `/cad/` and `/animation/` keep the existing Studio
library homes; `/{app}/index.html` serves that editor. Other configured app roots
serve their own index. GET/HEAD support bounded query strings for document/branch
links and asset versions. Queries on API routes remain rejected except the strict
download query described below. Unknown routes
return JSON404, never a single-page HTML fallback. `/map/workspace/*` is a separate
private user-file route, described below, never a public build asset. Public build ranges do
not receive partial responses; assets remain full200 responses with no-store.

Every app page and asset checks current native session and app/team authority.
Anonymous HTML redirects to the same-origin sign-in page with its destination;
anonymous assets return401. Forced-password sessions cannot load the app;
unavailable authority returns503 and unconfigured/denied apps return404. Public
Studio/shared resources support sign-in. HTML gets the existing account script,
stylesheet and app scope. Uninitialized accounts get a setup-required503 instead
of an unsupported browser setup wizard. `applications_ready` stays false.

The normal framework gate includes snapshot and real HTTP/PostgreSQL tests.
Actual built frontend qualification requires Studio and all eight catalog app
builds (including the Aether UI gallery), plus the installed Chromium toolchain.
The complete local-layout manifest is `dev/rebuild/frontends.example.json`; paths
are relative to that manifest. Operator deployments may still select fewer apps,
but the suite regression refuses missing catalog entries:

```sh
AETHER_TEST_FRONTEND_MANIFEST="$PWD/dev/rebuild/frontends.example.json" \
AETHER_FRONTEND_EVIDENCE=/absolute/path/private-evidence \
.venv/bin/python dev/rebuild/postgres_check.py --frontend-browser
```

This creates a disposable PostgreSQL cluster, fixture credentials, object store,
ephemeral host and separate browser profile, then removes them. It never opens
the installation's database. It tests Studio sign-in, Map/CAD page loading,
Map's actual serialization/client create-save-read flow and logout. Remaining
product API failures are reported explicitly. It is not CAD geometry, Map live
output, device playback, full administration, offline operation or cutover
qualification. Ordinary Cargo tests compile but skip this explicitly ignored
browser test; the separate runner requires the manifest and must pass before
claiming built frontend integration. The dependency-only CI gate does not certify
that flow.

## Operator data verification

`aether-native-host verify-store` requires the explicit local PostgreSQL DSN,
tenant and object root used by the other operator commands. It checks frozen
identity/access/store schemas and audits every document revision, object hash,
receipt, audit row and change event without starting HTTP or granting client access.
It prints aggregate counts only. This does not assert complete app readiness or
verify external legacy attachment serving. The offline demo-transfer and portable
restore procedure is documented in `dev/rebuild/LEGACY_TRANSFER.md`.


## Imported private attachment downloads — 2026-10-10

Set `AETHER_NATIVE_ATTACHMENTS` to this tenant's private, hash-named attachment
folder (for the staged transfer: `legacy-assets/drive/blobs` inside the private
native target). This is separate from `AETHER_NATIVE_FRONTENDS`; never publish
private media as frontend assets. The host verifies SHA-256 names/content at
startup, refuses symlinks/special files and unexpected entries, and keeps an
immutable snapshot. Limits: 64 MiB per file, 128 MiB total, 4,096 files. Unix is
currently qualified. Refresh requires restart; large media and upload storage
remain separate migration work.

`GET`/`HEAD /api/drive/download?id=FILE_ID[&revision=N][&preview=1]` uses the native
session cookie and current Drive, source-app and file/revision permissions.
Authorization is checked on every request, including byte ranges; administrative
role alone does not disclose another user's private file. A response already
authorized can finish after a subsequent revoke. Responses are non-cacheable and
same-origin, with escaped filenames, nosniff and sandboxed content. Selected
image/audio/video/PDF extensions may preview inline; HTML/SVG and other formats
remain downloads. Explicit-start single ranges (`bytes=START-END` or
`bytes=START-`) return206; unsupported/invalid ranges return416 only after access
checks. Folder ZIP downloads return501. Unknown/duplicate query keys are rejected.

Ordinary document create/save cannot introduce Drive blob references: knowing a
hash does not confer ownership. Only the trusted verified import currently
creates those references. Authorized restore of imported revisions remains valid.
Absent or unavailable attachment content returns503, never the private path or
internal descriptor. Files stored directly as ordinary document content continue
to download without an attachment root. These additions do not enable native
uploads, workspace asset serving, complete Drive UI compatibility or cutover.


## Account preferences — 2026-10-10

The existing `/api/preferences` endpoint now saves current-user appearance, personal
theme and profile picture in native identity schema 2. `/api/status` and
`/api/v1/identity/session` include `theme`, `theme_id` and `avatar` in their public
user projection. The default is dark appearance with no personal theme or avatar;
status stays read-only. No target user/tenant may be supplied. Session revocation,
forced-password and same-origin checks remain in force. The account write and its
audit commit together; failures leave previous values intact.

This route alone receives a384 KiB request limit and shares the four-request
large-body admission pool. Other account routes keep16 KiB. The avatar allows PNG
or JPEG data URLs with matching signatures and at most256 KiB decoded content;
SVG, remote URLs, invalid encodings and oversized data are refused. Missing fields
are preserved; empty avatar/theme_id clears that setting. See the identity guide
for exact validation and schema upgrade behavior. Device-local light/dark controls
in the current UI remain device-local; this preserves the server appearance field
without changing their behavior. Existing Studio personal-theme and picture controls
use the migrated endpoint.

The transfer tool now imports and compares all account preference fields and checks
them after dump restore. Native serving requires the explicit schema upgrade; it
does not silently migrate an old database. No current installation was restarted.


## Private legacy workspace files — 2026-10-11

`AETHER_NATIVE_WORKSPACES` optionally points to this tenant's private workspace
snapshot root, with `USER_ID/relative/path` beneath it. For imported data use
`legacy-assets/workspaces` inside the stopped native target. Keep it separate
from frontend builds and Drive attachment blobs. Startup opens directories by
handle, refuses symlinks/special files/unsafe names and reads an immutable bounded
snapshot. Limits are64 MiB per file,128 MiB total,10,000 entries and depth32;
oversized or unsupported trees refuse startup, never silently omit content.
Qualified on Unix; Windows and large mutable workspace storage remain open.

`GET`/`HEAD /{app}/workspace/{path}` matches the existing per-user file contract:
raw bytes, application/octet-stream, attachment disposition and SHA-256 in
X-Aether-Revision. Bounded query strings are ignored for cache-busting compatibility;
Range returns the complete200 object as before. No listings, HTML fallback, file
writes, implicit workspace seeding or product-engine execution are added.

Every request uses the current native identity and app/team authority in one
permission-locked transaction. The authenticated user supplies the storage scope;
no requested path or admin role can select another user's root. Revoked/disabled
sessions receive401, forced-password sessions403 and denied apps/missing files404.
Unconfigured storage returns503 after authorization. Paths decode once; traversal,
encoded separators leading outside the relative path and invalid UTF-8 are refused.
Responses are no-store, same-origin and sandboxed downloads. Prepared authorized
responses may finish after later revocation; subsequent requests are rechecked.
There are no request-time disk reads. Changes require an explicit snapshot reload.

## Existing editor content restore — 2026-10-11

POST `/api/library/restore` accepts `{app,id,operation_id,expected_revision,revision,
branch?}`. Only Main/empty/null is supported. Current edit permission is required,
and the expected head must match. It appends one native restore revision containing
historical content while retaining the current filename, matching the old editor.
All intervening revisions remain available. Parent and restored-from provenance,
operation receipt, content metadata and audit commit together; failure rolls back.
It leaves recent-file visits unchanged.

The response is `{ok:true,revision,branch:"Main",replayed}`. Exact retries return
the original accepted revision even after later edits; differing arguments under
that operation ID or a stale head return409. Revoked access also prevents replay.
Missing source revisions return404. Existing shared document transport already
supplies operation IDs; no new product frontend implementation is needed.

The typed native Restore command gains optional preserve_name (protocol alpha7).
Omitted/null retains its previous full-revision name/content behavior and wire
shape. The legacy adapter supplies true; users cannot override it through the
legacy route. The restore addition leaves the store schema unchanged. Branches,
comparison and collaboration remain distinct migration work.


## Named checkpoints — 2026-10-11

POST `/api/library/version`, `/version_update` and `/version_delete` accept
`{app,id,operation_id,expected_revision,name,branch?}`. Creation accepts an optional
message; update accepts optional new_name/message (omission preserves the old
value). Only Main is supported. Names are trimmed, 1–80 characters without control
characters; messages are at most500 characters. Unknown and irrelevant fields
fail. Expected revision must match the current content head for a new operation.

A checkpoint points to an immutable canonical revision. Editing/removing its label
never rewrites content or adds an autosave. Current app/edit permissions guard all
operations and receipt replays; exact retries return the prior result even after
later label changes. Operation IDs reused with different arguments conflict.
The checkpoint, before/after event, audit and receipt commit atomically.
Only ordinary `version` labels may be renamed/deleted. Imported candidate/released/
obsolete records retain their status/note and remain protected. Native release
transitions are available as described below; branch operations still return501.

Access schema7 adds Studio-only labels, events and receipts, preserving checksums
for schemas1–6. History returns all nine legacy checkpoint fields. A document may
have1,000 checkpoints; larger history lists fail explicitly, while home listings
still return accurate counts/newest names. All content and checkpoint queries are
tenant-scoped and permission-checked. No new standalone database or UI fork.


## Native discussion service — 2026-10-11

Existing `/api/library/collaboration` and `/collaboration_mutate` now use the native
Studio authority for comments/replies, notes, tasks and reminders. Access schema8
adds independent discussion revisions, complete item events and guarded receipts.
See [COLLABORATION.md](COLLABORATION.md) for exact current permissions, request
fields, retries, limits, import validation and the distinction from live sync.
Earlier descriptions of collaboration as an unsupported route are superseded by
this request/response slice. Branches and authenticated live delivery remain open.


## Native release lifecycle — 2026-10-11

POST `/api/library/version_status` requires app, id, operation_id, expected_revision,
name, expected_status, expected_status_updated and status; optional branch is Main,
optional note is at most500 characters. Transitions are version→candidate,
candidate→version/released, and released→obsolete. Obsolete is terminal and needs
a nonempty reason. Current document edit permission and both the current content
head and previous release status/time guard every new change. Status timestamps
increase strictly, preventing a stale approval after candidate withdrawal/recreation.

Changes update checkpoint metadata, event/audit and a durable receipt in one
transaction. They do not rewrite content, advance saved history or change recents.
Exact replay returns its original status with replayed:true without reversing a
later transition. Replays still require current edit access. Errors never imply
success, and audit failure rolls everything back. Existing checkpoint receipt
fingerprints remain compatible; no database schema change beyond current schema8.

Session alpha34 treats version_status as a mutation with an operation ID and an
uncertain-outcome error after a lost reply; it classifies collaboration as a read.
Studio, Map and CAD pin this immutable archive. Real built UI approval/withdrawal/
obsoletion controls passed on the native host; original-host payload compatibility
also passed. Evidence: `.verification/framework-release-2026-10-11/`.

## Native Drive navigation context — 2026-10-11

POST `/api/drive/context` accepts an empty JSON object and returns the current user's
organizations, permitted workspaces, display identity and application catalog. It
uses one authenticated identity/ACL transaction, filters permissions before bounds,
requires Drive access, and does not enroll users or write preferences. New accounts
with no provisioned memberships return an empty directory. Imported accounts retain
their actual membership. Organization ownership and explicit workspace roles take
precedence over default-workspace viewer access; a server admin gains no implicit
private-organization membership. App availability uses the same projection as status.

The old unpaged directory is bounded at1,000 visible organizations and1,000 visible
workspaces; larger results return501 rather than partial success. Paged native
organization/workspace APIs remain available. Directory order is deterministic by
identifier; historical creation timestamps are not invented. Access schema9 adds
personal favorite/opened/preference_revision fields (false/null/0 when absent),
with capabilities.workspace_preferences:true. Drive list/uploads and other
unmigrated actions still return501 with execution:rejected; attachment downloads
retain their existing route. This is navigation integration, not complete Drive parity.

Evidence: `.verification/framework-drive-context-2026-10-11/`. Applications still
report runtime_ready:false pending their remaining services and cutover gates.


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
schema 1–8 checksums remain compatible. The new private, stopped actual-demo target
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
Folders retain their app identity and permission checks. Access schema 10 keeps
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

Native listing10/opening5, exact demo metadata/516 revisions, schema 10 dump/restore
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
The schema 11 original-demo rehearsal preserves1 user,18 entries,516 revisions,358
blobs; dump/restore, exact listing metadata and362 portable recovery hashes pass.
The actual target postgres directory is verified stopped. Original8780 unchanged.
Evidence: `.verification/framework-file-favorites-2026-10-11/summary.json`.
Remaining shared/recycle/activity/write services, app/agent engines, live sync,
matched A/B and compatibility/recovery gates still prevent full cutover.


### Native Drive file reads qualified — 2026-10-11

`/api/drive/read` returns metadata and bytes from the same captured immutable
revision, resolving imported attachments through the existing private snapshot.
Current identity/app/ACL checks precede byte reads; unavailable content or failed
recency writes roll back without success. JSON reads over16MiB return413 and direct
clients to the existing download endpoint. Drive reads never enroll removed users,
change document content or add history revisions. Item8/download7 tests and strict
Clippy pass; current Studio/Drive browser flow verifies bytes/hash/revision against
the existing Map library client. A disposable import reads all14 original demo
files including2 attachments byte-for-byte, retaining all516 revisions. Original
installation and stopped recovery targets unchanged. Evidence:
`.verification/framework-drive-read-2026-10-11/summary.json`.


### Shared Drive views and membership reads qualified — 2026-10-11

Access schema 12 preserves optional direct-grant author/time; changing a role keeps
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

Access schema 13 adds the exact original Drive event journal and import markers
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
browser interaction pass. Actual demo schema 13 import/dump/restore preserves1 user,
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
`.verification/framework-drive-grants-2026-10-11/summary.json`. Access schema 13;
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
`.verification/framework-drive-copy-2026-10-11/summary.json`. Access schema 13; no
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

## Initial matched server A/B — 2026-10-11

See `dev/rebuild/SERVER_AB.md` and `SERVER_AB_RESULTS.md`. Optimized native
HTTP was compared with the preserved original Python host using disposable
databases and matched64KiB payloads at1/4/16 concurrent requests. Both final
configurations have zero failed workload requests. Concurrent reads/status improve,
but durable-save latency regresses; no full-app or company-scale readiness follows.

The original250ms document wait queue produced37 HTTP429 responses in the first
exploratory run. The bounded wait is now1s within the original deadline, with the
same4 executing handlers/20 admitted slots and separate account/control capacity.
Catalog and individual app authorization share one batched SQL policy; document
metadata reuses one current resource-role evaluation under its existing transaction.
There is no cross-request permission cache, schema change, weaker flush setting,
legacy fallback or installation cutover.


## Native resumable uploads — 2026-10-11

[UPLOADS.md](UPLOADS.md) defines the schema 14 upload contract, durable chunk
storage, completion retries, current-access checks, download/preview/copy behavior
and recovery requirements. Drive's existing uploader and the folder-sync CLI use
it; shared UI32/session50 consumer packages remain unchanged. Schema14 import and
restore of the original demo preserve its user,18 entries,516 revisions and358
content objects in a new stopped target. Full server migration remains open.


## Organization sharing links — schema 15

`link_create`, `redeem` and `link_revoke` now run natively. The existing Drive
sharing dialog uses session alpha53, guarded issuance/revocation and explicit
retry of uncertain creation. Original hashed links and recipient visits import
and restore without replacing their capabilities. See [sharing contract](SHARING_LINKS.md).
Access schema 15 is now required; serving never implicitly upgrades storage.

## Branch storage foundation — 2026-10-11

Hosted storage now requires schema3; access remains schema 15 and identity schema 2.
The additive upgrade retains existing Main revisions/receipts and adds stable
branch identities, guarded edits, audited merges and recovery verification.
See [the storage contract](../store/BRANCHES.md). Browser library branches remain
disabled until their authorization/projection/client/import adapters are qualified.
Serving never performs this upgrade automatically; existing stopped schema 2
targets remain unchanged and require explicit upgrade or a fresh import target.

## Branch versions and discussions — access schema 16

The native host now requires access schema 16 (storage3, identity2). Named
versions/releases and comments retain stable branch references through rename
and deletion. Content-changing merges save automatic checkpoints atomically;
failed checkpoints roll back the merge. See [branch API](LIBRARY_BRANCHES.md).
Main records and retry fingerprints are preserved. Existing stopped targets need
explicit migration; serving never upgrades them. Stable-ID browser adapters now
pass qualification with UI35/session54/assets6; global branch capability remains
withheld until legacy import and live metadata delivery pass. See
`dev/rebuild/README.md` for the remaining migration gates.

## Qualified legacy branch transfer — 2026-10-11

The offline operator path now imports validated name-based legacy graphs into
permanent native branch identities, retaining merges/restores, checkpoints and
comments. Deleted identities with recoverable ancestry remain tombstones; missing
creation metadata is labelled as recovered. Reused names or missing rename aliases
refuse import. Native branched history projects canonical parents while retaining
the original raw annotations. See `../../dev/rebuild/LEGACY_TRANSFER.md`. This
closes the qualified import/recovery slice, not live synchronization or cutover.

## Native agent integration — 2026-10-11

Authenticated `/api/agent/catalog` now works without a Python host. An optional
private `AETHER_NATIVE_AGENTS` configuration enables the native ChatGPT job
controller with the existing Node adapter. See [NATIVE_AGENTS.md](NATIVE_AGENTS.md)
for commands, permissions, bounds, configuration and remaining provider gates.
Claude/Gemini were added in the 2026-10-12 continuation through optional configured
CLI adapters, with isolated per-provider state and local protocol/browser fixtures.
Real subscription qualification and distributed jobs remain open. Agent readiness
is separate from the installed-application dependency projection.

## Native automation authority — identity schema3

Native Studio now serves scoped agent connections and the five general document
commands using canonical Rust storage. Agent bearer keys remain separate from
browser sessions, with current transaction-scoped permissions and revocation.
See [NATIVE_AUTOMATION.md](NATIVE_AUTOMATION.md) for the schema upgrade, recovery
policy, bounds and qualification. Product command adapters remain pending; this
does not set `applications_ready` or authorize deployment cutover.

## Map product command installation — access schema 17

Optional `AETHER_NATIVE_PRODUCTS` loads operator-installed product bundles at
startup. Map's four saved-show commands now run through native grants, guarded
content commits and exact command receipts. See [installation, limits and
qualification](NATIVE_PRODUCTS.md). Explicit access17 migration is required;
identity3/storage3 are unchanged. CAD/device browser routes remain unmigrated.


### CAD project and settings compatibility — 2026-10-12

Installed CAD workers now supply project create/read/edit and document metadata,
details, units, properties, deleted-item restore, atomic rename and private copy
through the native library API. These use current Studio authority and canonical
storage/history receipts, with branch selection retained by the CAD client.
Main-file moves and branch-aware linked-source/feature updates now use atomic
content/structure commits and exact result receipts. Non-Main folder moves,
Map browser/device and final app/cutover gates remain open.
See `NATIVE_PRODUCTS.md` for supported actions, installation and qualification.


### Native Map devices — 2026-10-12

Schema18 adds tenant-owned player pairing, assignments and bounded live-cast
signalling. Browser controls and device credentials have separate authority;
show retrieval checks the owner's current account/app/file access each time.
The actual Players panel and Python player protocol are exercised against Rust.
See [MAP_DEVICES.md](MAP_DEVICES.md) for routes, limits and remaining media,
provisioning, device-import and hardware qualification gates. No installation cutover.

### Native Map media — 2026-10-12

Access schema 19 adds immutable streamed media storage, document/history retention
and owner/shared-show/device read authorization. Existing Map upload, image and
range requests use the Rust endpoints without a frontend adapter change. See
[MAP_MEDIA.md](MAP_MEDIA.md) for limits, deletion/retry behavior and qualification.
Legacy media ownership/history conversion, exports and provisioning still block
Map cutover. The importer explicitly refuses unsupported media-bearing sources.


### Map installation downloads — 2026-10-12

`AETHER_NATIVE_MAP_DOWNLOADS` optionally selects an operator-installed
`map-downloads.json` plus its six verified product artifacts. Setup/ping/module
routes preserve the existing Pi bootstrap protocol; app.zip retains current
browser/device authorization. Invalid configured bundles refuse startup; absent
configuration returns503 for setup. See [MAP_DISTRIBUTION.md](MAP_DISTRIBUTION.md)
for the product build command, limits and pending physical qualification.

### Native Map show exports — 2026-10-12

The existing Map project ZIP/SVG URLs now use current native file authority, an
installed Map export worker and bounded temporary ZIP assembly. See
[MAP_EXPORTS.md](MAP_EXPORTS.md) for snapshot semantics, limits and qualification.
No live installation or original data was changed.


## 2026-10-12 compatibility additions

`POST /api/admin/team` and `/api/admin/access` update the existing native ACL
transactionally, including named teams and audit rollback. A redacted,
admin-only `GET /api/v1/admin/directory` exposes users, teams, restrictions,
session counts and recent audit entries. This does not implement the complete
legacy `/api/admin/state` control panel. See `dev/rebuild/CUTOVER_STATUS.md` for
remaining mail/setup/settings/backup/service-account work.

`POST /{app}/files/save` implements the existing private workspace text-save
contract (`path`, `text`, optional hash `expected_revision`). Paths are names
under the signed-in user, never arbitrary host filesystem paths. Writes are
limited to 4MiB text and 2048-byte relative paths. Atomic guarded heads and every
content version are retained in Studio's access schema 21; bytes use the durable
object store. Editing an imported snapshot first retains its original bytes.
`GET/HEAD /{app}/workspace/{path}` prefers these durable files and falls back to
the explicitly installed private import snapshot. Saves require current app and
account permission, rechecked at publication. Backups require SQL plus objects
and the original private snapshot; `verify-store` includes workspace versions.

For Animation, build its product-owned worker with
`Aether-Animation/scripts/build-native-worker.py --output <private-directory>
--python <absolute-trusted-python>`, then set `AETHER_NATIVE_ANIMATION` to the
resulting `native-animation.json` before starting the native host. The configured
Python must have the Animation engine's dependencies installed. The host checks
the archive hash, snapshots it, and executes it with isolated imports and private
working directories. No product semantics were moved into Studio.

The adapter keeps engine handles per native session and supports the existing
browser authoring client plus workspace byte serialization. It permits at most
two concurrent engine calls, 8 sessions by default (operator maximum64), 4MiB
requests, 8MiB responses and20 seconds per call. Idle sessions are removed on the
next request after15 minutes; a timeout/cancellation drops that worker state.
These limits are qualification bounds, not a hundreds-of-editors capacity claim.
The worker blocks shutdown, filesystem workspace RPC and canvas raster/matrix
rendering until confined asset adapters are qualified. It never receives the
native session cookie. The browser client load/pose/serialize/save/reopen flow is
covered by `postgres_check.py --animation-only`; private file concurrency,
isolation, restart and audit rollback by `--workspace-assets-only`.

## Native first-run setup and email administration — 2026-10-12

Settings schema 2 adds nonsecret SMTP configuration and redacted delivery activity.
The additive migration preserves schema 1 presentation data; startup refuses an
unmigrated settings schema. SMTP password bytes live in a separate private vault,
never in SQL rows or ordinary document backups. Set `AETHER_NATIVE_MAIL_SECRETS`
to an absolute dedicated private directory **outside the object/asset backup
roots** before `serve`. Its per-tenant directories are 0700 and immutable random-
named credential files are 0600. Missing restored credentials disable advertised
email recovery until the administrator supplies a password again.

Native routes now include GET/POST `/api/admin/mail`, POST
`/api/admin/mail/test`, GET `/api/admin/mail/events`, POST
`/api/recovery/request` and `/api/recovery/reset`. Settings changes and their audit
commit together under current administrator authority. Empty password preserves
the stored password; changing SMTP host/port/security/username requires explicitly
supplying a replacement password. Responses never contain passwords or vault IDs.
Production delivery uses Lettre with certificate-verified TLS or required STARTTLS;
there is no plaintext fallback. Work is bounded to 16 in-flight messages, 15 seconds
per delivery. Queued delivery is best effort across process shutdown; the user can
request another recovery link. Outcomes appear in Activity without SMTP diagnostics,
recipient addresses or reset tokens. Tests use a local sink and a local SMTP
server that deliberately refuses STARTTLS; no real mail is sent during checks.

Recovery uses the existing identity throttle and 30-minute single-use tokens.
Responses are identical for known/unknown accounts. Successful resets revoke
sessions/delegations and attempt an account notification; a failed notification
never rolls back or reports failure for an already committed password reset.
The public status flag reflects whether delivery is configured and its required
secret is available. Mail adapters are optional; absence does not break admin
users, teams or app controls.

For browser setup, migrate an empty tenant first, select `AETHER_NATIVE_SETUP`
as a **new file** inside an operator-created 0700 directory, and run
`aether-native-host setup-link`. The command prints a private local URL; do not
publish it. Start `serve` with the same path and fixed loopback listen address,
then open that URL within 15 minutes. The setup wizard exchanges the fragment key
for an HttpOnly/SameSite cookie, and submits `/api/setup`. Administrator, workspace
name and initial application policy commit atomically. Existing tenants reject
setup. Expired links, duplicate cookies and unavailable apps are refused. Files
are not overwritten: to renew an expired link, choose a new private key path and
restart the still-unconfigured host. The stdin `bootstrap` command remains valid.

`/api/admin/state` now connects the existing Studio admin UI to the native
users/teams/access/audit services and optional mail adapter. Its administration
catalog retains disabled apps so they can be enabled again, without granting app
access to ordinary users. Operational adapters not yet implemented are explicitly
null with false capabilities; the UI explains unavailable backup, service-account,
network and maintenance controls. This is **partial administrative compatibility**,
not authority to cut over. No fabricated backups, storage capacity or editable
network configuration are returned.

### Native diagnostics and service credentials

`GET /api/admin/maintenance` reports Rust host version, actual listener, uptime,
installed app availability, current tenant account/document counts and available
object-store disk space. It excludes account identifiers, contents, passwords and
connection strings. Unix free space is read from the operator-selected object
root; unavailable values remain null. Repair/uninstall commands are not fabricated.

`POST /api/admin/service` creates an administrator-owned scoped credential:
`{name, apps, days, can_write?, can_edit_content?}`. Lifetime is 1–365 days;
read-only is the default and saved-content editing also requires write access.
Only a hash is stored. The returned token is shown once; the admin page preserves
it across the refresh and clears it on navigation/account changes. Revoke with
`{id, action: "revoke"}`. Identity schema4 adds service classification to the
existing delegated authority; browser agent keys remain limited to 168 hours.

Use service tokens as Bearer credentials with `/api/automation/commands/list`
and `/api/automation/commands/run`, or with `aether-agent` CLI/MCP using
`AETHER_AUTOMATION_TOKEN`. Animation-scoped write tokens may also call the
isolated `/animation/rpc` engine. Tokens cannot sign in to browser APIs, change
admin settings or bypass document ACLs. Creator suspension, password reset,
application disablement/restriction and revocation remain effective. Existing
legacy service tokens must be explicitly reissued; old broad credentials are
not activated during import. Browser backup/network controls remain open gates.

### Portable native recovery snapshot (operator command)

`aether-native-host backup` uses the configured native database, tenant and object
root. Set `AETHER_NATIVE_PG_DUMP` to the installed absolute `pg_dump` executable
and `AETHER_NATIVE_BACKUP_DESTINATION` to a new directory inside a private0700
parent. Optional configured attachments/workspace snapshots are copied from their
validated in-memory bytes. The command refuses an existing destination.

The database dump and required object list use one exported PostgreSQL snapshot.
Ordinary saves may continue; later revisions are excluded consistently. Every copied
content object is checked against its recorded size and SHA256, and the manifest,
files and directories are flushed before publication. SQL and object data stay
together. Live session, recovery and delegated/service credentials and live cast
signalling are excluded. Account password hashes and durable device assignments
are retained; private provider/SMTP vaults are separate operator secrets.

This local adapter refuses mixed-tenant databases, missing/corrupt/symlink content,
unsafe extra paths and snapshots exceeding1,000,000 objects,256GiB or five minutes.
It currently requires Unix socket PostgreSQL and private local object storage.
The resulting directory contains `native.sql`, `objects/`, optional `attachments/`
and `workspaces/`, and a checksum manifest. Restore into a fresh isolated database
and content root and run `verify-store`; never overwrite a running authority.
Browser backup scheduling/download is implemented below; lifecycle controls remain migration work.


### Browser native backups and schedules

Enable `AETHER_NATIVE_BACKUPS` with an existing absolute private directory (0700),
`AETHER_NATIVE_PG_DUMP` with the installed absolute pg_dump executable, and the
normal native database/object paths. Startup creates a tenant-hashed private
subdirectory. Migrate settings schema3 explicitly before starting the host. No
browser request can select a DSN, executable, credential or destination path.

`POST /api/admin/backup` starts a bounded background snapshot; HTTP202 means
accepted, not completed. Admin state exposes progress and safe failure reasons.
Only after database/object verification, complete ZIP creation and fsync does an
archive appear. `GET /api/admin/backups/{name}` streams it to a current admin;
members, revoked administrators, service credentials and symlinks are refused.
The existing Backups page polls progress and retains downloads across restarts.

`POST /api/admin/storage` selects manual,6h,12h,daily or weekly operation.
Settings schema3 retains the policy and last attempt; the native host checks due
work every30seconds. A database advisory lock prevents overlapping manual or
scheduled snapshots across host processes. A missed run starts on the next host
startup. Failed attempts are reported and retried at the configured interval;
the last successful archive remains available. Archives are not automatically
pruned. External-directory/cloud delivery is not configured by this adapter.

The ZIP contains the same native.sql, objects and manifest as the operator
snapshot. Extract into a NEW private directory, check manifest paths, lengths
and SHA256 values, and restore SQL only into an empty disposable PostgreSQL
database. Treat SQL dumps as trusted operator material, not arbitrary uploads.
Point `AETHER_NATIVE_OBJECTS` at the extracted objects directory and run
`aether-native-host verify-store` before serving. Configure restored attachments
and workspace snapshots from their extracted folders, and restore operator
vault/configuration separately. Sessions, recovery links and delegated credentials
are excluded. The old Python restore command does not accept this format.

Qualification is recorded in `dev/rebuild/CUTOVER_STATUS.md`. Enabling backups
alone does not qualify the host for installation cutover.


### Native HTTPS transport (operator configuration)

The native executable now accepts `AETHER_NATIVE_LISTEN` with a network bind
address only when HTTPS is configured. Set `AETHER_NATIVE_PUBLIC_ORIGIN` to the
exact browser HTTPS origin (including the listener port when nonstandard), and
set `AETHER_NATIVE_TLS_CERT` / `AETHER_NATIVE_TLS_KEY` to absolute PEM file paths.
The Unix private key must be owner-only (0600); symlinks and files larger than1MiB
are refused. The server loads and validates the certificate/key before opening
its listener. Invalid or incomplete TLS configuration never falls back to HTTP.
Certificates/DNS/trust installation remain the operator's responsibility.

Without TLS, only loopback bind and loopback HTTP origin are allowed. Initial
`setup-link` remains a local HTTP workflow; complete it before enabling HTTPS.
The public origin must match the actual listening port. Host and Origin checks
use this explicit setting, never client Forwarded headers. This transport advertises
HTTP/1.1 only because the existing boundary has not qualified HTTP/2 pseudo-headers.
It uses axum-server0.8/rustls with the Ring provider and a30second graceful shutdown.
PostgreSQL still uses the configured local Unix socket; remote database TLS is a
separate deployment adapter, not silently inferred from HTTPS frontend support.

Sources for the transport APIs: https://docs.rs/axum-server/0.8.0/axum_server/
and https://docs.rs/axum-server/0.8.0/axum_server/tls_rustls/struct.RustlsConfig.html.
Browser network edits and restart/supervision are still a distinct migration gate;
this operator listener does not claim those controls are implemented.


### Managed native network settings — qualified 2026-10-12

Set `AETHER_NATIVE_INSTANCE` to a stable identifier (letters, digits, hyphen or
underscore, maximum80 characters) to enable the existing Studio Server & network
form. Settings schema4 persists listener configuration per tenant/installation;
the shared presentation remains the sole source of the workspace name. Omit the
instance identifier for operator-only listener configuration.

`AETHER_NATIVE_TLS_ROOT` optionally names an existing absolute directory from
which administrators may select certificates and keys. Without it, only the
operator-configured TLS paths are accepted. Files must pass normal certificate,
private-key permission and no-symlink checks. Changing the bind address requires a
free port so Studio can reserve the replacement while retaining the current socket.

Save validates configuration and audits the transaction. Restart revalidates it,
reserves the listener, drains existing connections (up to30seconds), and updates
origin/Host enforcement without replacing engine/session objects. Invalid TLS or
an occupied port leaves the current listener available. The browser reconnects to
the accepted address. For recovery, `AETHER_NATIVE_NETWORK_RESET=1` starts with
operator environment settings and preserves the stored configuration for repair.
This is controlled listener restart, not OS installation or service supervision.

Six actual HTTP/browser/executable checks cover current administration authority,
audit rollback, schema3 upgrade, port conflicts, same-socket HTTP→HTTPS, trusted
certificates, startup persistence and recovery. Settings5, backup6 and mail6
regressions pass; schema4 also independently restores the merged demo's2users,
31documents and549revisions. No live installation has been replaced.


### Animation private workspace file compatibility — 2026-10-12

The hosted `/animation/rpc` adapter now translates `load_workspace` with a relative
`path` to private Studio bytes and `save_workspace` with a `path` to the existing
versioned workspace store. Product workers never receive these host paths. The
existing in-memory `data_base64`/`return_data` flows remain available.

Loading returns `result.file_revision` (the archive SHA256). Pass it as
`params.expected_file_revision` when replacing that file. An absent/null guard
means create-only; it never overwrites an existing file. This file guard is separate
from the engine's `expected_revision` editing guard. Saves return the new
`file_revision` and path without echoing the archive. Current account/app access,
private owner scope, transactional audit and retained file versions all use the
existing Studio authority. Browser sessions support this file bridge; service
credentials continue using the separately authorized in-memory RPC/command paths.

Archives are limited to3141632 bytes so base64 framing fits the bounded worker
protocol. Absolute/traversal paths are refused. Raster/media RPC remains explicitly
unavailable until confined source delivery is qualified. Four Animation tests,
including actual browser authoring and binary archive persistence/conflicts/audit
rollback, and five existing workspace-storage tests pass.
## Native media and operational additions — 2026-10-12

Animation `canvas2d.render_frame` and `canvas2d.matrix_preview` now use the installed
product compositor with private Studio media bytes. The host captures a canonical
canvas snapshot, resolves referenced assets under the current user, and replaces
reserved input fields. It never gives a worker a user-selected server path or URL.
The original canvas keeps its source names. Service credentials do not acquire
private user-file authority through this adapter.

The worker supports static PNG/JPEG/BMP/WebP, GIF/APNG, sprites, packed bitmap JSON,
registered procedural faces and self-contained MP4/WebM/AVI. Video decoding uses
FFmpeg's inherited seekable descriptor, explicit container demuxers and a protocol
allowlist containing only `fd`; external references and playlists are refused.
The optional installed Animation media runtime is required. CPU/decode deadlines,
process-group cleanup and bounded output apply. Hosted preview limits are explicit
in `hello.media_limits`:2MiB total compressed assets,2MiPixels canvas,32surfaces,
16MiPixels aggregate decode budget; matrix sources256KiPixels/output64KiPixels.
These limits do not certify physical frame-output devices or unrestricted codecs.

The native CLI accepts `--config /absolute/private/installation.json` before
starting async work. Operator tools stage frozen macOS service generations and
restore native snapshots into new stopped targets. Actual launchd host/database
crash recovery was qualified against all549revisions of the merged demo. See
[native installation and recovery](../../dev/rebuild/NATIVE_INSTALLATION.md) for
commands, ownership requirements and the policy for rollback after new writes.
