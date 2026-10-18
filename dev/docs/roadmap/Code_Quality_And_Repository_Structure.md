# Code quality and repository structure

A review of the suite as it stands, with recommendations for organising it for
long-term development, and an assessment of whether to split it into one
repository per app. Requested by Jonathan, 2026-10-03. Every number below was
measured, not estimated; where a measurement contradicted a first impression,
the contradiction is noted.

> **Superseded on the split question, 2026-10-03.** Jonathan has decided: one
> repository per app, each owning its code and consuming Aether UI as a
> published library. Section 6's "not yet" is therefore no longer a
> recommendation — but its findings are exactly why the split needs stages, and
> they became the sequenced brief in
> [`dev/briefings/tasks/Repository_Split_Preparation.md`](../../briefings/tasks/Repository_Split_Preparation.md).
> Read section 6 as "what has to be true first", not as an argument against.
>
> **Status, 2026-10-03.** Codex reviewed this document, corrected three of its
> claims and has already implemented much of the priority list — CI coverage,
> guard enforcement, Map's strict mode, the WebP conversion and the gitignore
> gap. Its findings are appended at the end and supersede anything above they
> contradict. Where it corrected me, I have struck the original claim rather
> than quietly editing it, so the mistake stays visible.

## The short version

Four things are already right and should not be disturbed: folder **depth**
(nothing is more than three levels below a source root, which is the stated
limit), the **ownership contract** in `CLAUDE.md`, **tests sitting beside the
code they test**, and the **guard scripts** in `dev/`.

The single most serious problem is not structural. It is that **77% of the
suite's tests never run automatically**, and one application — Studio, which
serves every other app's home page — **has no tests at all**. Everything else
on this list is cheaper than those two.

Every area was measured the same way (§3d). Aether CAD leads the write-up
because it is the largest, but **Aether Map and `core/host` are less well
organised than it is**, and the best-organised code in the suite is Aether
CAD's own engine, which is the model the rest should copy.

On splitting into separate repositories: **not yet, and probably not all of
them.** The measurement that decides it is below.

---

## 1. The tests that do not run

CI runs Aether UI, two builds, and the Python suites. It does not run
**Aether CAD or Aether Map at all.**

| Gated by CI | Not gated |
|---|---|
| core/ui ~384 | Aether CAD ~769 |
| Python 155 + 1300 | Aether Map ~479 |
| | core/sketch ~24, Sketch ~12, IO ~3 |

About **1,287 front-end test cases exist that a push never runs**, including
every test for the largest application in the suite. They pass today because
someone runs them by hand.

Three related gaps:

- **Four guard scripts existed in `dev/`; two were wired into one app's build.**
  (I first wrote five — a miscount, corrected by Codex.) `check-icon-pack.mjs`
  and `check-shared-widget-overrides.mjs` ran only when invoked by hand, and
  the override detector exited successfully even when it had findings, so
  wiring it up alone would not have failed a build.
- ~~`strict` is unset in Aether CAD's and Aether Map's `tsconfig.json`.~~
  **Wrong for CAD, corrected by Codex 2026-10-03.** I read the root
  `tsconfig.json`, which only lists project references; CAD's real settings are
  in `tsconfig.app.json` and `tsconfig.node.json`, and both enable `strict`.
  Only Aether Map lacked it, and Codex has since enabled it there and verified
  the build. The lesson for anyone repeating this measurement: in a
  project-references layout the root config tells you nothing.
- **Half of Aether CAD's tests are `.dom.test.jsx`** (74 of 151 files). Being
  `.jsx`, they are invisible to `tsc`, so the half of the suite that exercises
  the most behaviour has no type coverage.

**Recommendation.** Put every app in CI before anything else on this page. Then
wire all five guards into the builds they protect. Then turn on `strict` in CAD
and Map and burn down what it finds. Then migrate `.dom.test.jsx` to
`.test.tsx` so the type checker sees them.

## 2. The shared-widget rule is being broken 65 times

The stated rule is that reusable UI lives in `core/ui` and products never
restyle it locally. `dev/check-shared-widget-overrides.mjs` exists precisely to
enforce this, and reports **65 product rules restyling shared widgets** —
roughly 60 in Aether CAD, the rest in Studio and Map.

