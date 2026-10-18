# Native Studio automation authority

The Rust host now owns scoped agent connections and five general document
commands. `aether-agent` CLI and MCP stdio can use it without a Python host.
AI-provider conversations (`/api/agent/*`) are a separate integration.

## Connection and permission contract

Sign in through Studio's personal Plugins → Agent access. Connections have an
explicit app list, read/write/content permissions and a 1–168 hour lifetime. A
random 256-bit key is returned once; only its SHA-256 digest is stored. Each user
may have at most 64 active connections and create at most 20 per hour. Lists return
only that user's grants and never keys or hashes. Revocation is immediate for
subsequent authorized transactions; password changes/resets, account changes and
administrative session revocation also invalidate the affected user's grants.
Ordinary logout does not revoke separately issued agent connections.

Browser sessions alone manage `/api/automation/connections/list`, `create`, and
`revoke`. POST `/api/automation/commands/list`, `run`, and `/mcp` accept scoped agent bearer
keys. They reject cookies, duplicate authorization, browser-session keys and
cross-origin requests. Agent keys cannot authenticate normal browser/admin/provider
APIs. Normal configured-host validation remains in force. CLI transport accepts literal 127.0.0.1 or localhost pinned to that address.
External clients can instead connect directly to the configured Studio `/mcp`
resource using OAuth sign-in and HTTPS for network access.

## Current commands

- `document.list`: permission-filtered files for one application.
- `document.inspect`: current saved file and a bounded UTF-8 preview (64 KiB), or
  binary metadata. Does not read unsaved editor state.
- `document.history`: existing canonical saved history.
- `document.rename`: current revision guard and recoverable canonical mutation.
- `document.version.create`: named checkpoint using the existing version service.

Supported app scopes are CAD, Map, Animation, Sketch, IO and Vector. Drive remains
the owner of its separate file-service UI; UI is a component gallery. Catalogs
reflect current grant/app permissions; they do not advertise missing product tools.
The qualified installed Map/CAD workers add their14/17 product commands and
enable saved-content editing for authorized users. Without installed product
workers the browser withholds that option. CAD uses its installed
Python/Node/FreeCAD runtime; no Python Studio server is involved. In-app provider
conversations have separate live-editor adapters for CAD, Map and Sketch; those
tools operate on the open document rather than using an automation bearer key.
See [installed product commands](NATIVE_PRODUCTS.md) and
[current agent coverage](../../dev/rebuild/AGENT_COVERAGE.md).

Commands reuse `studio_commands` typed input contracts and the canonical Documents
operations. A private delegated context rechecks user, grant, app and file authority
inside the same identity/ACL-locked database transaction that reads or commits.
Revocation cannot slip between a successful authorization and its commit. Agent
access is never converted into a browser session. Audit records contain command
and grant identifiers, not document content, credentials or raw command arguments.

The HTTP run envelope accepts an optional `operation_id` for writes. Reusing it
with identical arguments uses canonical receipts; changed arguments conflict and
current permissions are always checked. CLI accepts `--operation-id ID`; MCP accepts an explicit caller-owned
`_meta["aether/operationId"]`. Both require the host to advertise operation receipts
and the command to be writable, so an older host cannot silently ignore the ID.
They never automatically retry. Reuse an ID only for the exact same intended edit;
without one, an interrupted reply has an unknown outcome and must be inspected. Product worker bounds, cancellation and atomic content/command receipts are integrated.
Offline MCP remains separate migration work.

## Upgrade and recovery

Identity schema3 adds agent grants. Explicit migration accepts verified schema1/2
checksums and preserves existing accounts, sessions and all document history.
Serving refuses older schemas rather than implicitly upgrading them.

Operator recovery dumps use `dev/rebuild/native_backup.py` exclusions to omit
sessions, recovery tokens and delegated agent keys. Password hashes/accounts and
all document/history data remain in the private recovery copy. Connections must
be reissued after recovery/import. Ordinary restarts retain grants. This recovery
policy does not change database replication behavior.

## Qualification

`dev/rebuild/postgres_check.py --automation-only` runs eleven disposable native
HTTP/PostgreSQL tests, including a real Rust MCP client, schema2 upgrade,
current ACL/app checks, revocation/expiry/reset, guarded edits, exact retry,
identity-lock revocation ordering, atomic issuance limits/audit rollback, secret
boundaries and restart persistence. MCP and CLI explicitly replay the same edit
without creating another revision; changed arguments with that ID are rejected.
The full browser gate creates/dismisses/reloads/revokes a native connection and
checks that unavailable product editing is withheld. No real keys enter evidence.

Evidence: `.verification/framework-native-automation-2026-10-11/`.
The running installation and original files remain unchanged; this closes native
general-command authority, not all app services or the framework release gate.

## OAuth and Streamable HTTP MCP

Identity schema5 adds durable public-client registrations, pending authorizations
and audience bindings. Existing users, sessions, documents and connection keys
are preserved. `/.well-known/oauth-protected-resource/mcp` advertises the exact
configured resource and `/.well-known/oauth-authorization-server` advertises
registration, authorization and token endpoints. The `/oauth/authorize` browser
navigation opens Studio sign-in and an explicit consent screen. All consent APIs
remain session-authenticated, same-origin and bound to the account opening the
request. `/oauth/token` accepts form-encoded authorization-code exchanges only.

PKCE S256, exact client/callback/resource binding, short-lived single-use codes,
per-app edit permissions, grant expiry and revocation apply. Pending requests are
in PostgreSQL; restarts do not lose them. Tokens are hashed and never returned by
connection listings. OAuth tokens cannot authenticate browser or legacy command
routes. Restored backups omit active OAuth state and grant data. No refresh token,
CIMD URL fetch, public tunnel or external provider sign-in is fabricated.

`/mcp` returns ordinary JSON Streamable HTTP responses; GET returns405 because
there is no event stream. Each request authenticates independently, so no
process-local MCP session registry is needed. Tool lists and calls use the
existing automation catalog and canonical product dispatch. The shared
`aether_protocol_core::mcp` module also supplies the stdio adapter's catalog,
tool-name mapping, result shape and retry-ID rules. See the
[suite standard](../../dev/docs/roadmap/Agent_Access_Standard.md) for acceptance
criteria and remaining external live-editor coverage.

## Shared open editors (access schema22)

The same command endpoints now expose `editor.list`, `editor.inspect`,
`editor.invoke` and `editor.result` for content-edit connections. The user must
explicitly share an editor in a supported CAD/Map build. Invoke includes a unique
`operation` argument, a tool name and its product-defined arguments; poll the
receipt instead of rerunning. Unknown outcomes do not authorize replay. See
`dev/docs/roadmap/Agent_Access_Standard.md` for ownership, limits and deployment
status. Product panels may lag an installed native host; never imply a live
editor exists solely because the command catalog includes the transport.
