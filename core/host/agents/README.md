## Current native authority —2026-10-13

The installed Studio host is Rust; the Python control plane below is historical.
`chatgpt.mjs` is reused by native runtime, and Claude/Gemini adapters live in
`crates/server/providers/`. Product-owned open-editor tools perform real undoable
CAD/Map/Sketch edits. Qualified source now supports bounded PNG tool results,
Sketch drawing previews and Map calibration-mask previews through all3 provider
adapters; image support has not yet been promoted to the running installation.
See [agent coverage](../../../dev/rebuild/AGENT_COVERAGE.md) for the exact contract,
qualification, installed/source distinction and remaining gaps. No generator or
media creation is implied by preview support. Earlier no-edit wording describes
the superseded conversation-only implementation.

# Aether account-based agent plugins

Studio → **Plugins** contains a curated marketplace with three Aether integrations:
ChatGPT, Claude and Google Gemini. Administrators install, enable, disable and
uninstall them; every Studio user connects their own account. Members can browse
and sign in without gaining installation permission. No API-key form is provided.

Installation requires Node.js 22+. Claude and Gemini also need npm. Their pinned
official packages are installed into the Studio data directory, not a global CLI
or the repository. Installing ChatGPT enables the bundled public OAuth adapter.
Third-party arbitrary plugin uploads/remote marketplace feeds are not implemented.

## Connections

- **ChatGPT:** public Sign in with ChatGPT dynamic registration, PKCE, state and
  nonce; a loopback callback listener; signature/issuer/audience/expiry/nonce
  validation; per-account refresh credentials; account-specific model catalog;
  public Responses streaming with `store:false`. A browser on another computer
  can paste the final loopback callback URL if its local listener cannot open.
  Provider permission and eligible-plan access still determine whether inference
  succeeds. This new provider flow has not been end-to-end authorized in this repo.
- **Claude:** official Claude Code `auth login --claudeai`, `auth status` and
  streaming print mode. The account configuration directory is isolated per Studio
  user (the pinned runtime also scopes its macOS Keychain entry). All host tools,
  MCP servers and external setting sources are disabled for conversations.
- **Google Gemini:** official Gemini CLI ACP `oauth-personal` authentication,
  sessions, model selection and streamed messages. Its home override and file
  credential storage are isolated per Studio user. The core-tool list is empty;
  external permission/filesystem requests are denied. Expired credentials cannot
  silently launch another browser during a chat request.

**Claude and Google sign-in currently need a browser on the Studio host** because
those official flows use a local callback. Their runtime starts that browser only
on the user's Sign in action. Remote-device completion for these two providers
remains unqualified. An installed package or a successful handshake is not a
verified subscription conversation.

Disconnect clears Aether's local connection and credential storage; Claude also
executes its scoped official logout. To revoke an application's grant at the
provider, use that provider's account controls. Disabling stops active requests
and retains personal connections for re-enabling. Uninstall stops requests,
disconnects all accounts for that provider and removes its managed runtime.

## Ownership and lifecycle

`POST /api/agent/{catalog,install,enable,disable,uninstall,login,disconnect,
models,chat,job,cancel,code}` is same-origin and requires a Studio account. Chat
also checks the product's enabled/access policy. Provider jobs are owned by one
user, expire after fifteen minutes, and are cancelled after ten minutes running.
Subprocesses run outside the host's request lock. Disable/cancel terminates the
whole child process group. No credentials or raw CLI diagnostic output enter
API responses. `agents/accounts` and runtime files are excluded from host backups.
The public account label records the last successful authentication; quota and
expired-session errors are surfaced by subsequent provider requests.

`core/session/agent.ts` is the shared browser transport. `@aether/ui` supplies
`WorkspaceAgent`, a single-composer provider/model selector, streamed conversation
and stop control. It accepts a transport and app-owned context/messages. Hosted
products also have **Aether Agent** in the shared account menu, opening the same
panel in a right drawer (or focuses an existing product agent rail). Its generic entry attaches the app name only; richer
product adapters explicitly supply document context. Map supplies selected scene,
mask SVG, surface names, dimensions and requested animation duration. It retains
its offline creative-brief ZIP export. Messages are editor-session state, not a
persistent conversation database, and no automatic document changes are exposed.

## Media generation is not connected

All three current plugins advertise `imageGeneration:false` and
`videoGeneration:false`. They must not imply that an account plan grants a video
API. The requested follow-up is a capability-qualified media provider consuming
mask/reference + prompt + duration (15 seconds by default), returning a preview
for explicit scene/surface assignment. Existing projection-brief exports preserve
that input. Generated video, image generation, media job history and review/apply
are not implemented by these conversation adapters.

## Verification

- `.venv/bin/pytest core/host/tests`
- `node --test core/host/agents/chatgpt.test.mjs`
- UI tests/typecheck/build, Studio and Map builds
- Map `e2e/agent-marketplace.spec.ts` and `e2e/projection-export.spec.ts`

No test consumes an existing login or paid inference. Real provider sign-in and a
completed response with each intended subscription remain manual release gates.

Official references checked 2026-09-30:
- https://developers.openai.com/siwc/token-sharing-open-source/sign-in
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://code.claude.com/docs/en/authentication
- https://code.claude.com/docs/en/cli-reference
- https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan
- https://geminicli.com/docs/cli/acp-mode/
- https://geminicli.com/docs/get-started/authentication/