This is not a new rule being discovered; it is an agreed rule with a working
detector that nothing runs.

**Recommendation.** Wire the guard into each product's build so the count can
only fall. Burn the 65 down by moving each behaviour into `core/ui` as a
component option. Expect most of them to collapse into a handful of missing
options rather than 65 separate fixes.

## 3. Aether CAD's source root is a dumping ground

Aether CAD is 343 files and 44k lines in `src/`, plus a 455-file engine and a
27-file FreeCAD binding. (An earlier figure of 208k lines was wrong: it
included ` REFERENCE CAD/`, which is 113k lines of vendored third-party
material and not ours.)

**111 of those 343 files sit loose in `src/` — 26% of the app.** They are not
unstructured; they are *pre*-structured by filename prefix instead of by
folder:

- 23 files prefixed `cad-` — seven stores, five authoring modules, three
  bridges. The prefix is noise inside an app already called Aether CAD.
- Six `sketch-*` files beside a `sketch/` folder; `feature-authoring.*` beside
  `features/`; `cad-tool-catalog.ts` beside `tools/`; `viewport-appearance.ts`
  beside `viewport/`.

Meanwhile `sketch/` holds **175 files flat**, and its filenames already encode
the grouping it wants: `text-*` 24, `dimension-*` 15, `constraint-*` 13,
`selection-*` 9, `dxf-*` 7, `projection-*` 5.

`features/` — `extrude.ts`, `revolve.ts`, `sweep.ts`, `shell.ts`, `mirror.ts` —
is exactly the model described in the request, and proves the instinct is
already in the codebase. It simply was not applied to the other 300 files.

**Recommendation.** Move by prefix, since the prefixes already name the
destination:

```
src/stores/        the seven cad-*-store files, prefix dropped
src/assembly/      cad-assembly-*, cad-mate-*, cad-relation-*, cad-connector-*
src/bridges/       cad-assembly-bridge, cad-drawing-bridge, cad-bridge-decode
src/sketch/text/   the 24 text-* files        (and dimensions/, constraints/,
src/sketch/dxf/    the 7 dxf-* files           selection/, projection/ likewise)
```

That is a rename-and-move exercise, not a rewrite, and it keeps everything
within the three-level limit. Two naming collisions to fix while passing
through: `react/panels/inspect.tsx` versus `inspector.tsx` in one folder, and
`sketch/box-selection.ts` versus `viewport/box-selection.ts` — two different
implementations of the same name.

**One thing to be careful about.** `react/` is a technical layer, not a
feature, so viewport code currently lives in both `viewport/` and
`react/chrome/viewport.tsx`. Resist flattening that in the same pass; the React
shell boots a vanilla DOM and Three.js core through a dynamic import in
`react-main.tsx`, and those two layers are genuinely different things. (An
automated pass flagged that core as ~5k lines of dead code. It is not dead —
the dynamic import is invisible to a static scan. Worth stating plainly so
nobody deletes it on the strength of a tool.)

**`harness-demo/` (13 files) is a different product living inside Aether CAD.**
It should be its own app folder.

## 3b. The shared layer has the same problem, one level up

`core/ui/src/` holds **258 files flat**, with a single subdirectory. Its
`widgets.css` is a **2,642-line global stylesheet** covering roughly forty
widgets, and **34 of its 130 modules are absent from the `index.ts` barrel**,
so "is this public API?" cannot be answered from the layout.

Three findings matter more than the flatness:

- **`src/kit/` is 11 files and 3,907 lines that no *product* imports.** It is a
  port of a Swift mockup under its own `aui-kit-` class prefix, and it
  re-implements what `src/` already has: its own search field, tabs, status
  bar, switch, slider, tree and a seventh panel shell. **It is not dead**,
  though: the gallery's reference experiences depend on it, as Codex pointed
  out after I had called it the clearest deletion in the suite. The right move
  is a migration — inventory the interaction variants only the kit still
  provides, move those consumers onto the shared components, then delete — not
  a deletion.
