# Native Studio agent service

Implemented 2026-10-11 as an incremental migration. Rust now owns the authenticated
agent HTTP boundary, provider settings, personal connection metadata, bounded jobs,
and subprocess lifecycle. The existing ChatGPT JavaScript adapter still owns its
OAuth exchange and provider streaming. This route does not call the Python host.

Claude and Gemini now have optional native-owned CLI adapters as well. They retain
the existing subscription/ACP workflows, with independent settings, connections
and cancellation. Unconfigured providers remain unavailable. This is **not a
real-provider or release-readiness claim**: subscription sign-in/inference remains
unqualified against external accounts.
No test connects a real provider account or consumes paid inference. The original
installation and its provider credentials are not read or changed.

## Operator configuration

The native host always supports authenticated `POST /api/agent/catalog`. With no
configuration it returns the three curated integrations as unavailable, with no
installed/enabled/connected claims. Other operations require explicit runtime
configuration. Browser requests cannot select executables, directories or URLs.

Set `AETHER_NATIVE_AGENTS` to an operator-owned JSON file containing:

```json
{
  "root": "/absolute/private/native-agent-state",
  "node": "/absolute/path/to/node",
  "chatgpt_adapter": "/absolute/AetherStudio/core/host/agents/chatgpt.mjs",
  "claude": {
    "adapter": "/absolute/AetherStudio/crates/server/providers/claude.mjs",
    "cli": "/absolute/installed/claude-code/bin/claude.exe"
  },
  "gemini": {
    "adapter": "/absolute/AetherStudio/crates/server/providers/gemini.mjs",
    "cli": "/absolute/installed/gemini-cli/dist/index.js"
  }
}
```

Omit `claude` or `gemini` when their official CLI is not installed. The `cli` path
is an operator-provisioned JavaScript entrypoint (`.js`, `.mjs`, `.cjs`) executed
with the configured Node, or an absolute platform-native executable. Arguments
are passed directly without a shell; browser requests cannot select either path.
Distribute `protocol.mjs`, `editor-tools.mjs` and `mcp-editor.mjs` beside the
Claude/Gemini adapters. These adapters use the official CLI contract; their
local protocol fixtures do not certify an arbitrary newer CLI version.

The root's parent must exist. A new root is created mode0700; an existing root
must already be private. Use a new native-only root, outside public builds,
workspace assets and document objects. Do not point at the old host's agent
storage. Unix permissions/process groups are qualified; Windows configuration
is intentionally unavailable until equivalent protection is implemented.

Each tenant gets a hashed child directory and exclusive OS writer lock. Each
canonical Studio user gets separate hashed directories for each provider. The
original ChatGPT `plugins.json`/`accounts` layout is retained; the new providers
use sibling settings files/account directories. Disconnect/uninstall cannot
remove a different provider's connection. Settings and
public connection labels are atomically replaced with file and directory sync;
malformed stored state fails closed instead of being silently reset. A failure
to confirm durability after replacement is reported as an unknown outcome; the
controller stops accepting work and cancels jobs until the operator restarts it. Provider
credentials remain inside that user's private adapter directory. The operator
must exclude this root from normal backups/exports. Native database/content
backup commands do not traverse it. Reconnect provider accounts separately after
migration or disaster recovery; no provider credential import is implemented.

`install` verifies a Node22+ executable and enables the configured adapter and CLI.
It performs no npm install or provider login. Packaging the
adapter into a signed distribution remains a separate release gate.

## Existing browser API

All operations are same-origin POST JSON with the native Studio session cookie.
Temporary-password accounts cannot use agents. The routes use existing
Host/Origin/Fetch-Metadata and no-store rules; anonymous requests are rejected.

- `catalog`: public provider metadata and only the requesting user's connection.
- `install`, `enable`, `disable`, `uninstall`: current Studio administrator only.
  Immediate operations return the updated catalog so the existing Plugins screen
  refreshes correctly. Uninstall clears this tenant's provider connections.
- `login`, `models`, `chat`: background job; `chat` additionally requires current
  access to the requested product. Conversations accept user/assistant text and
  an optional product-supplied `tools` catalogue. Workspace context is explicitly
  labelled as data. Products without this catalogue remain conversational.
- `tool_result`: the job owner submits `{id,call_id,result}` for its single pending
  browser tool call. Current session/product access is rechecked. Results are
  `{ok:true,value}` or `{ok:false,error}`. Matching duplicate receipts are
  idempotent while the job runs; conflicting, unknown and cancelled calls fail.
- `job`, `cancel`, `code`: opaque job ID owned by the current user. Another user's
  ID returns404. Callback input is accepted only by a waiting login and never
  appears in the public job. Only that provider's approved HTTPS sign-in origins
  are exposed. Claude/Gemini currently require completing their loopback login in
  a browser on the Studio host; arbitrary callback text is refused for them.
- `disconnect`: deletes only the current user's provider connection/credentials.

Disable cancels running jobs. Disconnect/uninstall first cancel affected jobs and
return409 if their processes are still stopping; retry after cleanup. They never
remove credentials while a child could still recreate them. Provider-side grant
revocation is a separate provider account action.

