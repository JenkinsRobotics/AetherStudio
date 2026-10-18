# Aether Rust server integration

Two explicit executables, **not the replacement Studio host yet**.

- `aether-server`: the compatibility command gateway documented below.
- `aether-native-host`: native PostgreSQL-backed browser account routes; see
  [NATIVE_HOST.md](NATIVE_HOST.md) for explicit provisioning and remaining gates.

The command gateway remains independent of native identity data at runtime.
It forwards authorized commands to one operator-selected local Python authority.
The gateway owns no database and does not serve the React application or account APIs.

With a disposable or explicitly selected development host already running:

```sh
AETHER_LEGACY_URL=http://127.0.0.1:8781 cargo run --locked -p aether-server
```

The default listen address is `127.0.0.1:8879`. Override `AETHER_RUST_LISTEN` to
another loopback address; port 0 requests an available port. There is no automatic
host startup, data migration, installation change or network exposure.

| Route | Contract |
| --- | --- |
| `GET /healthz` | Process liveness, not upstream readiness |
| `GET /v1/capabilities` | Explicitly reports legacy authority; no Rust storage, collaboration or durable retries |
| `GET /v1/commands` | Authorized legacy command descriptors |
| `GET /v1/commands/profiles` | Grant-filtered typed Studio command semantics; unknown product profiles stay null |
| `POST /v1/commands/run` | Versioned request/response; five Studio command shapes validated |
| `POST /api/automation/commands/list` | Existing CLI/MCP catalog compatibility |
| `POST /api/automation/commands/run` | Existing CLI/MCP execution compatibility |

Command routes require an existing `Bearer aether_agent_…` credential. They
forward it to the authority on every call; they never cache permissions.
Credentials are not accepted through URLs or ordinary session cookies. This
migration service is for local CLI/MCP clients: requests with an Origin header
are refused until a browser/session transport is explicitly designed.

Studio profile 1 covers list, inspect, history, rename and named-version creation.
It declares saved-state effects, revision guards, history behavior and retry
recovery separately from editor undo. Types generate into `@aether/protocol`.
Malformed success bodies preserve unknown outcomes after dispatch; additive
metadata is not stripped. See `../../dev/rebuild/COMMAND_PROFILES.md` for units,
branch behavior, type guarantees and remaining migration work.

Example request body (authenticate separately):

```json
{
  "protocol_version": 1,
  "request_id": "example:1",
  "command": "document.inspect",
  "arguments": { "app": "map", "id": "SAVED_DOCUMENT_ID" }
}
```

`request_id` correlates a response; it does **not** deduplicate execution. Use the
current saved `expected_revision` for mutations. Nothing is automatically retried.
Timeouts, broken responses or server failures after dispatch can follow a committed
save: an `unknown` execution state requires inspecting saved state before deciding
what to do next. Canceling an HTTP request does not cancel upstream work.

There are at most 64 active forwarded HTTP requests per process, no gateway
admission queue, a 30-second upstream deadline, a 256 KiB request limit and an
8 MiB response limit. Admission refusal is 429 with execution `not_started`.
Request/schema validation failure is 400; too large is 413. Authority permission
and revision failures preserve their status. Proxy environment variables,
redirects and transport retries are disabled. Only a literal `http://127.0.0.1`
upstream origin is accepted. Deadlines bound transport resources; timed-out work
may still be running in the authority. Durable job admission/cancellation is a
later framework gate.

Existing agents may opt in by setting `AETHER_SERVER_URL` to this gateway's origin
and retaining their scoped `AETHER_AUTOMATION_TOKEN`. See
`../../core/host/automation/README.md` for creating grants. The adapters are still
Python in this stage; the gateway and new transport definitions are Rust.

Build, compatibility tests and remaining gates: `../../dev/rebuild/README.md`.
