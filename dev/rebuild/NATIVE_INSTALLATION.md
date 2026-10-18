# Native installation and recovery

Local operator tooling is qualified on macOS and now runs the native server at
`http://localhost:8780`. Both Python authorities are stopped. This is not a signed
desktop or pre-login system installer. See [CUTOVER_STATUS.md](CUTOVER_STATUS.md).

## Private startup configuration

The same native binary accepts every operator command with a private config:

```sh
aether-native-host serve --config /private/studio/installation.json
aether-native-host verify-store --config /private/studio/installation.json
```

The JSON shape is `{"schema":1,"environment":{"AETHER_NATIVE_PG":"...", ...}}`.
Required fields are `AETHER_NATIVE_PG`, `AETHER_NATIVE_TENANT` and
`AETHER_NATIVE_OBJECTS`. Other supported native settings retain the names described
in [NATIVE_HOST.md](../../crates/server/NATIVE_HOST.md). Artifact/configuration paths
must be absolute. The file and its containing directory must be owner-only
(0600/0700) and owned by the account running the service; symlink files are refused.
Unknown environment names, control characters and oversized inputs are refused.

With `--config`, inherited `AETHER_NATIVE_*` values do not select another database
or override the installation. An early re-exec supplies the validated configuration
before async threads are created. Connection credentials stay out of argv and error
messages. Setup/bootstrap/migration remain explicit operator actions; service startup
never silently provisions accounts or migrates an existing schema.

For saved network recovery, stage an operator config with
`AETHER_NATIVE_NETWORK_RESET=1` and a known-good loopback listener. This does not
delete the saved network configuration. HTTPS remains required for non-loopback
listeners; certificates and secret vaults are separate private operator resources.

## Stage a macOS service generation

Freeze application artifacts before preparing a service generation:

```sh
.venv/bin/python dev/rebuild/stage_native_runtime.py \
  --adapters /private/studio/current-adapters.json \
  --destination /private/studio/runtime-001
```

The private input maps `AETHER_NATIVE_FRONTENDS`, `AETHER_NATIVE_PRODUCTS`,
`AETHER_NATIVE_ANIMATION` and `AETHER_NATIVE_MAP_DOWNLOADS` to their existing
absolute manifest paths. The tool copies built frontends/shared assets, verified
Map/CAD single-file workers, the Animation archive and player downloads. It
rewrites their manifests into the new tree, checks file hashes and source stability,
and emits `adapters.json` plus a private inventory. It refuses symlinks, corrupt
bundles, changing sources and destination reuse. It never starts services.

Merge those four resulting paths into the installation configuration. Node,
Python (including its environment dependencies) and FreeCAD remain explicit
external executables; their resolved hashes are recorded. This is a frozen local
deployment candidate, not a signed self-contained desktop installer. Real provider
accounts and TLS/SMTP vaults remain separate private configuration.

First prepare a verified, stopped PostgreSQL target and a short private socket
directory. Its DSN must name that socket, database and user explicitly. Then:

```sh
.venv/bin/python dev/rebuild/native_installation.py plan \
  --host-binary /absolute/release/aether-native-host \
  --config /private/studio/installation.json \
  --postgres-bin /absolute/postgresql/bin \
  --database /private/studio/postgres \
  --socket-dir /private/short-socket \
  --destination /private/studio/generation-001 \
  --label com.aether.studio.local
```

The destination must be new. This freezes the selected host binary and config,
records its SHA256, and writes owner-only database/server plists and logs. It does
not register or start them. The database job uses only the private Unix socket.
Both jobs restart after process failure with a ten-second throttle. A fixed `C`
locale avoids PostgreSQL's macOS launchd/CoreFoundation startup failure.
The plan uses `ProcessType=Interactive`: HTTP editing and geometry work depend on
both services, and HTTP does not provide the XPC activity boost used by Adaptive
jobs. Background scheduling throttles the server and inherited CAD processes;
foreground qualification alone does not catch this. Native admission, worker
counts, memory limits and deadlines still bound application work.

