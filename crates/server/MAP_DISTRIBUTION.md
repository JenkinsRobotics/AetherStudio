# Native Map device distribution

Implemented locally on2026-10-12. The Rust host serves product-owned, verified
installation artifacts without importing a sibling checkout or the Python host.
This is delivery compatibility, not a new player engine or physical Pi qualification.

## Build and install the distribution

In the Map repository, first build the existing web app, then run:

```sh
python3 scripts/build-device-distribution.py --output build/device-distribution-001
```

Choose a new output directory each time. The product builder packages the exact
built `dist/` tree as `app.zip`, copies the three existing player/setup/receiver
modules and installer, and uses Map's existing provisioning function to create
the self-contained `aether-projector-setup.sh`. It writes `map-downloads.json`
with schema1, app`map`, and exact byte counts/SHA-256 hashes for all six files.
It refuses symlinks, hidden/unsafe/reserved paths, over-limit files and changing
web build members. Packaging has fixed ZIP timestamps and file permissions.
Python is used at build time and remains the existing Pi player language; it is
not required by these Rust HTTP routes.

Copy the complete directory into private operator-managed installation storage,
then set `AETHER_NATIVE_MAP_DOWNLOADS` to its `map-downloads.json` before starting
an explicitly selected native host. No default path or sibling-repository lookup
exists. This does not configure, install, restart or deploy any device automatically.
The server validates the entire manifest, counts and hashes before listening and
copies the verified files to a private immutable temporary snapshot. An invalid
configured bundle fails startup; an unconfigured bundle returns503 for setup.
Hashes verify integrity against the trusted operator manifest; they are not an
independent publisher signature. A new version requires a new bundle and a deliberate
native-host restart.

## Existing routes

- `GET/HEAD /api/map/ping`: availability of the configured distribution.
- `GET/HEAD /api/map/install.sh`: the existing network installer, stamped with
  the server's configured canonical public origin. Request/forwarded Host values
  never define the installer address. Shell metacharacters are escaped.
- `GET/HEAD /api/map/aether_player.py`, `aether_setup.py`, `aether_receiver.py`:
  exact product modules for bootstrap.
- `GET/HEAD /api/map/aether-projector-setup.sh`: self-contained installer with
  embedded modules and the existing first-run host/network wizard.
- `GET/HEAD /api/map/app.zip`: exact built offline app archive, requiring a
  current Map-enabled browser session or a current paired-device bearer whose
  owner/account/app authority still permits Map. An unassigned owned Pi may fetch
  the app. Browser/device credentials cannot be mixed. Disabling the app or account
  denies later downloads.

The setup scripts/ping are public bootstrap resources; app bytes require authority.
The existing global Host/origin/fetch-site boundary still applies. Responses are
attachments with explicit MIME, length, no-store, nosniff and sandbox CSP. No query
parameters, request-selected filesystem paths or remote fetch URLs are accepted.
HEAD checks the same authority and returns matching length without a body.
An authorized response may finish after a later revocation, as with other native
downloads; no SQL connection or authority lock is held during transfer.

Bounds:128MiB per web build member,512MiB total source build/archive,100,000 web
members,1MiB per player module/network installer and8MiB bundled installer.
Startup hashes/copies in64KiB chunks; responses stream from the private snapshot
in64KiB chunks, with eight concurrent file bodies per distribution. Backpressure
or cancellation retains/releases that reservation; excess bodies return429.
This does not introduce a network-wide connection or slow-client idle timeout.

## Verification and remaining gates

`dev/rebuild/test_map_distribution.py` builds the real product distribution,
checks ZIP members/bytes and shell syntax, exercises real native HTTP sessions and
paired credentials, and runs the unmodified served player's `fetch_app` function.
Rust tests verify manifests, size/path/symlink failures, source-change isolation
and stream capacity/cancellation. Existing player/setup/receiver tests remain part
of acceptance. Evidence: `.verification/framework-map-distribution-2026-10-12/`.

No installer executes on the development machine or a Pi during qualification.
Boot, Wi-Fi/access-point setup, TLS on the installation network, video/audio output,
offline show playback and live mirroring still require physical-device testing.
Missing OS packages still require internet during installation. Show-specific ZIP/SVG exports are now native; see `MAP_EXPORTS.md`.
External media search, full original-data cutover and wider
framework/offline/release gates are separate pending work.
