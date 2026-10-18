# Aether Studio persistence

`aether-store` belongs to the **full Studio server installation**. Its production
build uses PostgreSQL for document metadata/history and immutable content objects
on server disk or an S3-compatible service. It is not part of standalone apps.
Standalone apps save ordinary document files and retain editing undo/redo and
crash recovery; centralized revisions, identity, permissions and collaboration
require Studio. Shared protocol types do not bring in the storage implementation.

Existing applications still use the Python Studio authority. This crate is a
verified replacement foundation, not a live cutover or an authentication API.
Gateway capability flags remain unchanged until authenticated host routes use it.

## Trusted boundary

Storage schema3 adds [durable branch heads and merge ancestry](BRANCHES.md).
This is a qualified storage foundation; native browser branch controls and legacy
branch import remain pending. Main-only HTTP capability flags stay unchanged.

`HostedStore` accepts a bounded PostgreSQL connection pool and a `ContentStore`.
The host configures TLS, credentials and pool limits. `AuthorizedScope` must come
from authenticated Studio identity; the host must check document permissions
before every call, including reads, history and replayed operations. A client
cannot select its tenant or gain rights by supplying an actor field. The adapter
rejects actors that differ from the trusted scope and scopes every query/object
key to the tenant. It does not implement identity or document ACLs itself.

Native Studio now coordinates those checks through `aether-server::documents`. Its
`mutate_in`/`read_in`/`history_in` calls hold the identity and ACL locks in the same
caller-owned transaction as storage. Those methods never commit; the caller must
confirm commit before returning a result. A separate check followed by a storage
transaction is insufficient against concurrent revocation. See
`../server/DOCUMENT_ACCESS.md`. Low-level trusted storage helpers remain useful for
operator verification/tests but must never become an unauthenticated public API.

`list_candidates_in` is an internal metadata-discovery helper, like the trusted
event replay helper below: it returns tenant-scoped candidates, **not authorized
browser results**. The native document authority filters every candidate and
pagination lookahead through current identity, app and document permissions while
retaining its transaction locks. Candidate IDs, counts and scan positions must
never be exposed directly. Discovery uses head metadata without fetching content
objects; a successful listing is not a content-integrity verification.

## Command contract

Rust contracts in `aether-protocol-core::storage` generate TypeScript in
`@aether/protocol`. Mutations carry a tenant-wide unique `operation_id`, a
`document_id`, the authenticated `actor`, and one of:

- `create`: product ID, display name and canonical base64 content.
- `save`: expected head revision and replacement content.
- `rename`: expected head revision and display name.
- `restore`: expected head revision and an existing source revision.

Create starts at revision 1. Every committed mutation produces the next revision,
including unchanged content saves. Restore appends the source name/content as a
new revision, preserving intervening work. Optional `preserve_name:true` restores
only the source content, keeping the current name for existing editor compatibility.
Omitted/null preserves the original full-restore wire shape and operation fingerprints.
This is server-side saved-version
restoration, distinct from product editing undo or branch merging.

Retry the **same request and operation ID** after losing a response. Exact retries
return the original durable receipt, even after later edits. Reusing that ID with
different arguments fails. Rejected requests consume neither an ID nor a revision.
Transport `request_id` remains correlation only. Conflicts reject stale revisions;
products must resolve them rather than automatically overwriting another edit.

## Durability and recovery

PostgreSQL transactions commit revision heads, immutable-through-the-API history,
audit and receipts together. Tenant/operation and tenant/document transaction
locks serialize duplicate delivery and competing edits without a global document
lock. Lock and SQL deadlines are bounded. Revision history is paginated.

Content is addressed by tenant and SHA-256 digest. A create-only object write,
content verification and durability flush precede the SQL commit. Local disk
objects and parent directories are explicitly synchronized on Unix; an atomic
rename alone is insufficient. SQL failure may leave unreferenced immutable
objects, but cannot commit metadata for a failed content write. There is no
pruning or object garbage collection yet. Deployment must retain referenced
objects and prevent other writers from modifying them.

Content is currently limited to **16 MiB per document mutation**. Large media
assets/chunking are separate framework work. Reads/replays check content hashes;
`verify` checks revision ancestry/continuity, heads, receipts and audit in a
consistent database snapshot. This detects corruption, not a malicious actor
able to rewrite both database and content. Production-scale verification remains
unqualified.

