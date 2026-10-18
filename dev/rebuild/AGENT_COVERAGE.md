# Agent, MCP and CLI coverage — updated 2026-10-13

**Not complete across all apps.** Saved-file CLI/MCP commands and open-editor
provider tools are distinct adapters. Both now perform real edits in their
declared scope; neither implies arbitrary UI automation or full app parity.
The native Rust host is installed on8780; the legacy Python hosts are retired.

## External live editor access — 2026-10-13

Server installed: `live-editor-access-20261013-r1/service-generation`, identity5 /
access22. All current frontends, worker/provider configuration and shared status
bootstrap are preserved.32 documents,609 revisions/operations,442 blobs and6
upload manifests remain intact; users, sessions and grants remain. PostgreSQL was
not restarted. Private recovery snapshot precedes the additive mailbox migration.

The command catalog adds `editor.list`, `editor.inspect`, `editor.invoke` and
`editor.result` to both HTTP MCP and stdio/CLI for content-edit grants. A signed-in
user explicitly shares one CAD/Map editor. Only that user's delegated agents can
find/use it, with current app/document rights checked at queue, delivery, execution
heartbeat and result. The browser calls the existing product interaction; normal
validation, atomic rebuilds, undo and autosave remain product-owned. No tokens are
stored in the mailbox. Queued/running/completed receipts survive host restarts;
a lost delivery is never dispatched twice. Uncertain outcomes require inspection.
PNG evidence uses native MCP image content without base64 duplication in text.

**App deployment complete:** CAD AdvisorPanel and MapAssistant expose
“Share this editor” through shared session 147/148. Their owning feature tasks
subsequently installed `cad-sketch-creation-20261013-r2` and
`map-effects-parity-20261013-r1`, retaining the schema 22 native binary. Both active
immutable bundles contain the sharing control; health/readiness return 200.
Authenticated asset requests remain guarded (anonymous requests return 401).
Actual editing was qualified in disposable authenticated browser fixtures, without
opening production documents. Sharing ends on leaving the panel/document, reload,
authority failure or timeout; standalone local files are not registered.

Verified:5 native mailbox/identity/upgrade tests,4 OAuth/MCP cases,11 automation,
13 preferences,6 backup/restore,86 shared-session cases,15 CLI/MCP cases,6 identity
units and13 protocol units. Typechecks, both product builds, release host/CLI and
the actual built-browser workflow pass. External HTTP MCP constructed an80×50×10mm
plate withØ10bore, verified39,214.601836602546mm³ and viewport PNG, exercised ordinary
undo/redo/save, created/positioned a Map surface, returned its mapping PNG and
confirmed autosave/reload/disconnect. Animation fixture roundtrip/pixels also pass.
No paid model or real ChatGPT/Claude/Gemini account was used. Full human-tool parity
and external provider enrollment remain incomplete. Evidence:
`.verification/live-editor-access-2026-10-13/RESULTS.md`.

## Unified agent connections — installed, 2026-10-13

The official Rust host at `http://localhost:8780` now serves Streamable HTTP MCP
at `/mcp`, with Studio sign-in, S256 PKCE and an explicit consent screen. Studio
→ Plugins → Agent access shows this URL and the retained local CLI/MCP path.
The new generation is `unified-agent-access-20261013-r1/service-generation`.

Both transports share the permission-filtered catalog and product command
handlers. Consent selects apps, read/edit scope and expiry; current file access,
revision checks, durable retry receipts and revocation remain authoritative.
Identity schema5 stores pending authorization/code/audience data durably and
hashes tokens. Existing users, sessions and grants were retained. The local CLI
also supports localhost pinned to127.0.0.1, matching this installation's Host.

A real browser signed in and approved CAD/Map access, then HTTP MCP built an
80×50×10mm plate with a10mm bore and verified its exact FreeCAD volume of
39,214.6018366mm³. Four saved features, revocation and cancellation passed.
The same test exercised the Agent access URL in the actual built Studio UI.
Animation's load/pose/serialize/save/reopen/image/pixel workflow also passed.

Checks:4 OAuth/MCP/database upgrade cases,15 CLI/MCP cases,11 existing automation
cases,5 service cases,13 account/workspace preference cases,6 backup/restore
cases,6 native HTTP cases,6 identity units,12 protocol units,16 Studio tests,
production Studio/Rust builds and the browser qualification. Older-schema test
fixtures now remove OAuth tables when reconstructing their historical baseline.
Before/after installed integrity:32 documents,609 operations/revisions,442 blobs,
6 upload manifests. PostgreSQL was not restarted. Latest Map flat controls,
all other product frontends/workers and provider storage were preserved. The
installed Studio asset references and JS/CSS hashes match the qualified build.

