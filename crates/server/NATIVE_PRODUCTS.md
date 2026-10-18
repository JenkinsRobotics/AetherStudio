# Installed product commands and browser services

The native Studio host runs product-defined saved-file commands without forwarding
to the Python Studio host. CAD's source catalog now contains 14 Part and 3 Assembly
commands; the running catalog depends on the promoted bundle. Each product
owns its parser, editing operations and evaluator; CAD retains its replaceable
FreeCAD geometry boundary. Studio owns authorization, saved content, revision
history and command receipts. This is a product adapter migration, not a Rust
rewrite of product engines or full editor/device command coverage.

## Install explicitly

Build the Map package with `npm run build:automation` in its repository. The
installed product's `aether_map_service/runtime/` contains `runner.mjs` and
`native-worker.json`; the service wheel includes both. The manifest carries
product-owned public command schemas and the SHA-256 of the single-file worker.
The legacy Python service uses the same `automation-commands.json` catalog.

Copy that runtime directory into an operator-owned installation location. Create
an operator configuration with absolute paths, for example:

```json
{
  "schema": 1,
  "node": "/absolute/path/to/node",
  "manifests": ["/absolute/path/to/map/runtime/native-worker.json"]
}
```

Set `AETHER_NATIVE_PRODUCTS` to the configuration path when serving Studio.
Explicitly migrate to access schema17 first; identity3/storage3 are unchanged.
Serving never performs migrations. With no product configuration, the five
existing document commands remain available and no product tools are advertised.
Invalid hashes, duplicate apps/commands, unsupported schema vocabulary, relative
executable/manifest paths and unexpected entry names prevent startup.

Only trusted operator bundles are supported. Hashes bind the worker to its
manifest; they do not certify an untrusted vendor or provide an OS sandbox.
At startup Studio snapshots verified worker bytes into a private directory, so
changing a package file during a request cannot replace the loaded worker.
Executable paths, arguments and bundles never come from an agent request.

### CAD installation

Run `npm run build:automation` in Aether-CAD before building its service wheel.
The packager uses `python3`; `AETHER_BUILD_PYTHON` can select another build interpreter.
The wheel includes `runtime/runner.pyz` and `runtime/native-worker.json`.
The zipapp contains CAD's existing JavaScript prepare/finalize worker, its Python
FreeCAD adapter/worker and attribution. No Studio Python package, database or
site packages are imported at runtime. All seventeen descriptors come from CAD's
canonical `automation-commands.json`, also consumed by its legacy service.

Configure `python` and `freecad` alongside `node` and add the CAD manifest:

```json
{
  "schema": 1,
  "node": "/absolute/path/to/node",
  "python": "/absolute/path/to/python3",
  "freecad": "/absolute/path/to/freecadcmd",
  "manifests": [
    "/absolute/path/to/map/runtime/native-worker.json",
    "/absolute/path/to/cad/runtime/native-worker.json"
  ]
}
```

Python3.11+ and a supported installed FreeCAD are operator prerequisites. The
`runtime: "python"` manifest selects the isolated zipapp runner (`-I -S`); the
omitted/default `node` runtime remains compatible with existing Map manifests.
The verified zip bytes are snapshotted just like Node bundles. External Node,
Python and FreeCAD binaries remain trusted operator-installed dependencies, not
vendored or cryptographically certified by the bundle hash.

CAD covers Part inspect/evaluate/topology, extrusion depth/end-offset preview/edit,
revolve preview/edit, feature suppression/reordering, bounded programs/discovery
and exact properties, plus Assembly inspect/preview/compose. Native validation and
body/sketch-frame finalization reuse the product's existing editor semantics.
This is bounded authoring coverage, not arbitrary modeling, complete assembly/
drawing parity, or unsaved editor control.

### Binary saved documents — source extension, 2026-10-13

An operator manifest may declare `binary_commands`, a list of its own command IDs.
Unknown IDs or duplicates prevent startup. Omission preserves existing UTF-8
behavior. For a declared command the host sends the usual content string as base64
with `content_encoding: "base64"`. Returned content must be strict base64 with a
decoded size at most 4 MiB. The host decodes before the ordinary atomic save and
retains authorization, expected revision, history and operation receipts.
Read-only commands still cannot return replacement content. No client argument
can select encoding. Browser services retain their existing explicit contracts.