- **Thirteen widgets in `core/ui/src` are not design-system material.**
  Harness widgets, circuit symbols, a signal monitor, a material browser, a
  relation editor, a sequence editor. These are product features living in the
  shared library, and each one is a reason a product cannot be split off
  cleanly.
- **`ApplicationChrome.tsx` calls `fetch("/api/status")`.** It is the only
  network call in the design system, and it means the shared library knows the
  server's app catalogue. Presentation should receive that list, not fetch it.

**One thing that is *not* a violation, but is an obstacle.** `core/ui`
declares `@aether/core` — Aether CAD's engine — as a devDependency, resolved by
file path with a matching Vite alias. The contract in `CLAUDE.md` explicitly
permits this for the gallery's feature demos, and `core/ui/src/` is indeed clean
of it. It is allowed. But it does mean **the design system cannot currently be
published as a package without the CAD product present**, which is precisely
step 1 of the split sequence below. Resolving it is cheap: the gallery demos
that need an engine can move into Aether CAD's own gallery.

## 3c. Duplication worth consolidating, and duplication worth leaving

Measured across the products rather than assumed:

- **Leave autosave alone.** `core/session/autosave.ts` is already the single
  engine; the per-product wrappers differ for real reasons.
- **Leave the version/history UI alone.** It is shared from `core/ui` and
  Studio correctly just composes it.
- **Consolidate document transport.** Five overlapping layers exist across
  `core/session` and four products. The tell: Aether Sketch imports the shared
  `useHostedDocument` *and* keeps its own fifteen-line `useDocument.ts`. Unify
  the hooks, keep the per-product serializers.
- **Consolidate the host's drive modules.** Six modules totalling ~1,727 lines
  with overlapping version logic. Accreted rather than designed.
- **Put the icon components behind one registry.** Three genuinely different
  art pipelines currently surface as six component APIs.

## 3d. Every app, measured the same way

The sections above lead with Aether CAD because it is the largest. Measured
identically, **the root-dumping problem is worse elsewhere**, and the
best-organised code in the suite is also inside Aether CAD.

| Area | Files | Lines | Test files | Loose at root | Verdict |
|---|---|---|---|---|---|
| **CAD engine** `aether-engine/src` | 455 | 39k | 195 | **1%** (6) | **The exemplar** |
| Animation engine `aether_animation` | 82 | 31k | 74 | 35% | Good |
| Aether CAD `src` | 343 | 44k | 151 | 32% | Mixed |
| Aether Map `src` | 207 | 31k | 61 | **46%** | Dumping ground |
| Server `core/host` | 48 | 12k | 40 | **56%** | Dumping ground |
| Studio + Drive `studio/src` | 22 | 8.2k | **0** | 100% flat | **Untested** |
| Aether Sketch `src` | 25 | 1.6k | 4 | 100% flat | Fine at this size |
| Aether IO `src` | 9 | 1.9k | 1 | 100% flat | Fine at this size |
| Animation web `web/src` | 9 | 1.7k | 1 | 100% flat | Fine at this size |
| `core/sketch/src` | 23 | 1.2k | 5 | 100% flat | Fine at this size |
| Pi player `aether-player` | 4 | 1.3k | — | — | Fine |
| Aether Vector `src` | 3 | **31** | 0 | — | **Placeholder** |
| Aether Dynamics | 0 | **0** | 0 | — | **A README** |

**Aether CAD's engine is the model to copy.** 455 files, 39k lines, six at the
root, sixteen feature folders, 195 test files, and filenames that are
kebab-case 323 times and PascalCase zero times. Whoever organised it was
applying exactly the standard being asked for. The recommendation for every
other area is "look at `aether-engine/src` and do that".

**Aether Map is the worst offender, not Aether CAD.** 97 of 207 files loose at
the root, and its filenames already name the folders they want: `output-*` 8,
`surface-*` 5, `scene-*` 5, `layer-*` 5, plus pairs for video, svg, source,
show and media. Its existing folders (`features/`, `mask/`, `live/`,
`projection-export/`) are properly feature-grouped; `panels/` is a technical
layer. Map is also the suite's naming problem: kebab 83, PascalCase 67,
lowercase 57 — three conventions in near-equal thirds, where CAD at least
skews strongly to one. `App.tsx` is 1,472 lines.