At this earlier generation external MCP edited saved documents only. The live
editor phase above supersedes that transport limitation; full human-tool parity
across the suite remains product adapter work. OAuth currently
uses authorization codes without refresh grants. Real Claude/ChatGPT/Gemini
client enrollment/inference has not been exercised with the user's account.
Network access needs the configured HTTPS Studio origin; no public endpoint or
tunnel was created. Evidence: `.verification/unified-agent-access-2026-10-13/`.
The binding target and ownership rules are in
`dev/docs/roadmap/Agent_Access_Standard.md`.

## CAD agent activation — installed,2026-10-13

`cad-agent-activation-20261013-r1/service-generation-v2` established the CAD
activation baseline; the newer unified-agent generation above retains its CAD
frontend and worker. It combines the qualified frozen CAD frontend/worker, matching
host, image-capable provider adapters and Animation archive codec. The latest
Map authoring generation and every other frontend were preserved. PostgreSQL
was not restarted; integrity retains32 documents,595 revisions/operations,
431 blobs and6 upload manifests. Earlier source-only statements below are
historical; the current tables describe installed CAD coverage.

Open CAD's AI advisor after connecting a provider in Plugins → My connections.
Its instructions now follow the active Part or Assembly, ask for discovery and
real modeling, and require exact/visual evidence before claiming success.
ChatGPT returning sign-in accepts the saved registered client when the callback
omits client_id; a mismatched client, callback state/origin/path or account
identity remains refused. Existing provider storage and CLI installations remain.

Qualification:69 CAD agent tests, final full CAD typecheck, production build,
8 Part and3 Assembly native host cases,6 host-agent unit tests,12 native agent
authority tests,3 provider protocol fixtures,6 ChatGPT adapter tests, and the
129.23-second frozen production CAD/native browser workflow. The browser used
a scripted provider to create and verify an80×50×10mm bored plate, return a
viewport PNG, undo/redo/save/reopen and compose/reopen eight Assembly instances.
The installed worker independently rebuilt/reopened the same plate with exact
volume39,214.6018366mm³ and mass0.3058738943kg at7,800kg/m³.
The Rust CLI/MCP bridge also passes14 tests and its release executable is built
at `target/release/aether-agent`; configure an app-scoped Agent access token
privately and use `http://127.0.0.1:8780` for that client's server URL.

Evidence: `.verification/cad-agent-activation-2026-10-13/`, plus CAD's
`.verification/agent-activation-2026-10-13/`. Installed app routes correctly
require sign-in. Authenticated workflow qualification used the frozen build in
an isolated host; the user's installed authenticated session and real external
provider inference remain untested. Existing legacy bundle fixtures and the
broader CAD project Bob-create fixture still fail separately. No full-suite,
ClassCAD API parity, arbitrary-script or offline/WASM claim is made.


## Map agent authoring — installed,2026-10-13

Map generation `map-agent-authoring-20261013-r2` is installed on the native8780
host. Product-owned discovery lists executable schemas,139 gallery visuals and
a working recipe. New visual create/edit commands, bounded atomic programs with
ID references/assertions and canonical composition verification run through the
same commands in the live editor, saved workers and a one-file local CLI/MCP.
Simple Visualization now has Agent tools for direct program execution without a
model connection. Ordinary undo/autosave apply to live edits.

The installed server retains its qualified executable and supports16 Map provider
tools. Hosts declaring `images-v1` enable two additional image tools (18 total).
Map detects this from actual job responses and never advertises image tools to
the old relay. A shader-source PNG can also be requested directly in the local
Agent tools panel. Complete composed-show images are not offered.

14 saved commands and the local MCP/CLI are qualified. Local access selects one
file at launch, defaults read-only and requires its current SHA for writes. It
can initialize a new ordinary show file; Studio creation remains separate.
See `../Aether-Map/docs/AGENT_GUIDE.md` in the sibling checkout for usage.
753 full Map tests,75 final focused/App/provider cases,16 packaged service/local
CLI/MCP cases and14 native Map HTTP/PostgreSQL/CLI/MCP cases pass. Native integrity
retains431 blobs,32 documents and595 revisions; all3494 frontend files match.
The database, binary and other apps are unchanged. CUA walkthrough is blocked by
the locked Mac; no real provider inference or new GPU preview certification is
claimed. Evidence: Map `.verification/map-agent-authoring-2026-10-13/`.

## CAD-owned AI and Assembly tools — source update,2026-10-13