The encoded-content ceiling is 5,592,408 bytes; the 8 MiB total output and 16 MiB
input envelope limits still apply. CAD independently bounds archive decompression
and validates the complete recipe/native result. Existing Node workers remain
compatible. This requires the updated server with the updated CAD bundle; old
hosts reject the new manifest. Source qualification does not promote an install.

## Scope and limits

- `map.show.inspect`: saved scenes, surfaces, tracks, assets and assignments.
- `map.show.evaluate`: saved Main composition at a time; geometry/audio state,
  not rendered pixels, live cameras or device playback.
- `map.clip.move`: move an existing clip using Map's editor rules.
- `map.clip.edit`: existing duplicate/delete/split/trim actions.

Read tools require current app/file read access. Writes also require both write
and saved-content-edit grants and a current expected revision. Agent access UI
shows saved-content editing when an enabled installed app supplies write tools.
Opening another application does not grant it a product command adapter.

Each worker runs with a cleared environment and private working directory, no
shell, a 256 MiB Node old-space limit, 4 MiB source/output-content limits, an 8 MiB
stdout limit and 64 KiB stderr limit. Node workers have a10 second deadline;
CAD zip workers have a35 second deadline (their FreeCAD exchange is bounded
to25 seconds). Each invocation gets a private disposable working/HOME/temp
directory. Ambient credentials, Python site packages and shell settings are
not inherited. Two workers may run
concurrently per host. At most8 product requests are admitted, including those
two running processes; a slot may wait up to10seconds. Excess requests are refused
before execution, and cancellation releases both reservations. This lets normal
CAD capability/geometry startup overlap without an immediate third-request503.
Old-space is a JavaScript heap limit, not a total process-memory guarantee.
On Unix, cancellation/timeout kills the process group; normal host ownership must
remain alive for these guards. Abrupt host death/power-loss process cleanup is
not a qualified guarantee. No automatic worker retry is performed. Node old-space bounds do not apply to
Python/FreeCAD; total native process memory remains an unqualified limit.

## Authorization and durable retries

Studio reads the saved Main revision under current grant/app/file locks, then
releases the transaction and connection before executing product code. A fresh
transaction checks authority again before releasing a read result or committing
an edit. Revocation and concurrent saves therefore cannot be bypassed by a slow
worker. Read commands cannot return replacement document content.

Writes use the canonical guarded content mutation. Content, revision/audit and
`aether_access.automation_receipts` commit together. A caller-supplied operation
ID identifies a product invocation for that actor; the receipt fingerprints the
command and arguments. A repeat returns the original result (including random
clip IDs) with `replayed:true`, even if later revisions exist. Different arguments
conflict. Current permissions are checked before returning a stored receipt.
The worker's raw replacement content is not exposed in the command response.

Validated no-ops return `unchanged:true` instead of replacement content. The
host rechecks the current expected head and authority, and records the exact
result without adding a document revision. Concurrent saves conflict; replay
returns the original no-op result even if a later save exists. Read tools cannot
return either replacement content or a write/no-op marker. Missing write output
is not implicitly interpreted as success.

CLI: `aether-agent run map.clip.edit --operation-id <stable-id>` with arguments
on stdin. MCP uses `map_clip_edit` and `_meta["aether/operationId"]`. Both use the
same catalog and receipts. Without an explicit ID an interrupted reply remains
an unknown outcome; inspect saved history before deciding what to do next.

## Qualification

`dev/rebuild/postgres_check.py --products-only` uses built Map/CAD workers,
product-owned fixtures and an installed real FreeCAD resolved from the development
`projects.json` and explicit operator/test executable paths. These
sibling paths are test setup only, not production runtime imports. CI checks out
Map and CAD explicitly and can pin `AETHER_MAP_REF` / `AETHER_CAD_REF` to
coordinated release commits. Its FreeCAD installation and product builds are
required, not skipped.
Qualification also accepts explicit `AETHER_TEST_MAP_WORKER` and
`AETHER_TEST_MAP_FIXTURE`, `AETHER_TEST_CAD_WORKER`, `AETHER_TEST_CAD_FIXTURE`,
`AETHER_TEST_CAD_PYTHON`, and `AETHER_TEST_CAD_FREECAD` paths. Remote CI has not run for these unpushed
changes. Full native
PostgreSQL qualification includes these tests. Detailed evidence is in
`.verification/framework-native-products-2026-10-11/`.

