# Aether Map release verification — 2026-09-30

**Decision: do not publish as a multi-user production release yet.** The desktop
editing/projection regression pass is substantially stronger, but media isolation
is a confirmed release blocker. Physical projector qualification and live AI
account flows have not been completed. No deployed host or Pi was upgraded.

## Repaired in this pass

- Map now passes its docked state into the shared ribbon: full width, square
  docked edges and menus outside the tool row.
- Shared WorkspaceRibbon keeps its workspace selector in Compact and Standard,
  so density no longer traps the user in one workspace.
- Shared Menu waits until its positioned overlay is visible before focusing an
  item. Browser keyboard navigation now works when opening tool variants.
- Shared Tree respects manually collapsing the parent of the selected item;
  changing selection still reveals its new ancestors.
- Shared WorkspaceAgent releases the composer immediately on Stop. Failed
  cancellation and late startup replies cannot leave it stuck or interfere
  with a newer response. These races have deterministic regression tests.
- Device announcements require possession of a private bootstrap secret or the
  paired device's existing Bearer token before exposing codes/tokens or changing
  its name/heartbeat. The player saves its random secret before sending it;
  the host stores only its hash. Tests cover anonymous/wrong/cross-device proof,
  HTTP token compatibility and migration from the previous SQLite schema.

Existing paired players keep their token and assignment; no re-pairing is
required. New registrations need the updated player. Legacy **unpaired** rows
have no secret and cannot safely be adopted by public ID: use a fresh device ID
when re-enrolling an updated player. Installed-player inventory is not confirmed.
See `aether-player/README.md` for that deployment distinction.

## Verification

The browser run uses the repository's Playwright harness, installed Chrome,
production web builds, temporary accounts/data and an isolated local Studio host.
The in-app Browser runtime reported no available browser; no manual interactive
walkthrough is claimed. Generated screenshots were visually inspected, including
light/dark tablet layouts, docked menu placement and persistent scene backdrops.

| Check | Result |
| --- | --- |
| Chrome browser coverage | All 132 scenarios passed across final full run and targeted retest; see run accounting below |
| Map unit tests | 479 passed, 60 files |
| Shared UI tests | 334 passed, 77 files |
| Shared UI typecheck/build | Passed |
| Map and Studio production builds | Passed |
| CAD regression suite after shared changes | 781 passed, 3 skipped; limited to two workers after parallel hook timeouts |
| Host and Python player tests | 171 passed (136 host, 35 player); final proof/migration tests included |
| OAuth identity/stream adapter tests | 2 passed; mocked protocol tests, not live account sign-in |
| Python lint on changed files | Passed |
| Map lint | No errors; 23 existing warnings |
| Map production dependency audit | Zero reported vulnerabilities at audit time; not a security certification |

Final browser run accounting: port 8943 completed with **131 passed, 1 failed**.
The remaining failure was a stale swatch selector: vector fills now use the
shared **Fill colour** input. After updating that interaction, the complete
`transforms.spec.ts` retest on port 8944 passed **2/2**, including the previously
failing scenario. No test was skipped or removed to reach the coverage result.
Screenshots/traces are under `aether-map/test-results/8943/` and `8944/`; inspected
intermediate screenshots also live under `8941/`. Logs are in
`/tmp/map-release-e2e-final.log` and `/tmp/map-release-transforms-final.log`.

Browser coverage includes immediate primitive creation, retained Bezier handles,
node changes, compound transforms/undo, layer visibility/reordering/rename,
scene transfer and persistence, backdrop clipping, output deletion and binding,
media append/replace, video seeking, animated shaders, crossfades, schedules,
SVG/reference export, autosave/recovery, microphone/MIDI simulation, recorded-hand
inference/replay, actual local Python-player deployment, and plugin marketplace
start/cancel behavior. Cast/AirPlay tests verify browser routing, not physical
receiver compatibility. The new 834 × 1194 touch/reduced-motion smoke covers both
palettes, panel reachability, workspace changes and a single agent composer.

The older browser specs still assumed the pre-split workspace UI: content visible
in Mapping, a timeline shown by default, modal acceptance for immediate geometry,
old accessible names, and only the active artboard rendered. Those expectations
were updated to exercise the current workflows. Regression assertions for
projection, persistence, undo, geometry and output isolation remain in place.

## Remaining release gates

1. **Media isolation — confirmed blocker.** `core/host/server.py` currently
   authenticates `/api/map/media/*` without checking the media's owning/show
   scope. A temporary-host HTTP test created a private show for one user, then
   fetched its media using another user's unassigned player token: **200**, with
   the fixture bytes returned. Expected: deny. Upload and delete routes also
   lack an ownership check in source. Random filenames are not an authorization
   boundary. A complete fix needs upload ownership/provenance, authorized shared
   document references, assigned-player restrictions, and import/backup/legacy
   migration tests. Track the backend packet in the active briefing Requests.
2. **Physical/browser qualification.** Pi provisioning, real Wi-Fi/captive portal,
   systemd startup, projector displays, physical Cast/AirPlay, power-loss recovery,
   sustained playback/synchronization, Safari and Firefox remain unverified.
3. **Optional AI release qualification.** Completed ChatGPT/Claude/Gemini account
   authorization and live inference remain unverified. No AI video generation is
   connected. These should not be advertised as release-qualified features.
4. **Nonblocking cleanup.** Map emits a large-bundle warning (approximately
   1.25 MB uncompressed JS), and lint reports 23 warnings. The build succeeds;
   long-duration rendering and startup performance still need device measurements.

This is a test-and-repair report, not a claim of complete product parity or a
production deployment approval.
