# Native Map device control

Implemented locally on 2026-10-12, access schema18. The Rust Studio server owns
pairing, player credentials, device ownership, show assignment and short-lived
WebRTC signalling. The Map product continues to own document rendering, schedules,
media interpretation and its existing Python/Chromium player. No Rust player or
physical Raspberry Pi qualification is implied by this server migration.

## Live receiver capability — source candidate, 2026-10-14

Access schema23 adds immutable device `kind`: `player` or `live_receiver`.
Announcements may specify it; missing kind preserves an existing record and
creates a legacy-compatible player for a new record. After possession is
verified, a conflicting explicit kind returns409. Unknown kinds return400.
Announcement/list replies expose kind; the Android receiver requires its expected
kind before storing credentials. An older host therefore cannot silently enroll
it as a standalone player.

An owner may pair, rename, forget and cast to either kind. Non-null saved-show
assignment to a live receiver returns400; a database CHECK also rejects it.
Clearing an assignment is harmless and remains accepted. Existing Pi assignments,
credentials and leases survive the explicit migration. This migration was tested
only in disposable PostgreSQL; it has **not** been applied to the installed host.
The native Android app and its APK are owned by `Aether-Map/player/android`.

`python3 dev/rebuild/postgres_check.py --map-devices-protocol-only` runs the real
HTTP/database/device tests without the separate Chromium UI acceptance case.
This flag does not certify browser behavior or physical receiver playback.

## Existing browser and player protocol

- `POST /api/map/devices/announce`: device ID, name and private bootstrap proof;
  optional existing `aether_dev_` bearer. No browser cookie. A new device receives
  a six-digit code valid for ten minutes. Proof-only credential recovery rotates
  the bearer; an ordinary bearer heartbeat keeps it. Only hashes are stored.
- `GET /api/map/devices` and `POST /api/map/devices/list`: authenticated Map users
  see device labels/status. Only the owner receives the assigned show ID.
- `POST /api/map/devices/{claim,rename,assign,forget}`: same-origin browser session,
  enabled Map access and current ownership. An assignment requires current read
  access to a Map document. Forget revokes the player and removes its cast lease.
- `GET /api/map/device/show`: device bearer only. The response preserves the
  existing `{device,show:{id,name,revision,layout_base64}}` shape. It reads Main;
  an unassigned or no-longer-readable show returns `show:null`.
- `POST /api/map/devices/{cast-start,cast-poll,cast-stop}`: owner browser controls.
  `GET/POST /api/map/device/cast`: authenticated player offer/answer/status.
  The 20-second lease uses PostgreSQL time and is renewed only by editor polling.
  It survives a server-process restart until expiration, works across nodes using
  the same database, and is invalidated by credential rotation. Signalling never
  changes the saved-show assignment. Video/audio travel directly between peers.

Account state, app policy and file/ancestor permissions are rechecked under the
same identity/ACL locks used by document changes. Device credentials do not grant
library, browser-session or agent-command access. Public enrollment cannot accept
browser cookies or a cross-site Origin. All state is tenant-scoped. A registry
lock orders claim/revoke/cap checks across server processes. Device state changes
and audit commit together; failed audits roll back assignments.

Existing resource limits are explicit: 64 devices per tenant; 1,024 announcements
per minute per tenant; 12 pairing attempts per minute per account; 4 KiB enrollment
bodies; 70,000-byte signalling bodies and 65,536-byte SDP descriptions. The general
bounded document admission queue also covers Map routes. Limits are stored in the
database, so reconnects or a different server process do not reset attempts.

The player now distinguishes acknowledged access denial (401/403/404 on the show
route) from transport failure or server overload. Denial clears cached playback;
network loss/429/5xx retains the last good show. A disconnected player cannot learn
of revocation until it reconnects. These legacy management endpoints do not have
durable operation-ID receipts; after an uncertain claim/forget, refresh the device
list before retrying. Document saves retain their existing durable receipts.

## Qualification and remaining work

Use `dev/rebuild/postgres_check.py --map-devices-only` for the native device suite.
It covers the actual Map React Players panel in Chromium and the product's Python
player talking to the Rust host, as well as pairing races, failed transactions,
credential separation, show ACL revocation during a lock wait, disabled accounts,
rate/cap/body limits, cast expiry/rotation and additive schema upgrade.

This is not the complete Map runtime cutover. Native media upload/delivery is now
implemented with assigned-show authority; see [MAP_MEDIA.md](MAP_MEDIA.md). App archives and installer/setup downloads are now served from verified native
distributions; see [MAP_DISTRIBUTION.md](MAP_DISTRIBUTION.md). Show-specific exports
and external media searches remain open. So do physical-device video/audio, boot/Wi-Fi/offline/schedule tests,
full company-load qualification and release deployment. The original installation
continues to run.

Offline legacy import now retains claimed/unclaimed devices, original owner/show
bindings and valid private pairing hashes. Existing bearer tokens are SHA-256
hashed on import; installed players can keep using them, and proof-only recovery
rotates them through the existing native route. Timestamps and active pairing codes
are retained. Current account/app/document permissions still gate every playback
request; importing a binding does not grant file access.

Missing private pairing proofs, malformed or duplicate credentials/codes, dangling
show/owner references, unsupported fields and capacity violations stop the import.
An older proofless player must be re-enrolled on the original host first. Live cast
sessions are not migrated. The private SQLite recovery archive still contains the
original plaintext device tokens and must be protected as a credential backup.

Existing native database backups retain device bindings and their hashed machine
credentials, unlike interactive sessions/agent grants. Operator recovery must keep
those backups private and review device revocations when restoring an older point
in time. A dedicated device re-enrollment recovery workflow remains unqualified.

## Optional Android installer — source candidate

Distribution schema1 still accepts exactly the original six player files.
Schema2 requires those same files plus `aether-map-receiver.apk` (at most128MiB).
The server snapshots and verifies size/SHA256 before serving any bytes; symlinks,
unknown names, extra/missing entries and modified artifacts are refused.
`GET /api/map/ping` includes `androidReceiver`, based on actual packaged presence.
The existing public installer route serves the APK with Android package MIME,
attachment disposition and nosniff; GET and HEAD work. Like the public Pi
installer, it contains executable product code, not credentials or user content.
Android checks signing at installation; product qualification separately verifies
the compiled APK signature, manifest and licenses. No APK is fetched from an
external catalog or uploaded through a browser. The matching Map setup UI shows
the download only when advertised. The current local APK uses a debug signing
key and has not been physically qualified or published.