Map browser/device services, CAD document settings/workspace metadata routes, broader
app command coverage, offline MCP and remote TLS enrollment remain open.

CAD qualification evidence: `.verification/framework-native-cad-2026-10-12/`.


## CAD browser engine services

The same installed CAD package now supplies POST `/api/cad/geometry`, `/export`,
`/analysis`, `/assembly`, `/mate-kinds` and `/engine` (each under `/api/cad/`).
The optional manifest `services` array lists exact app-scoped paths. Installation
rejects duplicate paths, foreign app prefixes and nested/traversal paths. Existing
Map command-only manifests remain compatible. Rebuild/install the CAD bundle to
include these services; a missing runtime/service returns503, never a legacy proxy.

These are stateless operations on caller-supplied features/assemblies. They neither
open a Studio document by ID nor save one. Saved-file editing still requires the
separate canonical document/automation commands and revision guards. CAD owns one
`browser_runtime.py` implementation shared by the old host and isolated zipapp;
no feature/assembly semantics or FreeCAD source were rewritten in Studio.

Browser session, current account/password status and enabled/team-authorized CAD
access are required. Agent bearer keys cannot call these browser endpoints. SQL
transactions/connections are released before work and current authorization is
checked again after it, including on worker errors. The compute request is not
an implicit grant to read stored documents. Disabling CAD/revoking a session during
work suppresses the result. No document revision or command receipt is created.

Requests cap at4MiB JSON, with8MiB worker stdout and the existing35s Python/25s
FreeCAD limits. CAD requests share the bounded document admission queue and the
two product worker slots; they cannot consume the separate account/control slots.
The invocation creates a fresh FreeCAD process; persistent worker pools, total
native memory bounds and company-scale performance remain unqualified. The same
Unix process-group cancellation/private working-directory guards as automation
apply. This does not add desktop/offline CAD or replace FreeCAD with Rust.

Successful browser response shapes are preserved. The native engine description
omits the operator executable `command` path; native unavailable errors are generic.
No UI consumer used that path. Feature diagnostics/results remain CAD-owned data.
The product's512-feature/512-instance checks still apply; too-large input/output
is refused. Invalid JSON/types/formats fail without any saved-file change.

Qualification: `postgres_check.py --products-only` includes Chromium running the
actual CAD geometry/assembly adapters plus browser export/analysis requests, real
FreeCAD geometry/section/STEP/STL/assembly tests, access changes during work, input
limits and read-only worker-envelope checks. `AETHER_TEST_CAD_FIXTURE` must sit
beside the product's `browser-requests.json`; the browser check uses the installed
product development dependencies and Studio `core/files` Playwright/Chromium.
The built wheel is also tested with Python `-I -S`, then both exported formats are
reopened by FreeCAD and measured at10×20×5mm /1000mm³. Evidence:
`.verification/framework-native-cad-browser-2026-10-12/`.


## CAD project containers

POST `/api/library/project_create`, `project_read` and `project_edit` now use the
installed CAD document codec and native Studio storage. Project and assembly
containers retain their `.acad` / `.acasm` format. The six existing edit operations
are preserved: add Part, add Assembly, insert Part, save Part, link Part and update
linked Part. Native branch selectors are stable IDs; historical reads are read-only.

Creation/edit requires `operation_id`. Creation generates deterministic container
identity for an exact retry; editing transforms the immutable `expected_revision`.
Both commit through the canonical library mutation and its receipt, ACL, revision
and audit transaction. Stale edits conflict. Linked sources are fetched under
current read authority and rechecked under the target save's transaction locks.
Workers receive bytes and authorized source snapshots, never sessions or SQL.
Read results also recheck file authority/head after computation.

The codec is packaged from a fingerprinted, local Animation wheel; only its five
pure-Python workspace/project/vocabulary modules are included. Relation vocabulary
was separated from numerical playback without changing it. CAD does not load the
Animation application, NumPy, Studio Python or sibling source at runtime. This is
compatibility reuse, not the planned Rust engine replacement.

