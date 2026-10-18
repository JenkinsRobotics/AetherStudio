# Native saved-show exports

Rust Studio serves `GET`/`HEAD /api/map/project/{id}.zip` and `.svg`, matching
Map's existing download action. These routes require a current browser session,
Map application access and Viewer access to the selected Map document. Device
and agent bearer credentials do not authorize these browser downloads.

Map owns the portable `src/automation/project-export.ts` service. Build/install
its `runtime/native-worker.json` with `npm run build:automation` and list that
manifest in `AETHER_NATIVE_PRODUCTS` (see `NATIVE_PRODUCTS.md`). The worker
has no document authority: Studio supplies the saved name/content and validates
its response. Missing installation fails explicitly; there is no Python host or
legacy source-directory fallback. The existing Pi runtime remains Python.

The product service generates the wireframe, README, portable archive folder
name and referenced-media list. Wireframes contain every scene's surface/mask
geometry with a canvas fitting the largest artboard, escaped text and unique
scene IDs. Invalid dimensions/coordinates fail validation. This is geometry
export, not a rendered frame or a video encoder. Titles are preserved as text;
archive/download names use safe ASCII components, with no traversal or controls.

## Snapshot and delivery

Studio reads Main under current session/application/file authority, runs the
installed product service without holding SQL locks, then rechecks current
permission and the saved revision. A concurrent save produces409; revocation
suppresses the result. The final transaction collects every current referenced
immutable media manifest. Archived/historical or merely owner-accessible media
are not added unless this saved show actually references them.

The ZIP contains one folder with `show.aethermap`, `layout.json`, `wireframe.svg`,
`README.txt` and `media/{name}`. Both document files preserve the exact saved
bytes; repeated media references become one archive entry. Missing manifests or
corrupt chunks fail the request before a successful ZIP response. The old
partial-bundle `MISSING-ASSETS.txt` behavior is intentionally replaced by explicit
failure; the native storage contract requires referenced media to be retained.

Archive assembly uses zip-rs with Stored entries (already compressed media need
no further compression), private temporary files, two queued blocks and verified
media reads of at most1MiB. Small document/text inputs are also split into1MiB
blocks. No archive-sized buffer, product filesystem path or user-chosen input path
is accepted. Total uncompressed payload is limited to1GiB, with at most4096
unique media entries plus four metadata files. ZIP headers add bounded overhead.
There are two export permits held through construction and ZIP response delivery;
a cancelled writer retains its permit until its queued writes stop. File bodies
stream in64KiB blocks. Normal cancellation/completion removes temporary files;
OS termination may leave private temporary files for system cleanup.

No database connection is held while building or serving the archive. Construction
uses the host request deadline and installed worker bounds. A download whose
snapshot was already authorized can finish after later revocation, like ordinary
file downloads. HEAD performs the same validation/assembly and returns matching
length with no body. Downloads use attachment disposition, no-store, nosniff and
sandbox CSP. ZIPs are deterministic for identical saved inputs.

## Qualification

`dev/rebuild/test_map_exports.py` exercises the actual built Map worker through
the native HTTP server with disposable imported users, grants, revisions and
media. It covers exact archive bytes/members, SVG geometry, duplicate references,
HEAD, bearer/origin/app/file boundaries, revocation and concurrent revision
changes, corrupt chunks, missing worker, a128MiB media archive and the1GiB payload
limit. Product tests cover geometry, escaping and malformed names/data; the Rust
archive test covers temporary-file privacy, cleanup and permit release.

Evidence: `.verification/framework-map-exports-2026-10-12/`.
This does not switch the running installation, import original users/data,
qualify physical Pi boot/casting, implement external asset search, complete the
remaining framework/desktop work or authorize a remote push.
