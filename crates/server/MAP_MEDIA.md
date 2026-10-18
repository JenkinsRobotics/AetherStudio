# Native Map media

Implemented 2026-10-12. Studio owns immutable asset bytes and access; Map retains
its document, rendering and playback semantics. Access schema 19 adds `map_media`
and monotonic `map_media_refs`. No live installation cutover is implied.

## Existing browser/player contract

- `PUT /api/map/media/{name}` accepts the existing browser `File` upload. A current
  same-origin browser session and Map access are required. Content-Length is
  mandatory, from 1 byte through 512 MiB. Names use the existing alphanumeric/underscore/hyphen stem
  (up to 64 UTF-8 bytes), with a supported image/video/audio extension.
- A filename is immutable. An owner retry with identical size/digest succeeds;
  changed bytes conflict. Another user's filename cannot be overwritten. Two
  uploads can run concurrently, separately from editing capacity, with a 15-second
  frame wait and ten-minute total limit. Additional uploads receive 429.
- `GET`/`HEAD` streams bytes with the extension's MIME type, no-store, nosniff and
  single-range 206/416 support, including suffix ranges. It never accepts a public
  object digest as authority. Browser reads require asset ownership or current
  viewer access to a Map document retaining that asset.
- Device credentials are accepted only for reads. The device owner must remain
  active and permitted to use Map and read the currently assigned document.
  The requested filename must occur in that document's current Main media list
  and its verified storage bindings. Private owner assets, other shows and
  history-only assets do not become device-readable. Mixed credentials fail.
- `DELETE` is owner-only. Any saved-history reference returns 409, including a
  branch-only reference or an asset since removed from the current show. An
  unreferenced asset is tombstoned; repeated deletion succeeds. Its filename is
  never reused. The current Map adapter already handles 409 without deleting bytes.

## Atomic references and durability

Map's existing attachment declaration is `media[].file`. Studio interprets only
this storage declaration, not composition, geometry or timing. Every native Map
content mutation validates its attachment names and the caller's authority and
adds retention references in the same SQL transaction as the revision. This
includes new documents, saves, branch saves, restores, copies and agent edits.
A private filename pasted into a new document does not create authority. Reusing
an asset from a readable shared document is permitted, including an independent
copy whose access can outlive the original share.

Main/branch revisions share a monotonic document-to-asset retention index.
Merge resolutions select existing stored content; they do not introduce unbound
bytes. Account, app and document permissions are current at each request. A
response already authorized may finish after a later revocation, as with other
Studio downloads. Offline players learn revocations only when reconnected.

Uploads use the existing tenant-separated immutable object store in 1 MiB chunks.
No database connection or authority lock is held while waiting for upload bytes.
Current authority is checked again before publication. Interrupted or rejected
uploads have no visible manifest; durable chunks may remain as unreachable
objects. Asset publication/deletion and document binding serialize after the
identity/ACL locks. Audit failures roll back publication/deletion. Asset manifests
are included in the local `verify-store` upload integrity audit, including retained
tombstones; it streams chunks and verifies the whole-file hash.

Bounds: 4096 filenames per account (including tombstones),4096 declared media
entries per revision, and at most 4096 candidate document references considered
for a shared-asset read. Over-limit requests fail closed. Physical object garbage
collection and quota administration are not implemented; no retained bytes are
purged by this migration.

## Qualification and remaining work

`dev/rebuild/postgres_check.py --map-media-only` runs the focused PostgreSQL/HTTP
and actual Map browser-adapter checks, followed by a separate optimized 512 MiB
HTTP upload/download hash test. Full native qualification includes these checks.
Evidence lives in `.verification/framework-map-media-2026-10-12/`.

Legacy Map uploads did not record ownership. The offline transfer now accepts an
explicit `--map-media-owners` JSON object mapping every stored filename to an
existing user ID; it never infers the uploader. It archives that decision privately,
preserves unreferenced assets, and binds declarations from every saved revision,
including deleted branches. Missing bytes, ambiguous ownership, unfinished uploads,
unsupported names and over-limit records stop capture before publication.

Capture, snapshot verification, chunk import and target preparation use bounded
streaming for media. The destination uses the same tenant-separated immutable
chunk store and integrity audit as native uploads. Original files and revisions
remain unchanged. See [the transfer procedure](../../dev/rebuild/README.md#legacy-map-media-and-device-transfer--2026-10-12).

The old server permitted overwriting filenames. The importer can preserve only the
bytes still present in the source snapshot; it cannot reconstruct previously
overwritten/deleted media. Missing historical references are an explicit refusal.
Native app/setup downloads are now implemented; see [MAP_DISTRIBUTION.md](MAP_DISTRIBUTION.md).
Show-specific bundles, actual old-data ownership review, physical Pi/video-stream
qualification and final cutover remain open.
Browser playback and HTTP storage checks are not hardware qualification.