**`core/host` is 56% loose at the root** — 27 files including a 2,033-line
`server.py` — and carries six drive modules totalling ~1,727 lines that look
accreted rather than designed.

**Studio has no tests at all.** Zero, across 22 files and 8,200 lines,
including a 1,338-line `main.tsx` that holds all its routing. This is the app
that serves every other app's home page and the admin surface, so it is the
least appropriate place in the suite to have no tests.

**Three places where "each app has its own folder" is not true today:**

- **Aether Drive has no folder.** The host serves it from `studio/dist`, and
  its source (`DriveHome.tsx`, `drive-upload.ts`, `drive-api.ts`) sits inside
  `studio/src` alongside the Studio admin. Two products, one folder, no tests.
- **`harness-demo/` (13 files) lives inside `Aether CAD/src`.** It is a
  different product.
- **Aether Vector is 31 lines** and Aether Dynamics is a README, yet Vector is
  registered as a real app by the host and carries a full package manifest,
  lockfile, Vite config and a built `.app` bundle.

### The three reorganisations, concretely

Each is a move-and-rename, not a rewrite, and in every case the filenames
already name their destination folder.

**Aether Map — 97 root files into 7 folders:**

| Folder | Files | What goes in it |
|---|---|---|
| `scene/` | 18 | `document.ts`, `scene-*`, `artboards*`, `layer-*`, `background-layer`, `content-placement*` |
| `surfaces/` | 17 | `SurfaceCanvas*`, `surface-*`, `corner-welds*`, `homography*`, `group-interaction*` |
| `outputs/` | 14 | `output*`, `screens*`, `export-video` |
| `timeline/` | 9 | `playback*`, `clips*`, `cues`, `video-sync*`, `use-transport` |
| `media/` | 8 | `media-*`, `source-picture*`, `svg-import*`, `show-file*` |
| `viewport/` | 4 | `viewport*`, `TransformOverlay`, `portal` |
| `app/` | ~25 | the shell: `App*`, `main`, `api`, autosave and command hooks |

Also in Map: `masks.ts` at the root duplicates the concept `mask/` already owns;
`map.css` is one 1,598-line stylesheet whose selectors are already prefixed
`map-*`, so it splits along the same seven lines; and **six test files have no
sibling implementation** (`autosave`, `layer-folders`, `outputs`,
`projection-workflow`, `scene-mix`, `output-surface`) — their subjects moved and
the names no longer point anywhere.

**`aether_animation` — 29 root modules into 7 folders:** `format/` 5 (loader,
serialize, scene, rig, pack), `hardware/` 6 (outputs, wire, serial_transport,
frame_output, frame_serial, sim), `kinematics/` 4, `canvas2d/` 4, `bridge/` 3,
`cad/` 3, `extensions/` 2.

Two things to decide while in there. **Five modules have no non-test importer**
— `asset_catalog`, `frame_serial`, `tracking`, `pack`, `serial_transport`.
That is not proof they are dead: this is a library with a planned hardware lane,
and transport modules with tests but no caller may simply be ahead of their
consumer. Confirm intent before deleting any of them. And
**`aether_project.py` and `cad_document.py` are imported only from
`core/host/`** — they are host concerns living in the animation engine, which
is a boundary worth correcting before any split.

**`core/host` — 27 root files into 5 folders:** `drive/` 6, `library/` 5
(library, history, map_project, map_provisioning, cad_settings), `server/` 4,
`install/` 6, `backup/` 3. `state.py` stays at the root; it is the
accounts/sessions store and has 31 importers. `server.py` (2,033 lines) splits
cleanly in two: `class StudioHost` is host state, `make_handler` is HTTP
routing, and they barely overlap. Two names are actively misleading —
`host_storage.py` means backup policy and `backup.py` means offline restore,
which is the wrong way round.

**What this changes about the split.** Of the seven applications the host
registers, one has no folder of its own, one is a 31-line placeholder, and one
more (Dynamics) does not exist. Creating repositories for those would be pure
overhead. A realistic split is **four or five repositories, not nine**: CAD,
Map, Animation, the server, and the shared packages — with Studio/Drive, IO,
Sketch and Vector staying together until they are big enough to earn their own.

