# Repository quality gates

Implemented 2026-10-03 following the code-quality review. Products retain their
current paths, package manifests and lockfiles. The root package is a verification
entry point, **not** an npm workspace conversion or a publishing configuration.

From the repository root, with Node 22.12 or newer:

```sh
npm run setup:web     # npm ci per package, consumers before file dependencies
npm run check:guards  # theme, home layout, icons, shared-widget debt ratchet
npm test             # guards + every package that declares tests
npm run build        # guards + type checking and production builds
npm run check:web    # guards + tests, declared lint, type checking and builds
```

`dev/web-packages.json` supplies both the local runner and GitHub Actions matrix.
Every first-party package with tests/builds/checks is included. The session
package now has its own tests/typecheck; Studio has direct route tests as well
as the existing host-backed browser coverage.
New first-party packages missing from the inventory, or install-only packages that
gain verification scripts, fail inventory validation. A failing package does not
prevent the other packages reporting their failures. CI preserves the Python lane
and gives each web package a separate result; `fail-fast` is disabled.

For one package after dependencies are installed:

```sh
node dev/web-checks.mjs check "Aether CAD"
node dev/web-checks.mjs check aether-map
```

CI still needs this working-tree change committed/pushed before it can run. Remote
branch protection is an administrator setting; it has not been changed here.
Existing opt-in integration tests that require an engine service remain opt-in.

## Existing widget override debt

The original `dev/check-shared-widget-overrides.mjs` remains owned by the active
cleanup claim. It is diagnostic-only and scans CAD, Studio and Animation CSS with
line-based matching. It does **not** currently scan Map/IO/Sketch/Vector, nor reliably
parse multiline selectors. Do not mistake this guard for full stylesheet coverage.

`check-shared-widget-baseline.mjs` runs that detector and compares its actual
path/selector findings (including duplicates) with a reviewed JSON baseline.
There are 65 initial findings. New findings fail, and resolved findings require
removing their baseline entries so those overrides cannot return later. Moving
lines or trading an old finding for a different new one cannot evade the check.
The parser fails closed if the detector's summary no longer matches its output.
No automatic baseline-expansion command is provided.

Move existing rules to shared component options, update their consumers, remove
resolved baseline entries, and verify the affected interaction before proceeding
to the next group. Expansion of detector coverage and cleanup of protected styles
remain coordinated follow-up work; the baseline is explicit debt, not approval.

## Assets and package boundaries

Active square artwork and the remaining PNG heroes have WebP derivatives at the
original dimensions, encoded at quality 90. `web-derivatives.json` records source
and output hashes and byte counts. PNG masters and archived originals are retained
for icon generation and future artwork work. This reduces served asset bytes, not
existing git history. Recreate derivatives with the documented cwebp command when
changing their source art.

Keep the monorepo while package boundaries are prepared. Do not rename product
roots, remove the reference kit, consolidate document semantics, or change package
versions as incidental cleanup. The corrected review addendum records the next
migration gates. Each migration should identify consumers, preserve behaviour,
include fixtures/checks, and leave the package verification matrix green.


## Verification recorded for this change

- Engine 743, shared sketch 24, UI 406, CAD 805, Map 479, Sketch 12 and IO 3 tests
  pass: **2,472 passed**, with three existing CAD opt-in tests skipped. The first
  expanded run exposed missing engine-local dependencies and the CAD render-time
  browser-global error; dependencies and source were corrected and those suites
  rerun successfully. No tests were excluded to make the gate green.
- Every inventory package's applicable typecheck/build passes; Map lint completes
  with existing warnings. All repository guards and two ratchet tests pass.
- Workflow YAML parses, matrix generation returns ten jobs, and both launcher
  ignore rules were verified. The workflow has not been run on GitHub yet.
- All eight Studio card heroes decode as WebP; Drive, IO and Vector homes fit a
  600px viewport. Artwork visually reviewed, all eleven source/output hashes and
  dimensions verified. Original masters remain intact.

## Package-boundary ratchet — 2026-10-03

`check-package-boundaries.mjs` runs with local and CI guards. Its checked-in
baseline records existing crossings by source path, literal specifier and count;
new entries and increases fail. Remove entries as their imports are migrated so
resolved debt cannot return. There is no automatic baseline-expansion command.

The initial scan records 325 occurrences across the web-package inventory and
`core/assets`, including test and config files. It recognizes literal ES imports
and re-exports, dynamic imports, require, Vite globs, import-relative URL assets
and CSS imports/URLs. Computed imports, tsconfig aliases, Python imports and HTML
references are outside this check; packaged-consumer builds remain the final
proof of independence. Three scanner tests include a deliberately introduced
crossing, comment/string exclusions and debt replacement/duplicate checks.

This is staged enforcement, not evidence that the remaining packages can already
be published. Root npm workspaces, compiled package exports, moving engine gallery
demos and zero-crossing tarball-consumer checks remain open.

## Independent install ordering

The full `setup:web` command orders installs by local `file:` dependencies,
consumers first. Installing CAD can prune its nested engine's `node_modules`;
installing that engine last restores the WASM dependency required by its tests.
A topological-order test pins this behavior and rejects circular local package
dependencies. Single-package install mode still installs only the requested
package; use the full setup command for a complete checkout.