At an authorized switch, register the database job before the server job with
`launchctl bootstrap gui/<uid> /absolute/generation/database.plist`, then the server
plist. Stop in the reverse order using their exact labels and
`launchctl bootout gui/<uid>/<label>.server`, then `.database`. Wait for PostgreSQL
to finish its shutdown checkpoint; registration removal alone does not prove the
process is stopped. Never stop by port number alone.

These are user LaunchAgents, so they start in a logged-in user's launchd domain.
An unattended pre-login system service and signing/distribution remain deployment
work. Logs need an operator retention policy; no automatic rotation is claimed.

## Restore current native data to a new target

Use the native backup command or the administrator backup UI to capture a consistent
snapshot. Restore accepts an operator-owned extracted native backup directory;
it does not automatically trust a browser upload or execute SQL against a live DB.

```sh
.venv/bin/python dev/rebuild/native_installation.py restore \
  --backup /private/backups/current-snapshot \
  --destination /private/studio/recovered-001 \
  --host-binary /absolute/release/aether-native-host \
  --postgres-bin /absolute/postgresql/bin
```

Every recorded object/asset and SQL dump is copied with digest/size verification.
Symlinks and traversal are refused. A new cluster runs only on a disposable private
socket while restoring; the Rust verifier checks records and content. Account hashes,
document versions and history survive. Live sessions, recovery tokens and delegated
credentials must be reissued. The command publishes `recovery-report.json` only after
the database has stopped. Failure retains the private target for diagnosis instead
of overwriting or deleting an authority.

Server executables, app bundles, provider credentials, SMTP vaults and TLS keys are
not in a data backup. Restore those from their separately retained private operator
configuration, then stage a new service generation pointing at the verified target.
Reconcile any writes made after the chosen snapshot before switching data authority.

## Rollback policy

Before the first native write, a failed deployment can return to the unchanged
legacy authorities. Once native writes are accepted, keep the native database and
object store authoritative. Prefer restoring the previous verified native binary
against the same compatible schema. Otherwise stop writes, capture the latest
native data, restore/verify it independently, and repair forward. A legacy snapshot
must never replace a native store containing later work. Reverse migration to the
Python schema is not implemented and is not a supported rollback command.

## Qualified evidence

The merged-demo backup restored 2 users,31 documents,549 revisions,388 blobs and
5 upload manifests across401 recorded files. Actual macOS launchd testing started
the restored fixture, killed/restarted its host and PostgreSQL processes, checked
identical content/history integrity, then unloaded both jobs and verified clean
database shutdown. This exercises process crashes, not physical power loss.

Reproduce on another **disposable restored target**:

```sh
.venv/bin/python dev/rebuild/rehearse_native_installation.py \
  --restored /private/studio/disposable-recovery \
  --host-binary /absolute/release/aether-native-host \
  --postgres-bin /absolute/postgresql/bin
```

It selects random rehearsal labels, an unused loopback port and a short private
socket. Both original listeners are excluded. Initial locale and shutdown-race
failures are retained with the corrected passing run in the media/operations
evidence packet. Combined product flows and final quiesced migration are separate
cutover gates.

Also qualify the installed application bundles under the actual service plan:

```sh
.venv/bin/python dev/rebuild/rehearse_imported_apps.py \
  --restored /private/studio/disposable-recovery \
  --host-binary /absolute/release/aether-native-host \
  --postgres-bin /absolute/postgresql/bin \
  --adapters /private/studio/runtime-001/adapters.json \
  --launchd
```

This starts a uniquely named disposable server job, verifies imported file heads
over HTTP and waits for actual Map/CAD content, including a rebuilt CAD solid.
It removes temporary sessions, unloads the job and stops the restored database.
Without `--launchd`, it tests a foreground host; that is a different deployment
condition and must not substitute for supervised application acceptance.
