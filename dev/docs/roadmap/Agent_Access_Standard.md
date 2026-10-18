# Aether agent access standard

2026-10-13 — applies to Studio and every product. Implementation and evidence
are tracked in `dev/rebuild/AGENT_COVERAGE.md`; this standard is not a claim of
complete agent coverage in every editor.

## Ownership and authority

Each application owns its engine, command definitions, UI, and product-specific
AI/MCP/CLI adapters. Studio owns account sign-in, delegated access, permissions,
document history and the generic network MCP transport. Transport-neutral MCP
catalog contracts live in the existing Rust protocol package, with both stdio
and HTTP consumers. No separate CAD engine, app repository or alternate agent
document format is introduced.

A human and an agent invoke the same validated product operations. Agents have
their own revocable connection under the user's identity; this is delegation,
not account impersonation or an administrator bypass. Every request rechecks the
user's current application and document permissions. The authorization and saved
mutation share the existing identity lock and database transaction. An old tool
list never grants permission to execute a tool.

## Connection paths

* In-app assistant: the user connects a supported provider or local agent using
  the existing Plugins flow. Product editor adapters expose supported live tools.
* External local assistant: stdio `aether-agent mcp`, with an explicitly scoped
  Studio connection key in private client environment settings. Loopback HTTP is
  supported; `localhost` is pinned to 127.0.0.1 while preserving the Host header.
* External MCP client: the Studio origin's `/mcp` endpoint. Streamable HTTP uses
  JSON responses and the same catalog/command handlers as stdio. The client can
  use Studio OAuth sign-in or an existing scoped connection key.
* Standalone file editing remains product-owned and must not require installing
  SQL or Studio. Map has a local file CLI/MCP; other products' offline coverage
  must be stated individually, not inferred from the hosted transport.

Network MCP uses the configured HTTPS Studio origin. Loopback HTTP is available
for local development. Adding the endpoint does not expose a private host to the
internet or make a workstation's localhost reachable from a cloud assistant.

## Sign-in contract

OAuth authorization code with S256 PKCE, exact registered callback, exact MCP
resource audience and explicit user consent. Dynamic public-client registration
does not fetch client URLs. Display names are client-provided and are not verified
identities. Consent displays the callback and requires application selection;
read access is the default, saved content editing is a separate choice.

Authorization requests and code hashes are stored in tenant-scoped PostgreSQL,
not process memory. Codes expire after two minutes and are single-use. A consent
request binds to the first authenticated account opening it. Access lasts for
the user-selected 1 hour, 1 day or 7 days and can be revoked in Agent access.
This first OAuth implementation does not advertise refresh tokens; expiry
requires reconnecting. Bearer tokens are stored only as hashes and cannot be used
as browser sessions. OAuth-issued tokens are restricted to the MCP resource.
Browser cookies are rejected on MCP requests. Backup restore excludes active
sessions, grants and pending OAuth authorization data.

## Product command acceptance

Every new human authoring action should provide a discoverable command with a
strict schema, explicit units, appropriate read/write annotations and meaningful
results. UI, in-app agents, external MCP and CLI should share that command's
validation and engine semantics. A feature is not agent-complete merely because
an icon, stub, menu item or tool name exists.

Before claiming a product operation supports agents, verify:

1. The operation performs real work in its owning engine, including headless
   execution where supported, and rejects unsupported inputs explicitly.
2. Live changes use ordinary editor undo; saved changes use the ordinary format,
   revision checks and recoverable history. Saved writes refuse stale revisions.
3. Retry behavior is explicit. Caller-supplied `aether/operationId` metadata uses
   existing durable receipts; JSON-RPC IDs are only correlation IDs. Unknown
   transport outcomes must not trigger an automatic second edit.
4. Discovery exposes only currently supported, authorized operations. Agents can
   inspect before editing and verify afterward using exact model properties and,
   where the product implements it, rendered evidence.
5. Representative user and agent workflows produce equivalent saved documents.
   Permission refusal, undo/reopen and geometry or visual checks are covered.

External live CAD/Map control reuses each app's existing `AgentInteraction`.
The host supports four generic commands, shared across HTTP MCP and stdio/CLI:

1. `editor.list` finds currently shared editors owned by the delegated user.
2. `editor.inspect` returns that editor's product-owned tool schemas/context.
3. `editor.invoke` takes `editor`, `name`, `arguments`, and a caller-chosen
   `operation` ID. If MCP operation metadata is also present it must match.
4. `editor.result` takes `editor` and `operation` and returns a durable receipt.

All live commands currently require content-edit scope and document Editor rights,
including inspection. The browser also requires explicit per-editor sharing; it
supplies its own authenticated session and a private, hashed registration secret.
Server registrations are bound to the user/document/app/context. A different
account or grant cannot retrieve another caller's result. Grants are revalidated
by ID during browser delivery/heartbeats without persisting bearer tokens.

The browser checks authority every second during work, aborts on network/authority
failure, and uses the product's abort/current-document checks before commit. This
is not a distributed atomic transaction between a browser and SQL: a revocation
or disconnect racing a finished edit can leave an uncertain outcome. No automatic
undo or repeated execution is attempted. Inspect the current document/receipt.

Presence expires after15seconds without a successful heartbeat. A call expires
after2minutes; the browser aborts at110seconds. One pending call per editor,
16active editors per user,1000calls per registration and4096 retained registrations
per user bound the initial mailbox. A consumed request is never redelivered, even
after restart. Closed/expired running calls report `outcome_unknown`; queued calls
are cancelled/expired. Native backup restore excludes registrations and calls
alongside live credentials; normal product document history remains authoritative.
No browser session or active delegation is resurrected by restoring a backup.

“Share this editor” lives in the CAD/Map assistant panels. Leaving the panel,
changing document/context or reloading stops sharing. In-app provider conversation
and local file MCP remain separate adapters. Other apps and unsupported human
commands are not exposed by this generic mailbox. Consult the coverage report for
installed frontend versions: the server protocol alone does not install app UI.

## Protocol references

Implementation follows the MCP [authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
and [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).
The endpoint supports 2025-11-25, 2025-06-18 and 2025-03-26 protocol versions.
It does not advertise sampling, subscriptions, a general-purpose script runtime
or SSE streaming. POST notifications return 202; unsupported GET streaming returns
405. Product-specific bounded modeling programs remain ordinary validated tools.