`migrate` is explicit provisioning with a serialized schema version/checksum
check. Unknown schema ownership, future versions and changed migration contents
are refused. Schema2 upgrades schema1 in one transaction, backfilling a change
stream and installing an event-required commit constraint. A failed upgrade leaves
the old schema/data intact. Legacy Python Studio import and operational rollback
remain separate gates; rollback to an older binary requires restoring its verified
pre-upgrade database-plus-content backup, not changing the marker by hand.

A backup requires **both PostgreSQL metadata and its referenced content objects**.
The tested recovery takes a database dump and copies the immutable object tree,
then restores into an independent database. Production backup tooling must retain
all objects referenced by the database snapshot until copying and verification
finish. A PostgreSQL dump alone does not back up document content. Encryption,
retention, scheduled backups and operational rollback remain deployment work.

## Durable change delivery foundation

Every new revision appends one event in the same SQL transaction as its head,
audit and operation receipt. Exact retries append nothing. Tenant-specific cursor
rows serialize the final publication step after object IO; using an ordinary
sequence would allow a later commit to appear below an already acknowledged
cursor. Other tenants remain independent. Cursor allocation rolls back with a
failed mutation. A deferred constraint rejects older writers that omit events.

`events(scope, after, limit)` is a bounded trusted-service replay API. Cursors are
decimal strings, preserving full PostgreSQL BIGINT precision in JavaScript.
Consumers acknowledge only after applying a page; reconnection is at least once,
so consumers must deduplicate. Missing events or inconsistent metadata fail closed.
Schema1 backfill preserves per-document order and is labeled `history_backfill`;
it does not claim historical cross-document commit order.

This internal tenant feed is **not a public subscription API**. The eventual
Studio delivery layer must authenticate the connection and filter/recheck each
document permission before disclosing metadata, including on reconnect and
revocation. No WebSocket, live merge, notification transport, client ACK storage
or new gateway capability is implied by this storage foundation.

## Acceptance

Run from AetherStudio:

```sh
.venv/bin/python dev/rebuild/check.py
```

The gate requires PostgreSQL tooling (`initdb`, `pg_ctl`, `pg_dump`, `pg_restore`;
locally verified with PostgreSQL 17.11). `AETHER_PG_BIN` can specify their directory.
The runner creates a private temporary cluster with only a Unix socket, exercises
real transactions, and stops/removes it. It never connects to the installed
Studio database. Hosted tests are marked opt-in in ordinary Cargo runs but are
mandatory in the framework gate; missing PostgreSQL is an error, not a skip.

Twelve hosted tests cover semantic equivalence, tenant/actor separation,
independent concurrent writers and duplicate retries, audit-insert rollback,
failed/corrupt objects, schema refusal, dump-plus-object restore and abrupt
PostgreSQL restart with persistent receipt/event replay. They also verify actual
v1-to-v2 upgrade rollback/retry, event insertion failure, old-writer refusal,
concurrent cursor visibility and corrupt-stream detection. Restart is not hardware
power-loss certification. `ContentStore::s3` is implemented but has not yet been
qualified against a real S3 service. Farm operation, 500-session performance,
full host authorization and app adoption remain open gates.

## Developer-only SQLite reference fixture

The earlier SQLite adapter is retained solely as an explicit compatibility and
failure-test oracle. It is **excluded from the production/default dependency
graph**, does not ship inside a standalone app, and is not the future Studio
production backend. Its CLI was renamed to avoid implying a standalone app mode:

```sh
cargo build --locked -p aether-store --no-default-features --features sqlite-reference --bin aether-store-fixture
```

`aether-store-fixture FIXTURE.sqlite` accepts `mutate`, `read`, `history`, `verify`
and `backup`; all paths are explicit developer fixtures. Its SQLite tests cover
process exit before/after commit, busy/concurrent writers, corruption and verified
backup/reopen. The framework gate separately builds the default production crate
and checks that neither `rusqlite` nor `libsqlite3-sys` enters its normal dependency
graph. Test-only SQLite code is not permission to embed SQL in product apps.