Saved Assembly follow-up: the source catalog now has 17 commands (14 Part,
3 Assembly). `cad.assembly.inspect`, `.preview` and `.compose` operate on saved
binary archives through the same recipe/native solver used by the editor.
Inspection pages current identities and supplies the editor recipe example;
preview is read-only; compose returns one candidate for an atomic revision.
The generic host product boundary now supports trusted manifest-declared binary
commands while preserving existing Node/text behavior. A client cannot choose
encoding. Decoded-size and archive checks precede save; invalid or read-only
replacement content is refused. Real Assembly MCP/CLI retry and archive-reopen
acceptance pass. Evidence: CAD `.verification/saved-assembly-2026-10-13/`.
Promotion requires the matched host/worker; full frontend qualification is still
blocked by the separate failures recorded in the integration ledger.

Saved Part follow-up: the source catalog now has 14 commands. `cad.part.docs`,
`cad.part.runprogram` and `cad.part.verify` expose executable step schemas,
atomic multi-step modeling and exact measurements to saved-file CLI/MCP.
Programs share the editor implementation and qualify geometry/references between
steps. They support eight editing step types, not arbitrary JavaScript. The new
8-test native host gate includes real MCP execution followed by CLI receipt replay,
read-only refusal, stale revisions, no partial save and worker cleanup. Another
33 packaged/legacy native tests and 67 focused TypeScript tests pass.
Evidence: `../Aether-CAD/.verification/classcad-headless-2026-10-13/`.
These commands are source-qualified; the installed generation is unchanged.

CAD now owns discovery/examples, bounded Part programs, exact measurements and
current-viewport PNG feedback under `src/ai/`. Programs use ordinary product edits,
resolve native identities between steps and commit once; they are not arbitrary
JavaScript. Assembly tools use the validated recipe transaction. Native FreeCAD,
real browser/provider transport, analytical measurements, pixels, history and
save/reopen are qualified with a scripted model. See CAD evidence at
`.verification/assembly-recipes-2026-10-13/`. No external model inference, installed
promotion, complete CAD API or saved-file adapter parity is claimed.

## Shared operation lifecycle — source update, 2026-10-13

UI83 keeps authenticated job polling active during asynchronous editor actions.
A cancelled/failed/completed host job, denied access, workspace/host change, Stop,
page exit or unmount aborts the local operation and ignores late completion.
Products must observe the signal and recheck document identity before committing;
this is cooperative cancellation, not engine preemption or rollback of earlier edits.

Each action has a two-minute deadline. A status/result request has a 15-second
local wait bound (older transports may still finish the network request later).
Only one product operation runs at a time. Repeated call IDs reuse their receipt;
changed arguments or replacement of an unfinished call stop the turn. Delivery
retries stop after three failed attempts. The action trace distinguishes working,
returning/retrying results, confirmed completion, cancellation and unconfirmed
results; image thumbnails appear only after receipt acknowledgement.

All eight frontend sources adopt UI83 and session137–140. Session runtime files
are byte-identical to their respective preceding packages; only peers/version
changed. No installation promotion is included. This improves existing adapters;
it does not add tools to Animation, IO or the Vector shell.

Qualification:559 shared UI tests (18 new lifecycle cases), shared typecheck and
gallery build, all eight frontend builds and package adoption checks pass. The
108.05-second disposable native/browser gate verified candidate UI83 CAD, Map
and Sketch editor flows with real geometry/pixels, undo/redo and save/reopen.
It used scripted models and a previously qualified CAD worker. This is scoped
agent acceptance, not qualification of other concurrent CAD feature changes.
Evidence: `.verification/agent-operation-lifecycle-2026-10-13/summary.json`.

## Visual feedback contract — source update,2026-10-13

The shared UI/native/provider path accepts a typed `aether.tool-content` result:
product JSON in `value` and exactly one PNG in `images`. Products use
`agentToolContent`/`agentCanvasImage` from `@aether/ui/AgentToolResult`; plain JSON
receipts are backward compatible. `AgentJob.tool_result_format = images-v1`
advertises support; an older host gets an actionable error instead of image data.

Limits:32KB metadata,256KiB PNG,1024 pixels per edge,8 images per conversation
turn. The native host checks base64, PNG signature/header dimensions/end marker,
field shape, ownership and job budget. It does not decode PNGs or fetch URLs.
Retries compare SHA-256 receipts rather than retaining image payloads in job
status. Failed results cannot attach images. Images are excluded from Aether's
saved chat text/document history and shown in the local action trace. The selected
provider receives them through its normal conversation transport.