The model list and generated text are projected through a strict JSON event
schema. Raw stderr and provider error details are not returned to the browser.
Errors are deliberately generic to avoid exposing credential-bearing diagnostics.
Tool-enabled jobs can edit the open document through its product's normal editor,
undo and save paths. The provider never receives a filesystem or shell tool.

## Live editor interactions — pre-alpha, 2026-10-13

The shared `WorkspaceAgent` accepts an optional product-owned `AgentInteraction`:
a stable document/context key, JSON-schema tool catalogue and cancellable execute
handler. Rust relays calls/results but does not define CAD or drawing semantics.
Polling is sequential. A receipt cache prevents a lost acknowledgement from
reapplying an edit. Stop, unmount and document/context changes cancel the job and
its handler. The panel shows the tool actions and their outcome.

ChatGPT uses Responses function calls with reasoning/output preserved between
rounds. Claude and Gemini receive only the supplied tools through an ephemeral
stdio MCP server backed by a private authenticated loopback relay. The MCP bridge
exposes `tools/list` and `tools/call`; it does not grant general computer control.
Claude's `--tools ""` disables built-in tools while the named MCP tools are
allowed. Gemini's private configuration includes only the named Aether MCP tools.

CAD currently exposes inspection, rectangle/circle/polygon sketches, extrude,
revolve, extrusion-depth changes, suppression, undo and redo in an open Part.
Dimensions are millimeters and angles degrees. Every edit must complete the
normal exact kernel rebuild before one history commit; rebuild failure,
read-only access, cancellation and intervening document edits prevent that commit.
Assembly editing and arbitrary CAD feature parity are not claimed.

Sketch exposes inspection, layers, rectangles, ellipses, paths, text, transforms,
styles, deletion, undo and redo. Coordinates are pixels. Drawing batches validate
before a single history commit and preserve locked/hidden content. The ordinary
document client saves successful edits; agents do not bypass file permissions.

These tools work on the currently open editor. They do not yet create/open files,
click arbitrary UI, export files or run unattended after the browser closes.
The existing saved-document CLI/MCP commands are separate. Map and the other
apps retain their existing integrations; this change adds live editing to CAD
and Sketch first.

Provider protocol references: [Responses function calling](https://developers.openai.com/api/docs/guides/function-calling),
[Claude CLI tools/MCP flags](https://code.claude.com/docs/en/cli-reference),
and [Gemini MCP configuration](https://geminicli.com/docs/tools/mcp-server/).

## Limits and lifecycle

- At most16 running jobs per tenant/service and one per user;256 retained jobs.
- Jobs expire from polling after15minutes; oldest completed jobs are evicted at
  capacity. Conversations remain transient, not a durable chat database.
- Ten-minute execution deadline; current session/product authority is checked
  approximately once per second, including when stdout closes but the process
  remains alive. Authority reads have a five-second timeout and fail closed.
-512KiB HTTP body;80 messages and100,000 combined context/message characters;
  model identifiers limited to120 bytes with a restricted alphabet.
-64KiB provider event,2MiB cumulative provider output,200,000 bytes of visible
  response text,100 models and a single queued callback write. Oversize output
  fails the request instead of pretending a truncated response completed.
- Tool catalogue:32 entries/64KiB,8KiB per schema, names under the `aether_`
  namespace. At most48 distinct calls per job, one pending call at a time,
  32KiB arguments/results and a120-second result deadline in the adapters.
- Subprocess environments are cleared. Only private HOME/TMPDIR and locale are
  set; macOS may add its text-encoding variable. No inherited provider keys,
  Node options, hooks, proxy settings, PATH or other host tool configuration.
  CLI children additionally receive their provider-specific private configuration
  directory. Gemini forces file credential storage, clears built-in tools/hooks/
  context files and denies ACP filesystem/terminal/permission requests. Claude
  disables built-in tools, external settings and session persistence. Only the
  per-job Aether MCP server is configured when the product supplied tools.
- Cancellation and completion kill/reap the process group. The child's stdin pipe
  is also a host-lifetime lease; an abrupt host exit closes it and the Node shim
  terminates the group. Ctrl-C and SIGTERM request orderly service shutdown.

This configuration is one active local service per tenant state directory. It is
not a distributed job scheduler, an operating-system sandbox or qualification
for hundreds of simultaneous inference jobs. Slow filesystem/controller workloads,
receipted chat retry after a lost initial response, multi-host scheduling and
provider-specific account recovery remain framework gates.

## Evidence

`.verification/framework-native-agents-2026-10-11/` retains HTTP/PostgreSQL,
subprocess, browser, lint and build evidence. Tests use a local fake Node provider
and fixture-only Studio identities, exercising the real native boundary and
private process state. The browser drives the actual built Plugins UI through
install, fixture sign-in, model/chat calls, disconnect and disable. Real account
eligibility, OAuth completion and a completed subscription response remain manual
release gates; adapter unit tests are not proof of provider acceptance.

The 2026-10-12 continuation uses the actual Claude/Gemini adapter files with a
local official-CLI protocol fixture. It covers subscription metadata, model lists,
streamed/fallback responses, malformed/oversize output, denied Gemini tools,
private environments, per-provider install/login/chat/disconnect/disable and
preserved ChatGPT connections. Run `node --test
crates/server/providers/providers.test.mjs` and the native `--agents-only` gate.