The three `/api/cad/project-*` names are internal installed-worker service keys;
the public stateless `/api/cad/{action}` route rejects them. They are not new
CLI/MCP commands. Container input is capped at6MiB; expanded ZIP contents are
capped at6MiB and256 entries with duplicate/encrypted entries refused. Existing
worker output/time/concurrency limits still apply (large expanded projections may
hit the8MiB output ceiling). Missing workers fail explicitly; no old-host fallback.

Session alpha59 routes Home project creation/editing through guarded transport.
Studio and CAD consume it. CAD keeps the branch selector in project reads,
structural edits and Part/Assembly links. Its hosted-file adapter imports the
small file-type entry point without loading geometry/text-shaping code.

Qualification evidence is recorded in
`.verification/framework-native-cad-projects-2026-10-12/`.
The settings section below supersedes the metadata/settings gap in this earlier checkpoint.
Map browser/device services, broader agent coverage, engine/native/offline work
and final cutover qualification remain open.


## Native CAD document settings — 2026-10-12

Native Studio now supports `cad_metadata` and these `cad_operation` actions:
`details`, `units`, `properties`, `delete_item`, `restore_item`, `rename` and `copy`.
The CAD-owned `CADDocument` codec is reused for both legacy and native paths.
Its units catalog is extracted at build time from CAD's fingerprinted shared-assets
archive and packaged in the wheel/zipapp, so it no longer imports Studio Python.
Project ZIP limits/checksums and installed-worker bounds also apply to settings.

The adapter reads an authorized immutable base, performs the product transform
outside SQL, then rechecks current authority when committing. Settings writes use
stable operation IDs and optimistic revisions; exact retries return the original
receipt. `save_named` is an additive protocol change that commits the embedded
CAD name and filename together in one revision, including on a named branch.
Protocol alpha10 is a new immutable local archive; existing client pins and wire
variants remain valid. No database schema change is needed.

Metadata reads recheck file/branch/account access after the worker. Linked-source
availability and latest revisions are projected under current source authority;
private source heads are omitted. Historical settings are read-only; authorized
readers can make a private copy. Copying does not transfer source access grants
or history. The browser keeps branch selection for settings and uses guarded
shared transport for writes; lost replies do not silently retry or reload drafts.
The legacy adapter explicitly refuses non-Main settings requests rather than
misapplying them to Main. The internal `settings-read`/`settings-edit` worker services are not public CAD
HTTP routes or additional CLI/MCP commands.

`cad_operation` now also supports **move and update**. Main-file moves require
owner access and an editable folder in the same sharing location; folder state,
content revision, audit and retry receipts commit together through the existing
structural/storage authorities. A filename collision fails without moving the file.
Moving from a non-Main branch remains explicitly unsupported because folder
location belongs to the complete file, not one branch.

Updates reuse CAD's feature-format migration and linked-part replacement logic.
Studio resolves authorized source snapshots and verifies source heads and access
again at commit. Concurrent source changes return a conflict; exact retries return
the already committed result even if a source has since advanced. Replay still
requires current target/branch/source access. Branch updates leave Main unchanged.
Source accumulation is bounded by the existing 16 MiB worker-input limit before
dispatch; oversized batches fail without saving.
No database schema change, new public worker endpoint or new CLI/MCP command is
introduced. Map browser/show/device services, provider/tool coverage, full offline
apps, workload and final data/cutover gates remain open. No old-host fallback,
live installation cutover or push is performed by this slice.

Run `dev/rebuild/postgres_check.py --cad-settings-only` for the focused disposable
host and real React-dialog browser checks. The broader product and full native
suites include these tests. Settings evidence: `.verification/framework-native-cad-settings-2026-10-12/`; move/update qualification: `.verification/framework-native-cad-actions-2026-10-12/`.


Map device persistence/credentials and cast signalling now use native Studio
schema18; see [MAP_DEVICES.md](MAP_DEVICES.md). These are server authority services,
not additions to Map's saved-document automation command catalog. Rendering and
scheduling still belong to the product. Media/provisioning routes remain open.

## Map saved-show export service — 2026-10-12

The Map worker also declares `/api/map/project-export`, a stateless transform of
a saved show supplied by Studio. It returns portable SVG/README/folder metadata;
it never selects files, resolves permissions or writes server storage. Native
project ZIP/SVG routes perform document authorization, revision rechecks and
media/archive delivery. See `MAP_EXPORTS.md`. Rebuild/install the worker manifest
to enable the new service; the four existing Map agent commands are unchanged.
