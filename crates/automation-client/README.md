# Aether agent CLI and MCP bridge

Rust replacement for `python -m core.host.automation`. It exposes the existing
Studio command API through `aether-agent list`, `aether-agent run COMMAND` and
`aether-agent mcp`. The server remains responsible for grants, current app/file
permissions, guarded writes, history and product dispatch. This crate owns only
transport and protocol presentation; there is no second product command registry.

**Installed state,2026-10-13:** the native Rust host provides scoped connection
management, five general document commands, 17 CAD commands and 14 Map commands
through the installed product workers. CAD includes atomic Part programs, exact
verification and saved Assembly composition. The executable never starts or
falls back to another host. Open-editor tools use a separate in-app adapter.
See [native authority](../server/NATIVE_AUTOMATION.md) and
[coverage](../../dev/rebuild/AGENT_COVERAGE.md).

## Use

Build from the Studio source repository:

```sh
cargo build --locked -p aether-automation-client
```

Create an expiring, app-scoped connection in the existing Studio **Agent access**
panel. Configure `AETHER_SERVER_URL=http://localhost:8780` (or the exact loopback origin configured for your server) and
`AETHER_AUTOMATION_TOKEN` in the client's private environment. Never pass keys in
command arguments or URLs. For MCP, the executable is the absolute path to
`target/debug/aether-agent` (or your release build); arguments are `["mcp"]`.
No Python interpreter is needed by this executable or the Rust server. CAD's
product-owned FreeCAD worker still uses Python and Node.

```sh
target/debug/aether-agent list
target/debug/aether-agent run document.inspect < arguments.json
```

`arguments.json` is an object using the schema returned by `list`. Saved writes
require the inspected `expected_revision`. MCP names replace periods with
underscores, e.g. `map.clip.move` becomes `map_clip_move`. The bridge re-fetches
the permission-filtered catalog before each MCP tool call. The authority checks
permissions again at execution. No connection gains more rights by using the CLI.

## Protocol and limits

- MCP stdio initialize/initialized, ping, tools/list and tools/call; versions
  2025-11-25, 2025-06-18 and 2025-03-26, preserving the existing bridge's negotiation.
- Strict JSON/UTF-8 with bounded nesting; newline frames at most 1 MiB. Oversized
  frames are drained with bounded memory, allowing the next request to proceed.
- CLI arguments at most 1 MiB; host responses at most 8 MiB; catalogs at most
  1,024 uniquely mapped commands and 128 app IDs. Invalid catalogs fail closed.
- Literal `http://127.0.0.1:PORT` only. DNS names, alternate numeric host spellings,
  credentials/queries/paths/fragments, proxies and redirects are rejected/disabled.
- Five-second connect and thirty-second HTTP deadlines. No automatic HTTP retries.
  Failed/invalid responses after a command may leave its outcome unknown; inspect
  before deciding whether to retry. For a host advertising operation receipts,
  CLI `run COMMAND --operation-id ID` or MCP tool-call
  `_meta: {"aether/operationId":"ID"}` can explicitly identify an edit. Reuse the
  same ID and arguments only for the same intended edit. Hosts without this
  capability are rejected before sending the edit; reads cannot use retry IDs.
  MCP request IDs are never treated as edit identifiers.
- Errors do not echo raw host diagnostics, headers, tokens or input. stdout carries
  only CLI result JSON or MCP frames; diagnostics use stderr.
- No HTTP MCP listener, remote enrollment, credential issuance, editor selection,
  unsaved document access, sampling, resources, hardware or arbitrary code tools.
  No cancellation/progress capability is advertised; requests are sequential.

The framing and tool-result shapes follow the official
[MCP stdio transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
and [tool specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).

## Verify

```sh
cargo test --locked -p aether-automation-client
cargo build --locked -p aether-automation-client
AETHER_AUTOMATION_BIN="$PWD/target/debug/aether-agent" .venv/bin/python -m pytest \
  core/host/tests/test_automation.py \
  core/host/tests/test_automation_products.py \
  core/host/tests/test_automation_native_client.py
```

The framework gate builds this executable and supplies its resolved Cargo target
path, so native compatibility tests cannot silently skip there. Tests use private
HTTP authorities and disposable files/accounts. They cover MCP saved edits,
stale revisions, product dispatch/history, read-only/app scopes, revocation in an
already-open MCP process, expiry/password reset/account disable/access removal,
malformed framing, bounded responses, proxy bypass and redirect refusal.

## Studio sign-in through HTTP MCP

Compatible MCP clients can use `http://localhost:8780/mcp` on the installed
computer, or the configured Studio HTTPS origin followed by `/mcp` from another
workstation. Studio publishes OAuth protected-resource and authorization-server
metadata. The client registers its callback, uses S256 PKCE, and opens the Aether
consent screen. Select apps and access, then approve. No provider password is
shared with Aether and no Aether password is shared with the assistant.

These are the same authorized commands as the local bridge, including current
revision checks and durable operation receipts. Revoke a connection under
Studio → Plugins → Agent access. Connections expire at the chosen deadline;
refresh grants are not advertised yet. A cloud assistant must have a supported
way to reach the server; this implementation does not publish a private host.

The CLI's stdio path still uses a privately configured connection key. It pins
`localhost` to 127.0.0.1 while retaining the configured Host, rejects proxies and
redirects, and never starts an alternate server. OAuth-issued `aether_mcp_` tokens
are resource-bound to `/mcp`, not accepted by the CLI's older command routes.
See [the suite standard](../../dev/docs/roadmap/Agent_Access_Standard.md).
