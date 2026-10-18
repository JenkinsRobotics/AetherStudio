# Aether agent command access

Rust CLI/MCP replacement: [`crates/automation-client`](../../../crates/automation-client/README.md).
The native Rust host now owns general document-command authorization/execution;
this Python host retains the legacy product adapters during their migration. See
[native authority](../../../crates/server/NATIVE_AUTOMATION.md). See the
[per-app coverage audit](../../../dev/rebuild/AGENT_COVERAGE.md).

This is separate from `core/host/agents/`, which owns AI provider conversations.
It exposes existing platform file operations to external scripts/agents through
an expiring, user-delegated connection. No model subscription is needed to test it.

## Connect locally

1. Run the new platform development server; sign in with a local Studio account.
2. In personal **Plugins → Agent access**, choose a connection name, applications,
   expiry and read, rename/version, or saved-document editing access. Create the connection and copy its key.
3. Configure your MCP client's executable as the platform `.venv/bin/python`, with
   arguments `-m core.host.automation mcp`, and working directory `AetherStudio`.
   Supply `AETHER_SERVER_URL=http://127.0.0.1:8781` and
   `AETHER_AUTOMATION_TOKEN=<your connection key>` through its private environment
   settings. Do not commit keys or pass them in URLs/command arguments.
4. The client discovers tools through MCP `tools/list`. Revoke the connection in
   Studio when finished; keys are only shown when created.

The client accepts only literal `127.0.0.1` with an explicit port and rejects
redirects/proxies. Hosted-server enrollment is future work. Existing development
accounts and databases are local; this does not connect an external AI provider
or send documents anywhere on its own. A configured agent may receive document
content when it calls inspection, according to the access explicitly granted.

For local scripting, the same environment supports:

```sh
.venv/bin/python -m core.host.automation list
# JSON arguments come from stdin, never a shell-interpolated document string:
.venv/bin/python -m core.host.automation run document.list < arguments.json
```

## Commands

| ID / MCP name | Behavior |
| --- | --- |
| document.list / document_list | App-specific saved file-name search and listing |
| document.inspect / document_inspect | Saved metadata and up to 64 KiB UTF-8; metadata only for binary files |
| document.history / document_history | Existing revisions, named versions and branches |
| document.rename / document_rename | Edit grant; required expected_revision; existing Library rename/history |
| document.version.create / document_version_create | Rename/version grant; required branch head expected_revision; existing History named version |
| map.show.inspect / map_show_inspect | Installed Map service: scenes, surfaces, timelines, tracks, assets and clips |
| map.show.evaluate / map_show_evaluate | Installed Map service: Main scene composition and audio at `time_s`, not a pixel preview |
| map.clip.move / map_clip_move | Saved-document editing grant; existing clip/track IDs and `start_s`; latest expected_revision |
| map.clip.edit / map_clip_edit | Saved-document editing grant; duplicate/delete/split/trim; latest expected_revision |

Every command has a strict JSON input schema. The catalog only advertises commands
available to the connection, and authorization is checked again on execution.
File permissions and current application entitlements still apply. Folder edits,
raw file-content replacement, unsaved editor state, pixel previews, arbitrary
code, network actions and hardware commands are not exposed by this slice.

Named versions are not autosave revision numbers. Rename creates ordinary history;
these saved-file operations do not participate in an open editor's in-memory undo
stack. Existing editor revision conflicts protect against overwriting a newer save.

## HTTP contract and credentials

Browser sessions use same-origin JSON POST at
`/api/automation/connections/{list,create,revoke}`. Agent keys cannot manage grants.
`create` accepts label, apps, can_write (default false), can_edit_content
(default false; requires can_write), lifetime_hours (1–168, default 24); the clear token is returned once. Only its SHA-256 hash is stored.

`/api/automation/commands/{list,run}` accepts an agent bearer token; `run` takes
`{id,arguments}`. Command payloads remain out of audit logs; the connection id and
command id identify calls. Revocation/expiry, account disable/password reset and
removed app/file access take effect on the next request. Backups omit grants and
restore clears them. Browser origin checks remain in place; non-browser bearer
calls without an Origin are accepted only at command routes. These credentials
cannot call ordinary admin, account, library or product API routes.

The bridge implements MCP initialize/initialized, ping, tools/list and tools/call
on newline-delimited JSON stdio (2025-11-25, 2025-06-18 and 2025-03-26). Unknown
methods are protocol errors; command failures return isError. It has bounded
requests/responses and does not advertise cancellation, resource subscriptions,
sampling or HTTP MCP transport.

## Verify

```sh
.venv/bin/python -m pytest core/host/tests/test_automation.py
.venv/bin/python -m pytest core/host/tests
```

Tests start a disposable real HTTP host and stdio subprocess, edit a document,
verify its history, reject stale revisions and check authorization/revocation.
The UI was walked through create, reload with hidden key and revoke on an isolated
host. No existing accounts, production data or third-party AI credentials are used.

## Product adapters (platform/service 0.2.0a2)

Operator-installed products register namespaced `Command` descriptors with a fixed
app constraint and saved-document adapter. The host authorizes the grant and file,
checks the revision before invoking the adapter, then saves returned content through
Library/History. A read-only command cannot return replacement content. Command IDs
use dot-separated lowercase words/numbers to remain unique when mapped to MCP names.
Products own their parser, migration, evaluator and editing logic; the platform
never imports their source tree or interprets their document format.

Map ships a bundled Node worker built from its browser command/evaluator modules.
The wheel contains that runtime; Node must be available on the server. Edits keep
locks, media compatibility, nesting, source/target identity, timing and history.
The editor and agent use one `normalizeDocument` upgrade path. Agent changes are
saved revisions, not injected live canvas changes; an open editor must reload.

Existing grants retain their original scope after the database upgrade. The new
`can_edit_content` permission is explicitly selected as **Edit saved documents**.
A rename/version grant does not permit Map timeline edits. No device/hardware,
provider sign-in or external connection is implied by this permission.