## 4. Naming

Three conventions are in use for app folders, which is one too many:

| Convention | Folders |
|---|---|
| `Title Case With Space` | `Aether CAD` |
| `kebab-case` | `aether-map`, `aether-sketch`, `aether-vector`, `aether-io`, `aether-player`, `aether-dynamics` |
| `snake_case` | `aether_animation` (Python package — correct for Python) |
| bare | `studio` |

**`Aether CAD` contains a space.** Every shell command, script path and CI
reference must quote it, and some tooling will not. Renaming it to `aether-cad`
removes a permanent tax. `studio` should become `aether-studio` for the same
reason — consistency — and the Python package correctly stays `aether_animation`.

Within Aether CAD, filenames are kebab-case 331, single-word lowercase 68,
PascalCase 31. The split is roughly principled (PascalCase for React
components) but inconsistently applied: `react/` root uses PascalCase while
`react/chrome/` and `react/panels/` use kebab for the same kind of file, and
`CADSettingsWindow.tsx` sits beside `CadIcon.tsx`.

A set of filenames say nothing about their contents and should be renamed when
touched: `tools/home.ts`, `tools/manage.ts`, `tools/shared.ts`,
`features/shared.ts`, `react/panels/shared.tsx`, `react/panels/bottom.tsx`,
`sketch/preview.ts`, `sketch/history.ts`, `domain.ts`, and the `startup/`
folder, which is named for *when* its code runs rather than *what* it does.

**Recommendation.** One rule per language: kebab-case for TypeScript modules,
PascalCase for files whose default export is a React component, snake_case for
Python. Rename `Aether CAD` → `aether-cad` and `studio` → `aether-studio` in a
single mechanical commit, before any split.

## 5. Repository weight and tooling

- **No root `package.json` and no workspaces.** Nine TypeScript packages
  install independently into 13 `node_modules` trees.
- **Version drift has already started.** Aether Map is on Vite 8 and TypeScript
  6; every other app is on Vite 7 and TypeScript 5.9. Nothing caught this,
  because nothing checks it.
- **`core/assets` is 6,284 of roughly 8,700 tracked files** — 72% of the
  repository by file count. One vendored icon pack, `freecad-graphite`,
  accounts for 5,217 of them, plus a 4.3 MB `sources.zip`.
- **42 MB of binaries are tracked in `aether-map/public/vendor`** (two WASM
  modules and two ML model files). The git history is **351 MB**, and these are
  its largest objects.
- The working tree also carries ~1.4 GB of untracked reference material:
  `FreeCAD-main` 436 MB, `onshape mockup` 568 MB, `examples` 324 MB,
  ` REFERENCE CAD` 54 MB. Harmless to clones, heavy to work in.
- Two stale `*.egg-info` directories, `anima_core` and `animacore`, survive the
  September rename and should be deleted.
- `dev/docs/roadmap/` holds 61 documents, several of which describe work that
  has shipped. Roadmap and reality are supposed to be separate directories, and
  the roadmap one is drifting.
- **`.gitignore` gap.** Eight of the ten `.app` build bundles are ignored;
  `Aether Drive.app` and `Aether IO.app` are not. A single careless `git add`
  commits them. Two lines fixes it, and it should be done today.
- **39 MB of unoptimised PNGs** in `core/assets/branding/new-aether-2026-09/`,
  with around twenty files over 1 MB each. They render as app tiles and heroes;
  as WebP at display size they would be a tenth of that. This is the cheapest
  large win in the repository.
- **`core/assets/icon-packs/freecad-graphite/` is 57 MB**, holding several full
  copies of every SVG plus a committed 4.3 MB `sources.zip`. An archive should
  not be in version control at all.
- Four files under `core/assets` are machine-generated and imported directly by
  `core/ui/src`, the largest being a **10,641-line catalogue**. They are
  hand-edit hazards and should be generated into a build output rather than
  committed as source.

