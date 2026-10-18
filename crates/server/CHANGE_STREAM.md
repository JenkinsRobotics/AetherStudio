# Document change notifications

The native host provides `GET /api/library/changes?app=map&id=<document-id>`
as a same-origin, cookie-authenticated server-sent event stream. This is a
read-only invalidation service. Shared browser history/discussion panels consume
it through session57 and UI36 when `/api/status` advertises
`capabilities.document_changes: 1`. Hosts without a document service advertise `0`.

A successful connection immediately receives a `state` event with an opaque
`state-<sha256>` event ID and JSON fields:

- `schema`: 1.
- `document_id`: the authorized document.
- `state_token`: the same opaque ID; compare for equality only.
- `main_revision`: current Main head.
- `latest_revision`: highest committed revision, including branches.
- `collaboration_revision`: current discussion/task revision.
- `writable`: current editor access.

The token also accounts for branch creation, rename and deletion, named-version
metadata, and document resource metadata. It contains no document content,
branch names, discussion text, credentials or hidden document identifiers.
A token is scoped to the tenant, user, app and document. It is not a credential.

Every reconnect reads current durable state and sends a fresh initial event,
even when `Last-Event-ID` matches. A supplied ID must have the format above.
There is no event-log replay guarantee: intermediate changes may coalesce.
This works across server restarts or coordinators sharing the same database.
It does not implement concurrent editing or conflict resolution.

A client should invalidate its authorized history/branch/discussion views when
the token changes, then use the existing read commands. It must not silently
replace unsaved editor content. Existing revision guards and idempotent writes
remain authoritative. On reconnect, recheck the open document before saving.

## Access and limits

Each check revalidates the session, account, app and document permissions under
the existing identity/access transaction locks. Downgrading edit access produces
a new state with `writable: false`. Revocation, expired sessions, disabled apps
and service failures send `unavailable` with `{"reconnect":true}`, then close
without sending new document state. Clients should stop using stale permissions
and reconnect with backoff; an initial reconnect can return 401, 403 or a privacy-preserving 404.

Unchanged connections receive an authorized SSE comment heartbeat at one-second
intervals. The native executable also listens for committed revision hints over
one dedicated PostgreSQL connection. A matching hint wakes that document's
subscribers immediately; each still reads current state with full authorization.
Metadata-only changes and missed hints are recovered by the heartbeat. Subsequent checks have a
five-second deadline including the read queue. There are four concurrent change
reads and, by default, 512 subscriptions per host. `with_change_stream_capacity`
accepts 1–4096 subscriptions for embedding/tests. Capacity exhaustion returns 429.
These are resource limits, not a measured company-scale performance claim.

Individual streams retain no database connection between checks and have no
application producer queue. The host listener has one connection outside the
ordinary request pool and holds no open transaction. Disconnecting drops the
subscription permit. Each state query
bounds branch rows at 4096 and named versions at 1000, refusing larger states.
It does not read content blobs, enroll users, record recents or write history.
Normal same-origin/Host/Fetch Metadata and no-store response controls apply;
query credentials and unknown query fields are refused. `X-Accel-Buffering: no`
requests streaming from supporting reverse proxies.

The endpoint itself required no database schema change. Browser adoption uses
immutable UI36/session57 packages and preserves drafts and revision guards on
reconnect. No production cutover or global branch capability enablement occurred.
Company workload, concurrent product editing and remaining service qualification
remain separate gates.

## Verification

Run `.venv/bin/python dev/rebuild/postgres_check.py --change-stream-only` for the
isolated PostgreSQL/HTTP tests. They cover committed updates, metadata-only
changes, exact retry stability, reconnect to durable state, authorization changes,
session/app revocation, capacity release and rejection boundaries. The full native
document suite includes these tests as well.

## Committed revision acceleration

Revision publication sends `pg_notify('aether_revision_v1', <opaque-key>)` in the
same transaction as the durable revision/event. PostgreSQL delivers the hint only
after commit and discards it on rollback. The key is a framed tenant/document
SHA256; no names, bytes, credentials or authorization decisions are broadcast.
This is a trusted database channel, never a browser event API.

The host completes LISTEN before initial snapshot registration. Watch channels
coalesce bursts per document; weak registry entries release departed documents.
One host's save can wake another host using the same database. Every wake performs
the existing session/app/permission check before emitting state. Notification
connection failure retries with backoff; polling and reconnect snapshots recover
missed updates. A notification is not durable replay or a concurrent editing engine.
Dropping the host aborts its listener and releases the dedicated connection.

Run `postgres_check.py --notifications-only` for release-mode rollback,
independent-host delivery, permission, reconnect and shutdown tests. Run
`AETHER_COMPANY_USERS=500 postgres_check.py --company-only` (through the repository
Python interpreter) for500 users/subscriptions and eight concurrent editing
workflows. Optional absolute `AETHER_COMPANY_EVIDENCE` records raw latency samples.
Post-response visibility lag may be zero when an SSE event precedes the HTTP
save response; end-to-end save-start visibility is recorded separately. These
loopback measurements do not certify LAN latency or500 simultaneous CAD engines.

The current native operator supports PostgreSQL on a private Unix socket only;
this does not add remote database/TLS or server-farm deployment. Embedders that
omit `with_revision_signals` retain the authorized one-second polling behavior.

Transaction and listener ordering follow the PostgreSQL17 primary contracts:
[NOTIFY](https://www.postgresql.org/docs/17/sql-notify.html) and
[LISTEN](https://www.postgresql.org/docs/17/sql-listen.html).