ChatGPT receives Responses `input_text`/`input_image` function outputs; Claude
and Gemini receive MCP text/image content through their private editor bridge.
No new filesystem, shell, screen-capture or arbitrary URL tool is granted.
Provider result-echo streams have bounded512KB records/6MiB totals only when
editor tools are enabled. Model output forwarded to Studio keeps existing limits.

Sketch previews reuse canonical SVG export (visible paths, paint, clips, text).
Map previews reuse the projection export **calibration mask at time zero**;
they expressly exclude shaders, text, media, audio and backdrop. A composed Map
pixel preview remains unimplemented because its live renderer is a DOM/video/
WebGL composition. Preview cancellation or a document change discards the image.
Neither preview changes selection, editing history or saves the document.

The visual-feedback slice first adopted UI82 with session133–136 retaining each
app's prior runtime variant and assets8. The operation-lifecycle slice above
advances those pins. These source updates are not yet installed on8780;
the running installation retains CAD10/Sketch8/Map11 live tools until a qualified
runtime generation is promoted. Actual external-provider image inference is
unqualified; protocol fixtures do not establish subscription/model access.

Protocol references: [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)
and [MCP tool results](https://modelcontextprotocol.io/specification/2025-06-18/server/tools).

Qualification:541 shared UI,690 Map,16 Sketch,6 native unit,12 native HTTP and8
provider protocol tests pass, plus all8 frontend builds and the90.69s actual
native/browser gate. Real color/mask pixels and unchanged source documents were
asserted; preview PNGs reviewed. Evidence:
`.verification/agent-visual-feedback-2026-10-13/summary.json`.

## Open-editor provider tools (current source)

ChatGPT, Claude and Gemini adapters can request the product's bounded tools through
the authenticated native job relay. The browser owns validation, current document
identity, undo and autosave; Studio does not implement modeling or mapping semantics.
Other apps retain conversational chat until they supply a tested live adapter.

The CAD primitive/reference slice is qualified by112 focused tests, native Cone
volume/bounds/profile-edit and STEP round trips, plus the119.62-second disposable
native/browser gate with scripted models and actual editor geometry, storage,
undo/redo and reopen. No installed promotion or saved CLI/MCP expansion is implied.
Evidence: `../Aether-CAD/.verification/classcad-features-2026-10-13/summary.json`.

| Product | Live tools | Limits |
| --- | --- | --- |
| CAD |16 installed Part tools: discovery, bounded multi-step programs, exact measurements, current-viewport PNG, inspect, direct feature references, five solid primitives, rectangle/circle/polygon sketches, extrude/revolve/depth, suppress and undo/redo. 5 installed Assembly tools: discovery, inspect, validated JSON composition, latest recipe undo/redo. | Open editor. Part edits and assembly templates/placements require native qualification before commit; proof is read-only. Arrays create individual instances, not associative patterns. Full sketch constraints, nested assemblies, additional mates, drawings and file creation remain incomplete. Real provider inference remains untested. |
| Sketch |9: drawing preview; inspect; layer; batched shapes/text; transforms; style; delete; undo/redo | Open drawing; protected layers/groups refused. No offline agent adapter. |
| Map |16 installed provider tools: discovery, atomic programs, composition verification, visual create/edit, inspect/evaluate, scene/surface create, bounds/rotate, asset placement, clip move/edit, undo/redo. Image-capable hosts add mapping-mask and shader-source PNGs (18). | Open show with scene/branch guards and ordinary history. Same product commands as saved/local CLI/MCP. No composed-show PNG, media uploads, camera permissions or playback/device control. |

Native/browser acceptance uses a scripted model, actual editor operations and
normal save/reopen. Live external-account sign-in and model inference are still
unqualified. Map evidence: `.verification/map-live-agents-2026-10-13/`.

## What exists

| Application | Existing hosted CLI/MCP commands | What is still missing |
| --- | --- | --- |
| CAD | Installed native Rust host:17 product commands:14 Part operations plus saved Assembly inspection, native recipe preview and guarded composition; plus general document commands | Full modeling/assembly/drawing coverage, new-file/export commands and offline adapters. Live tools are listed separately above. |
| Map | Native Rust host, legacy service and local-file CLI/MCP:14 commands including discovery, visual creation/configuration, atomic programs and verification alongside prior scene/surface/timeline edits; plus Studio general document commands | Studio new-file/media upload, corner/mesh editing, full composed pixel previews, complete editor/show/device controls and standalone browser/desktop qualification |
| Animation | General saved-document operations through Studio; Python engine/HTTP bridge exists separately | No registered product-specific MCP command catalog; full authoring/evaluation adapter and native/offline command integration |
| Sketch | General saved-document operations through Studio | No registered saved-document product MCP catalog or offline adapter; live drawing tools listed above |
| IO | General saved-document operations through Studio | No registered product-specific MCP command catalog; circuit/workflow operations and offline adapter |
| Vector | General saved-document operations when installed/enabled; app remains a shell | Vector editor and its command catalog/adapters |
| Drive (Studio workspace) | General document listing/inspection/history/rename/named-version operations within granted apps | Comprehensive Drive folder/upload/sharing/sync operations through the unified agent command catalog |
| Studio | Native Rust scoped grants, connection UI routes, separate bearer authority and five canonical document commands; authenticated provider tool relay | Other product-worker dispatch, broader administrative automation and remote enrollment |
| Aether UI | Shared component gallery, intentionally excluded from agent app grants | Not an independent document editor; no app editing catalog implied |

General commands are `document.list`, `document.inspect`, `document.history`,
`document.rename`, and `document.version.create`. Availability depends on installed
and enabled apps, current user/file permissions and the connection's scope.
Read-only grants expose three general commands plus installed product read tools;
saved content editing is a separate grant.
These commands address saved files, not in-memory editor state. Existing product
utility scripts and player launchers are not full app CLI/MCP coverage.

CAD command descriptors: `Aether-CAD/service/aether_cad_service/automation-commands.json`.
Map descriptors: `Aether-Map/service/aether_map_service/automation-commands.json`. Their built
Node workers reuse product editor operations; CAD native operations also depend
on the existing FreeCAD adapter. Animation's `AnimationService` has no registered
`automation_commands`; Sketch, Vector and IO have no installed product command
service in their current source trees. Studio's authoritative existing registry
is `core/host/automation/commands.py`; it only adds installed service descriptors.

## This migration step

`crates/automation-client` now provides the native Rust `aether-agent` executable
for CLI and MCP stdio. It consumes the same permission-filtered server catalog,
without copying command schemas or product semantics. The Python bridge remains
available as the comparison implementation. No running installation was replaced.

The Rust bridge is qualified against both disposable Python and native Rust
Studio authorities. Native identity schema3 now supplies hashed, expiring,
revocable app-scoped grants; general commands run through canonical Rust document
operations under current identity/app/file locks. Browser Agent access create,
one-time key display, reload and revoke are qualified. Ordinary browser sessions
never accept agent keys. Map's installed worker now supports native saved-show
editing with atomic content/command receipts. CAD now uses its installed zipapp
and existing FreeCAD boundary for the original 11 saved-part commands, including explicit
no-op receipts that preserve history.
See [native authority](../../crates/server/NATIVE_AUTOMATION.md).

`aether-local-files` is a separate qualified Rust CLI for ordinary files and crash
recovery. It does not provide product editing commands or an offline MCP server.
It has not silently replaced app file pickers or desktop adapters.

## Remaining implementation order

1. Native Studio agent grants and general command dispatch: qualified. Product
   Map dispatch is integrated through installed product-owned workers with bounds,
   cancellation, fresh authorization at commit and guarded revision/receipt
   semantics. CAD dispatch now uses the installed CAD zipapp and FreeCAD; neither geometry
   nor feature meaning is reimplemented inside Studio.
2. Explicit retry IDs now pass through CLI/MCP only when the native host advertises
   receipts. Automatic retry remains disabled. Native Map preserves generated
   clip IDs on exact retries and shares receipts between CLI and MCP.
3. Product command coverage and native/browser/offline adapters, CAD/Map first.
   Expose actual capabilities only; do not advertise planned tools as functional.
4. Trusted company-server enrollment (TLS and token protection), offline CLI/MCP,
   desktop integration and end-to-end per-app acceptance. Current loopback-only
   transport is deliberately unchanged.

Broader remaining gates include replacement engines, Tauri/offline qualification,
real company-network/farm workloads, storage qualification and distribution.
CAD/Map hosted compatibility and the original-demo account/file/history transfer
were qualified before the native installation replaced both legacy hosts.
See `CUTOVER_STATUS.md`; never restart the preserved legacy data as a writer.

Verification evidence for this slice:
`.verification/framework-cli-mcp-2026-10-11/summary.json`. No first push, original
user data mutation, provider connection or deployment change is included.

Native authority evidence: `.verification/framework-native-automation-2026-10-11/`.

Native Map product integration: [operator contract](../../crates/server/NATIVE_PRODUCTS.md).
Evidence: `.verification/framework-native-products-2026-10-11/`.

Native CAD integration evidence: `.verification/framework-native-cad-2026-10-12/`.