**Recommendation.** Add a root `package.json` with npm workspaces: one install,
one `npm test`, one place pinning shared dependency versions. Move the tracked
WASM and model binaries to Git LFS or fetch them in `prebuild` (Map already has
a `prepare-vendor.mjs` script that could own this). Delete the stale egg-info
directories. Move the vendored icon pack behind a generated catalogue rather
than 5,217 tracked files.

---

## 6. Should each app get its own repository?

**Recommendation: not yet. Make the boundaries real first, then split the apps
that have earned it — probably not all of them.**

The measurement that decides this is how often one change touches both the
shared layer and a product. Across the repository's code commits:

| Commit touches | Count |
|---|---|
| Both `core/` and a product | **13 (41%)** |
| A product only | 12 |
| `core/` only | 7 |

**Two commits in five would become a cross-repository release today.** In
separate repositories each of those becomes: change `core/ui`, publish a
version, bump it in the consuming app, open a second pull request, and keep the
two in step. At the current rate of shared-widget work that is a significant
tax for no present benefit.

The second blocker is that the boundaries are not boundaries yet. There are
**250 relative imports that cross a package root** — `core/ui` reaching into
`core/assets` 141 times, Aether CAD reaching into `core/session` and
`core/assets` 76 times, Studio 18. Every one of those is a path that only
resolves because everything shares a working tree. They must become package
imports before a split is even mechanically possible.

### What would have to be true first

1. **Shared code is consumed as packages, not paths.** Replace all 250
   cross-root relative imports with `@aether/*` package imports. This is the
   real prerequisite and it is worth doing regardless, because it is what makes
   the ownership contract enforceable by a tool rather than by review.
1b. **`core/ui` must be publishable on its own.** Today it cannot be: its
   devDependency on Aether CAD's engine means the design system does not build
   without the CAD product beside it. The contract permits that arrangement, so
   this is not a rule being broken — but it is a hard blocker for step 1, and
   the fix is small (move the engine-dependent gallery demos into Aether CAD).
   The thirteen product-specific widgets sitting in `core/ui/src` are the same
   problem in a different form: each one ties the shared library to a product.
2. **The shared API stops churning.** When `core/ui` changes stop appearing in
   two commits out of five, the tax of publishing becomes affordable. Tracking
   that ratio is the honest signal for when to split.
3. **Every app is in CI** (§1), because after a split each repository's CI is
   the only thing standing between it and a broken shared dependency.
4. **The rename is done** (§4), because renaming a repository after the split
   is far more disruptive than renaming a folder before it.

### A sequence, when the time comes

1. **Extract the shared packages first, in place**: `@aether/ui`,
   `@aether/assets`, `@aether/session`, `@aether/sketch`. Published, versioned,
   consumed by version — while still living in this repository. This gets all
   the discipline of a split with none of the overhead, and is reversible.
2. **Split the server next.** `core/host` and `core/session` are a service with
   a wire protocol, the cleanest boundary in the suite, and the one with the
   fewest cross-cutting commits.
3. **Split the most independent product first** to learn the real cost. Aether
   Sketch or Aether Vector, not Aether CAD.
4. **Leave Aether CAD and Aether Map in the monorepo longest.** They are the
   largest, change the most, and consume the most shared surface.
5. **Filter history per repository.** A naive split gives every repository the
   same 351 MB of history, most of it other apps' binaries.

### How many repositories, realistically

Not nine. Of the seven applications the host registers, Aether Drive has no
folder of its own, Aether Vector is 31 lines, and Aether Dynamics is a README.
A split that reflects what actually exists is **four or five repositories**:
Aether CAD, Aether Map, Aether Animation, the server, and the shared packages —
with Studio/Drive, IO, Sketch and Vector sharing one until they are large
enough to earn separation.

### The honest case against splitting at all

*(Retained as the argument that was made and considered. Jonathan has since
decided to split; the costs below are real and are what the staging in the
split-preparation brief is designed to contain.)*

Nine repositories need nine CI configurations, nine dependency update streams,
and a release process for every shared change. The suite has one maintainer and
two agents. A monorepo with real package boundaries and workspaces gives most
of the isolation being sought — independent versioning, enforced dependency
direction, per-app CI — without any of that overhead. **Step 1 of the sequence
above is worth doing on its own merits. Steps 2 onward should wait for a
concrete reason beyond tidiness.**

---

## Priority order

| # | Action | Why first |
|---|---|---|
| 1 | Put Aether CAD and Aether Map in CI | 1,287 tests currently ungated |
| 2 | Wire all five guards into the builds they protect | They already exist and already detect real problems |
| 3 | Rename `Aether CAD` → `aether-cad`, `studio` → `aether-studio` | Cheapest permanent win; must precede any split |
| 4 | Root `package.json` with workspaces; pin shared versions | Version drift has already started |
| 5 | Add the two missing `.gitignore` lines for the `.app` bundles | Two lines; prevents committing build output by accident |
| 6 | Migrate the gallery off `core/ui/src/kit/`, then delete it | 3,907 duplicate lines; the gallery still needs them, so migrate first |
| 7 | Convert the 39 MB of branding PNGs to WebP | Largest size win for the least work |
| 8 | Burn down the 65 shared-widget overrides | Agreed rule, measured violations, detector in place |
| 9 | Enable `strict` in Aether CAD and Aether Map | Largest apps, weakest checking |
| 9b | **Give Studio some tests** | 8,200 lines, zero tests, serves every app's home |
| 10 | Fold Map's 97 root files into `output/`, `surface/`, `scene/`, `layer/` | Worst root-dumping in the suite; the names already say where |
| 10b | Fold CAD's 111 root files into feature folders | Mechanical; `features/` is the model |
| 11 | Sub-group `sketch/`'s 175 files by their existing prefixes | Same exercise, one folder down |
| 11b | Split `core/host`'s 27 root files; consolidate the six drive modules | 56% loose at root, ~1,727 accreted lines |
| 11c | Give Aether Drive its own folder; move `harness-demo/` out of CAD | "Each app its own folder" is not true in three places |
| 12 | Move the 13 product-specific widgets out of `core/ui` | Each is a reason a product cannot split cleanly |
| 13 | Replace 250 cross-root relative imports with package imports | The real prerequisite for any split |
| 14 | Binaries to LFS; delete stale egg-info; prune the roadmap | Repository hygiene |
| 15 | Decide whether Aether Vector and Dynamics are real yet | 31 lines and 0 lines, carrying full tooling |

Items 1 through 9b are each a day or less and independent of each other; items
5 through 7 are closer to an hour each. Items 10 through 13 are the
reorganisation proper — do Map before CAD, since it is further gone and the
move is identical — and item 13 is the one that decides whether a split is ever
cheap.

## Housekeeping, separately

Roughly **900 MB of untracked material** sits in the working tree with no build
or import referencing any of it: an upstream FreeCAD clone and its zip (543 MB),
three unrelated third-party example clones (285 MB), the vendored
` REFERENCE CAD/` (54 MB), the stale egg-info directories, and the `.app`
bundles. None of it is in git, so none of it affects a clone — it only makes
the working tree heavy and pollutes every repository-wide search. ` REFERENCE
CAD/` is actively misleading: its 5,360-line vendored stylesheet is the largest
CSS file in the tree and distorts any survey of the suite's CSS.

One piece of top-level clutter *is* tracked and needs a decision rather than a
deletion: **`onshape mockup/`, 34 files in git**. Nothing imports it and no
build touches it, but it is the interaction reference the CAD work is measured
against. Either move it out of the repository and link to it, or absorb what is
still useful into `core/ui/gallery` and delete the rest.

---

## Verified follow-through — 2026-10-03 (Codex)

The review above is retained as the original recommendation. The following
corrections supersede its affected assertions, based on the current source:

- **CAD already has strict checking.** Both `Aether CAD/tsconfig.app.json` and
  `tsconfig.node.json` enable `strict`; the root config only lists references.
  Map did not explicitly declare it. Its application check passed with `--strict`, so strict is
  now enabled in both Map configs and its production build verified.
- **The kit is live reference UI, not dead code.** `Variants`, `AtlasKit`,
  `KitSpecimens`, `LibraryGaps`, `DemoShowcase`, Animation Mockup and Atlas Demo
  import it; two test modules exercise it. Its duplication merits a migration,
  but deleting it now would break the gallery/reference experiences. Inventory
  remaining interaction variants, migrate their consumers, and remove it only
  after those flows pass. Keep the archived originals and the Onshape reference.
- **Sketch's `useDocument` is undo/redo state, not document transport.** It owns
  the local past/present/future stack, while `useHostedDocument` persists it.
  Their coexistence is not evidence of transport duplication; don't merge these
  responsibilities merely because both hook names contain “Document”.
- **Four `dev/check-*.mjs` guards existed**, not five. The override detector did
  report 65 findings, but scanned CAD/Studio/Animation only and returned success
  even when findings existed. It did not cover Map, and line-based matching misses
  multiline selectors. Enforcement now wraps its actual output; coverage expansion
  remains explicit work in the existing owner's cleanup claim.
- **Package publication is a separate build target from the gallery.** The
  permitted CAD devDependency complicates isolated installation/builds, but it is
  not by itself proof that npm cannot publish a package. Runtime relative asset
  imports and packaging/export rules must also be addressed and verified with a
  packed-artifact consumer outside the checkout.
- **Shared presentation is not inherently misplaced because it depicts a product
  domain.** Before relocating harness/circuit/material/sequence widgets, inspect
  actual consumers and semantics. Retain engine-free widgets with real shared
  consumers; move product data/operations into their product adapters.

### Implemented now

1. One web-package inventory feeds the CI matrix and local root verification
   commands. CAD, its parked engine, Map, shared sketch, Sketch, IO, UI, Animation,
   Studio/Drive and Vector now have their applicable tests/checks/builds configured
   in CI. Session dependencies are installed for consumers. Python CI is retained.
2. All four existing guards run through the root checks and CI. The shared-widget
   ratchet rejects new path/selector findings and requires removing resolved debt
   entries. The existing 65 are tracked rather than hidden by a count threshold.
3. Drive/IO generated `.app` launchers are ignored.
4. Map strict checking is enabled. The expanded checks also found and fixed CAD
   PartManagerPanel's unguarded render-time `location` access.
5. Eleven active PNG imports now use WebP derivatives: **18,921,217 → 1,415,094
   bytes (92.5% smaller)** at unchanged dimensions. Source PNGs remain intact;
   this is a browser payload improvement, not a git-history reduction.

See [Repository quality gates](../reality/Repository_Quality_Gates.md) for commands,
coverage limits and verification. Remote CI starts after these changes are committed
and pushed; configuring it locally is not a claim of a completed GitHub run.

### Next structural migrations, with acceptance gates

- Finish the claimed shared-widget option/override cleanup and expand its detector
  to all products with real CSS selector parsing. Each removed rule must retain
  its interaction and responsive behaviour in browser checks.
- Define independent asset/UI/session/sketch package exports, including artwork and
  licenses. Verify `npm pack` consumers in a clean directory with no product source
  paths, then isolate engine-dependent gallery demos. Introduce version consumption
  and workspaces together with a clean lockfile install and all consumer checks.
  Version pinning alone does not make relative imports into package boundaries.
- Migrate the live kit's gallery consumers to shared components; delete its exported
  entry only when reference interactions and saved preferences remain covered.
- Reorganize CAD feature folders and root names in dedicated mechanical changes
  after current overlapping file claims are released. Update imports, fixture paths,
  scripts, installers, documentation and CI together; check clean installs as well
  as builds. File renames do not themselves improve runtime performance.
- Convert CAD JSX behaviour tests incrementally to typed TSX, retaining their
  scenarios; don't trade coverage for a smaller untyped-file count.
- Decide binary distribution and offline-install requirements before removing
  vendored WASM/models or adopting LFS. Preserve license/source provenance and
  provide checksum-verified restoration. Never purge local references or deployment
  bundles as a side effect of code cleanup.

These migrations remain planned. The initial “one day or less” estimates and the
claim that all first-nine items are independent should not be used as delivery
promises: package moves, workspaces, aliases, shared-widget consumers and active
claims make several of them dependent on one another.
