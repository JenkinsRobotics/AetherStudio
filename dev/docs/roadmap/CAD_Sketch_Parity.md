# CAD sketch parity acceptance ledger

Updated 2026-10-14. This is an implementation ledger, not a claim of complete parity.

Current finish gates and architecture: [CAD_Sketch_Parity_Gates.md](CAD_Sketch_Parity_Gates.md). Older dated rows are historical checkpoints, not the current completion checklist.

Reference inventory: [Onshape sketch tools](https://cad.onshape.com/help/Content/Sketch/sketch_tools.htm), [official icon glossary](https://cad.onshape.com/help/Content/Home/icon_glossary.htm).

## CAD sketch tools and handoff — installed 2026-10-14

`cad-sketch-tool-first-20261014-r1` adds persistent canvas-first constraint
picking, retries/cancellation/one-step undo, complete Coincident point sets,
and automatic all-region handoff from an open sketch into Extrude. Explicit
A/B editing and approved shared feature windows remain. Whole-entity Fix,
conics, Pierce and broader spline/reference parity remain open; the explicit
sketch-parity goal is active. Current finish gates are in
`dev/docs/roadmap/CAD_Sketch_Parity_Gates.md`.

341 distinct focused tests, types/build and real built-browser/FreeCAD
create/constrain/extrude/reopen/dimension/rebuild checks pass. Three R7 × 10mm
cylinders each measure1539.380400mm³ within0.00001mm³. All3507 CAD assets and59
worker modules match; current UI showcase/Map/session/native/other apps/data
are preserved. Store counts remain32 documents,609 operations/revisions,
442 blobs and6 uploads; PostgreSQL not restarted. Installed entry verified
through sign-in only; native modeling proof uses the matching isolated fixture.
Evidence: `../Aether-CAD/.verification/sketch-tool-first-2026-10-14/RESULTS.md`.

## Selection constraint workflow — 2026-10-13 (installed)

Constraint commands now preserve and consume complete selections. Horizontal/Vertical
cover multiple lines or point sets; Equal/Parallel/Concentric link compatible sets;
Fix handles editable points. Midpoint accepts either pick order. Canonical solves
commit atomically with one Undo, preserve existing dimension drivers, reject mixed
or conflicting sets without partial mutation, and avoid repeated group relations.
The approved feature editor exposes a selected-geometry count/toggle and retains
manual A/B and sequential projected picking. No new parked-engine algorithms.

215 focused tests, full types/build and real browser/FreeCAD checks pass: three
circles constrained, undone/redone, resized, extruded, reopened and resized again
with three correct downstream solids. Generation `cad-sketch-constraints-20261013-r1`
is installed;3507 hashes/59 worker matches verified, Map/native/session/data preserved.
The disposable browser session is not signed into the installation; installed
entry-point authentication is verified, modeling proof uses the matching fixture.
Full parity remains open, including whole-curve Fix/unfix, tool-first constraints,
Pierce/conic and broader spline/reference/native-solver acceptance. Evidence:
`../Aether-CAD/.verification/sketch-constraints-2026-10-13/RESULTS.md`.

## Rectangle creation and center-node interaction — 2026-10-13

Qualified and installed in `cad-sketch-creation-20261013-r2`: explicit center node
presentation/picking/snap names, two-click and click-drag rectangle placement,
Alt-square Equal relationship, immediate driving width/height with unit conversion,
external initial dimension labels, mixed pointer/typed origin retention, and
editable/reopenable constraints. Existing canonical relations/solver were reused;
no new parked-engine algorithms.217 distinct focused tests, source/candidate types,
build and real native-browser sketch/edit/extrude/reopen checks pass. Native solid:
60×30×10mm, volume17,999.999998889394mm³. See the CAD verification RESULTS file.

Remaining acceptance: dedicated Pierce and conic tools are absent from the current
catalogs. Do not infer parity from tool names: qualify all supported pairings,
external-reference updates, spline editing, large constrained sketches and native
solver behavior independently. Also repair the standalone imported-file Show code
case found in the fixture (hosted tab actions already have separate coverage).

## Reflected editable text frames — 2026-09-09

- Added optional `placementReflected` to retained text placement. Reflection now applies to the entire local coordinate system; construction corners/edges keep their ordering and identities. Existing documents default to unchanged placement. Letter flip controls remain independent.
- Copied framed text now remains editable through regeneration, dimensions, solving, resizing and native save/reopen. The CAD text preview and box-placement calculations use the same Core orientation. This removes the previous explicit rejection of frame-centered reflected copies.
- Verification: Core **698 tests passed**, Core typecheck and CAD build passed. CAD broad run passed **430 existing tests**; the new reflected-frame test initially failed on exact floating-point SVG string equality, then passed after switching to numerical tolerances. The corrected test covers preview, rewording, undo/redo, native reopening and unchanged frame identities. Live browser verification remains outstanding.
- Full parity remains open: transform constraint adaptation, partial-edge clipboard selection, text shaping/import gaps and the remaining acceptance matrix still require work.

## Sketch clipboard controls — 2026-09-09

- Added a focused `sketch/clipboard.ts` browser adapter: contour selection, native canvas copy/paste, clipboard buttons, offset/rotation/scale preview, explicit Apply/Cancel and Escape cancellation. Text fields retain normal clipboard behavior.
- Paste commits geometry, compatible internal dimensions/constraints, complete retained text groups and referenced variables in one draft undo step. Conflicting variable definitions fail before mutation; stale asynchronous reads are discarded. Finish requires resolving a pending preview.
- Verification: CAD suite 429 tests passed, then the added workspace integration test passed with all four focused clipboard tests; CAD typecheck/build passed. Core's unchanged clipboard contract was previously verified in 696 tests. Native save/reopen and variable-aware undo/redo are covered in JSDOM. No live browser session was available (`browsers.list() = []`); visual and OS clipboard acceptance remain outstanding.
- Limits: clipboard selection currently copies whole contours. Partial-edge packaging, frame-centered reflected text, broader transform constraint adaptation and full parity remain open.

## Portable sketch clipboard contract — 2026-09-09

- Added versioned `aether-sketch-clipboard` fragments in focused `document/sketch-clipboard.ts`, with bounded parsing/serialization, internal-geometry validation and formula-cache checks. Fragment creation preserves compatible copied constraints and complete editable text groups using the same copy implementation as Transform.
- `clipboard-variables.ts` walks expression ASTs to include only referenced definitions and transitive dependencies. Paste merges identical definitions and rejects conflicting names before returning geometry/variables for one draft commit. External projected context/relations never travel in the payload.
- Extracted a shared internal append primitive so copying a 1,000-contour selection does not temporarily need 2,000 contours. Repeated pastes get independent geometry, text and constraint identities; targets remain unchanged on validation/capacity/conflict errors.
- Five tests cover selected dependencies, repeated paste/native persistence, malformed/stale/conflicting payloads, embedded editable text and capacity. Full Core **696** / CAD **426** tests, Core typecheck and production build passed; all handles exited 0. Existing warnings remain.
- This slice implements the Core clipboard contract, not browser clipboard commands. UI selection/clipboard events, placement preview, draft-variable undo integration for paste and live browser acceptance remain next; broader parity stays open.

## Editable text Transform copies — 2026-09-09

- Added focused Core `text/copy.ts`: complete intact text groups retain independent wording/font/formula metadata, transformed placement/em/frame sizing, ascender mode and remapped ownership/frame IDs. Copied frame constraints remain independent; outline digests are refreshed.
- Partial or manually edited groups remain ordinary curves. Associative pattern copies explicitly omit retained metadata because their source graph owns geometry. Unframed reflection is supported; frame-centered reflected copies reject explicitly pending frame-reference remapping.
- Four Core tests cover scaled/rotated independent editing/native persistence, multi-copy expression regeneration, partial/manual selections and reflected regeneration geometry. A mounted Transform workflow covers copied-text selection, independent rewording, undo/redo and native reopening. Full Core **691** / CAD **426** tests, Core typecheck and production build passed. All process handles exited 0; existing warnings remain.
- Clipboard transport, frame-centered reflection, arbitrary-rotation constraint replacement, move-transform adaptation and live browser/full parity remain open.

## Constraint-preserving transform copies — 2026-09-09

- Rechecked [Onshape Transform Sketch](https://cad.onshape.com/help/Content/Sketch/sketch_transform.htm): internal relations survive translations/half turns, horizontal/vertical swap at quarter turns, and directed dimensions may be removed or replaced.
- Added focused Core `copy-constraints.ts`: copies remap internal contour/constraint identities, preserve independent dimension links and variable formulas, scale dimensional values, transform fixed points and swap applicable axis relations. Unselected external references and original pattern membership are omitted. Incompatible retained relations reject before returning geometry. Arbitrary rotations omit incompatible axis constraints; replacement construction geometry is not yet implemented.
- Associative pattern construction explicitly uses geometry-only copies to avoid duplicate source/instance equations. Added Transform's Copy selected geometry option with copied-geometry preview and a visible explanation of omitted relations.
- Five Core tests cover linked drivers/scaling, external-driver formula retention, quarter-turn/fixed-point remapping, multiple copies and native irrational-formula persistence. A mounted workflow covers preview, independent radius edits, undo and native reopening. Full Core **687** / CAD **425** tests, Core typecheck and build passed. After final explanatory hint wiring, the copy workflow and build passed again. All process handles exited 0; existing warnings remain.
- Clipboard transport, retained text metadata copying, arbitrary-rotation DOF replacement and move-transform constraint adaptation remain open, alongside live browser/full sketch acceptance.

## Initial dimension formula creation — 2026-09-09

- Added focused `sketch/constraint-formula.ts`: initial driving dimensions can use retained formulas evaluated against current draft variables. Numeric mode retains document display units; formula mode requires explicit compatible units and disables the numeric entry.
- Creation resolves through Core before a single constraint solve/undo commit. Invalid formulas commit nothing. Reference measurements and nondimensional relations ignore formula input. Saved formulas flow into the existing dimension editor and native variable validation.
- Three mounted workflows cover length/radius/angle creation, missing variables, undo/redo, native persistence and exclusion from reference measurements. Full CAD **424** tests, production build and Core typecheck passed; all process handles exited 0. Existing build warnings remain.
- Read-only propagation audit found `copySketchContours` currently copies geometry without its constraints. Constraint-preserving copy and broader tool propagation remain next, alongside live browser/full sketch acceptance.

## Saved dimension formula editor — 2026-09-09

- Added focused `sketch/dimension-formula-editor.ts` for applying/removing formulas on saved driving dimensions using current draft variables. Formula-bound numeric values are read-only and show the formula; removal restores independent numeric editing at the current value.
- Linked followers of formula drivers edit the shared driver with an explicit explanation. Annotation focus opens/selects the formula; pending formula text survives selection-mode refresh. Every mutation uses Core operations and the normal sketch undo checkpoint.
- Full CAD **420** tests and production build passed. Final **2/2** formula workflow tests cover entry/unit errors, draft-variable update, undo/redo, annotation focus, native reopen/removal and shared-driver editing. A test selector initially matched the SVG annotation instead of the saved row; narrowed to the row and reran successfully. All process handles exited 0; existing build warnings remain.
- Formula entry during initial constraint creation, broader geometry-tool propagation and live browser acceptance remain open. Full sketch parity is not complete.

## Native dimensional expression bindings — 2026-09-09

- Added optional `valueExpression` for independent driving dimensions, with syntax/type validation and a canonical mm/degree value cache. Focused solver expression and operation modules resolve explicit typed units; unknown variables, incompatible units, invalid formula state and unsolvable dimensions reject.
- `setDimensionExpression` binds/unbinds formulas; variable regeneration resolves all drivers before one solve. Linked followers follow formula drivers. Numeric overwrites reject until the formula is removed; explicit conversion to a link or reference dimension removes its formula.
- Document validation now checks dimensional caches against variables, and document/draft variable transactions regenerate dimensional geometry as well as text. No resolver or variable cache persists in the sketch.
- Five Core tests cover typed lengths/angles, followers, rejection/immutability, explicit conversion and native transactions. Full Core **682** / CAD **418** tests, Core typecheck and CAD build passed. A subsequent focused workspace test confirms variable-driven radius regeneration/native save; all **3/3** variable UI tests passed. All handles exited 0; existing warnings remain.
- Formula creation/editing controls in the dimension panel remain next. Full tool propagation, live browser acceptance and the broader sketch parity ledger remain open.

## Sketch draft variable editor — 2026-09-09

- Added focused `sketch/variables.ts` for adding/removing/editing typed variable definitions. Core evaluates expressions and regenerates draft text atomically; invalid definitions and concurrent/disposed edits cannot commit. The text-expression panel now reads draft variables.
- Sketch undo snapshots include variables alongside geometry and annotation positions. Cancel discards variable changes. Finish rejects unapplied form edits, snapshots draft state across asynchronous work, and commits variables plus the edited profile through one Core transaction.
- `updatePartDocumentVariables` accepts an optional profile draft, supporting removal of a binding and its variable together, or insertion at rollback with new definitions. Canonical insertion bookkeeping is retained. Other affected sketches regenerate before final validation.
- Full Core **677** / CAD **417** tests, Core typecheck and CAD build passed. A subsequent focused second UI test for adding typed variables/removing unused ones passed (**2/2** variable tests). Existing formula UI test now verifies draft isolation. All process handles exited 0; existing build warnings remain.
- Variable-to-dimension bindings, richer variable presentation and live browser acceptance remain unfinished. Full sketch parity stays open.

## Sketch text expression authoring — 2026-09-09

- Focused `sketch/text-expression.ts` adds Use text expression, a formula field and resolved read-only wording. It uses Core evaluation with document variables, supports explicit return to literal text, and restores formula mode when loading saved items or undoing/redoing changes.
- The text panel previews resolved lettering and passes native bindings to Core. Invalid formulas clear preview and disable saves. Variable changes after preview trigger refresh and require another save attempt; ordinary outline insertion performs the same check. Workspace wiring supplies current document variables without duplicating evaluation logic.
- A real-font mounted workspace test covers preview, missing variables, stale-preview rejection, update, undo/redo, native save/reopen and conversion to literal wording. Full CAD **416** tests/build passed; after the stale-preview guard, all **22** text tests and final production build passed. All process handles exited 0. Existing build warnings remain.
- Browser discovery returned no sessions. A variable-definition editor, sketch draft-variable undo/transaction integration and live browser acceptance remain unfinished. Full sketch parity stays open.

## Document-wide text variable transactions — 2026-09-09

- `document/text-expressions.ts` validates resolved wording against saved variables after feature structure validation. Missing references and stale wording reject native validation, saving and reopening, including suppressed and rolled-back sketches.
- `updatePartDocumentVariables` snapshots the document and definitions, regenerates affected direct and projection-authored drawings in feature order, and validates the complete result before returning. Temporary projection context never persists. Unchanged wording retains contour identities; failed regeneration or orphaned downstream selected-contour projections reject the entire update.
- Six new document tests cover native stale-cache rejection, suppressed/projected authored updates, invalid definitions/glyphs, caller-input snapshots, clearing unused variables and downstream projection identity failure. Full Core **675** / CAD **415** tests, Core typecheck and CAD build passed; all process handles exited 0. Initial fixture error (missing empty-document name) was corrected before final checks. Existing build warnings remain.
- Variable/text-expression authoring UI, draft/undo integration and live browser acceptance remain next. Full sketch parity remains open.

## Retained text expression regeneration — 2026-09-09

- Retained text now supports an optional syntax-validated formula and resolved wording. Core uses the shared typed evaluator and ephemeral variable map; dimensional values require explicit unit conversion. Omitting the formula preserves its binding; null explicitly selects literal text.
- Focused `text/expression.ts` and `text/regenerate-expressions.ts` separate evaluation from atomic regeneration. Changed wording regenerates from embedded fonts while preserving construction frames/constraints, placement, flips and ascender sizing. Unchanged wording preserves edge identities and manual edits. Any failure leaves the source drawing unchanged.
- Full Core **668** / CAD **415** tests, Core typecheck and CAD build passed. A subsequent sixth expression test verifies rollback after an earlier item successfully regenerates; final focused **6/6** and Core typecheck passed. Existing build warnings remain.
- Document-wide variable update transactions, validating cached wording against document variables, and the variable/text-expression editor remain unfinished. Native drawing validation currently checks expression syntax only. Live browser acceptance and the broader parity ledger remain open.

## Shared typed expressions and native variables — 2026-09-09

- Added focused Core expression modules for a bounded AST/parser, SI quantities with length/angle powers, strings, unit-safe evaluation and allowed functions. Supports unit conversion, #variables, concatenation and roundToPrecision without JavaScript evaluation or property access.
- Added optional native Part variable definitions (name/kind/expression), validated and resolved through a dependency map. Unknown references, cycles, wrong declared dimensions and duplicate names reject; only definitions persist, not resolved caches.
- Existing numeric-field calculations now use the same parser/evaluator with units/variables/text disabled, preserving display-unit semantics and incomplete-input guidance. Numeric functions such as sqrt, trigonometry, min/max and rounding are available; mounted inch/radian constraint tests exercise them.
- Added 25 expression tests, eight native-variable tests and four numeric-function cases. Final full Core **663** / CAD **415** tests, Core typecheck and CAD production build passed; all final process handles exited 0. Initial checks identified and corrected numeric error-message compatibility and a parameterized-test array issue. Existing build warnings remain.
- This is the shared evaluation/native-storage foundation. The variable editor, sketch-text expression bindings and automatic geometry regeneration are not implemented by this slice. Other parity/live browser acceptance remains open.

## Ascender-based text sizing — 2026-09-09

- Added shared `text/font.ts` parsed-font caching/ascender metrics and `text/height.ts` frame-height projection. Optional native `fontAscenderRatio` preserves physical height during synchronous solving; absence keeps legacy em-height geometry.
- `putSketchText.textHeightMillimeters` converts requested baseline-to-font-ascender height into em size. Null explicitly selects em sizing; omission preserves the existing mode. Frames and vertical center flips use the shared physical-height projection.
- Focused CAD `text-height.ts` supplies optional ascender mode and Text height (mm), retaining the existing em control. Box gestures and resize handles convert physical frame height consistently, and saved fields follow undo/redo/native reopening.
- Four Core tests cover metric conversion, frame height, native dimension/resize behavior, flips/legacy mode and invalid input. A real-font workspace test covers entry/reopening/handle sizing/undo. Full Core **626** / CAD **415** tests, Core typecheck and CAD production build passed; all process handles exited 0. Existing build warnings remain.
- Browser discovery returned no sessions. Text expressions, mixed-script/direction layout and the remaining overall sketch/live acceptance ledger stay open. Ascender mode is explicit; existing em authoring remains available.

## Default text baseline constraint — 2026-09-09

- Added focused Core `text/baseline.ts`: newly created horizontal frames receive a normal horizontal relation on the lower edge. Explicitly rotated frames and existing retained letters with driving constraints skip this inference to avoid forcing orientation or adding redundant relations.
- The relation is creation-only. Native text regeneration remaps/preserves its identity, and removal through ordinary constraint controls is never undone by rewording. A newly created unconstrained horizontal frame now has four remaining DOF, with its five geometric coordinates unchanged.
- Three Core tests cover creation/rewording identity, removal/rotation/native persistence and inference exclusions. A mounted real-font workspace test covers visible constraint removal, undo/redo, rotation and native save. Existing drag/resize fixtures were updated to retain the newly inferred relation; a rotated fixture explicitly removes it first.
- Final full Core **622** / CAD **414** tests, Core typecheck and CAD production build passed; all final process handles exited 0. Existing build warnings remain. Ascender sizing, text expressions, mixed-script layout and full/live browser parity remain open.

## Frame-center text flips — 2026-09-09

- Added persisted `flipAboutFrame`: new framed text defaults to reflection around frame width/em-height centers; absent/false preserves legacy baseline-axis placement. The panel exposes the convention for explicit editing of older text.
- Shared placement separates glyph reflection from construction frame axes. Preview, native generation, box gestures and resize handles use the matching transforms. Focused `text/frame-width.ts` adjusts reflected glyph placement for independent width changes in both solver and explicit resize operations; letters are not stretched.
- Four Core tests cover stationary-frame flips/resizing, driving width, rotated multiline native regeneration and absent-field compatibility. A real-font mounted workspace test covers preview, unchanged frame and native mode persistence. An initial exact-path comparison was corrected to numerical tolerance for normalized preview rounding.
- Full Core **619** / CAD **413** tests, Core typecheck and CAD production build passed; all final process handles exited 0. Existing build warnings remain. First-line ascender sizing, variable text expressions, mixed-script layout and full/live browser acceptance remain unfinished.

## Multiline retained sketch text — 2026-09-09

- Rechecked [Onshape Text documentation](https://cad.onshape.com/help/Content/Sketch/text.htm): later lines appear below the first-line frame. Added shared `text/content.ts` validation/newline normalization and per-line HarfBuzz shaping with font-metric baseline advance. Empty lines retain spacing; width does not wrap or stretch text.
- The CAD text field is now a themed textarea. Multiline wording persists in retained text, previews before commit, participates in undo/redo and survives native reopening. Existing first-line em-frame sizing and proportional resizing continue across all lines.
- Three Core tests cover line placement/counters/blank lines, native persistence/resizing/rewording and validation. One mounted real-font workspace test covers textarea preview, update, undo/redo and reopening. Full Core **615** / CAD **412** tests and Core typecheck passed. CAD production build passed again after the final textarea CSS adjustment. All process handles exited 0; existing build warnings remain.
- Full Text parity is still incomplete: reference flips about frame centers versus current baseline axes, ascender-based first-line sizing versus explicit em sizing, document-variable text expressions, mixed-script/direction itemization and live browser acceptance remain. Ledger stays open.

## Explicit retained text resize handles — 2026-09-09

- Added focused Core `text/resize.ts`: explicit frame width/em height resizing preserves baseline, rotation/flips, frame identities and glyph proportions. Temporary corner targets enforce the requested resize against saved constraints; conflicts reject atomically and targets never persist.
- CAD `text-resize.ts` projects width/height/corner handles for selected saved text. Pointer motion previews Core results, release commits through the normal workspace checkpoint, and Escape/cancel/tool switching discard previews. Concurrent document changes and disposal cannot commit stale previews.
- Four Core tests cover independent width/proportional height, rotated/reflected identities, locked dimensions and malformed/modified geometry. Three mounted real-font tests cover preview/commit/native persistence, cancellation/conflicts and stale/disposed operations. Full Core **612** / CAD **411** tests, Core typecheck and CAD production build passed; all process handles exited 0. Existing build warnings remain.
- Browser discovery again returned no sessions. Full live viewport acceptance, broader text layout and remaining sketch parity stay open. This implements dedicated baseline-preserving resize handles; it does not establish complete Text parity.

## Retained text pointer editing — 2026-09-09

- Fixed ordinary vertex/edge dragging invalidating retained text's digest before solving. Focused Core `text/drag.ts` now seeds movement by translating all owned contours and baseline metadata together; saved constraints then solve against the intact group.
- Free text moves together and remains editable. With a fixed baseline origin and horizontal baseline, dragging the opposite frame corner changes width/em height while preserving glyph proportions. Incompatible anchored moves reject atomically; temporary drag constraints are removed.
- Three Core tests cover movement/rewording, anchored resizing and conflict immutability. A mounted selection-controller test uses real font outlines and native reopening before anchored resizing. Full Core **608** / CAD **408** tests, Core typecheck and CAD production build passed; all process handles exited 0. Existing build warnings remain.
- Browser discovery returned no sessions. Dedicated resize handles for unconstrained frames, broader layout, remaining sketch parity and full live browser workflows remain unfinished.

## Canvas text frame placement — 2026-09-09

- Added focused CAD `text-box-placement.ts`: drag or click two corners with shared geometry snapping (including arc centers), current text rotation/flip axes, reverse-corner normalization and synchronous cached-letter/frame preview. Escape and switching to baseline placement restore pre-gesture fields; zero-area and invalid-rotation frames cannot finish.
- The panel exposes optional frame width, renders a separate dashed frame and passes width through Core `putSketchText` for atomic retained-text/frame creation or update. The shared Core frame projection supplies preview geometry. Existing frame constraints continue to drive solved updates.
- Four mounted real-font tests cover drag/click placement, live resizing, snapping, native persistence, cancellation, cleanup and rotated/reverse corners. A Core test covers atomic framed creation, independent width update and invalid width rejection. Full Core **605** / CAD **407** tests, Core typecheck and CAD production build passed; all process handles exited 0. Existing build warnings remain.
- Creation still requires Create editable text after positioning. Direct resize handles on existing frames, broader text layout, full sketch parity and live browser acceptance remain unfinished. Mounted DOM verification is not live browser verification.

## Constrainable retained text frame — 2026-09-09

- Added focused Core `text/frame.ts` and optional persisted frame identity/width. Explicit **Add text frame** creates selectable construction edges using the text baseline, rotation and flips; it leaves letter outlines unchanged.
- Framed text contributes five solver coordinates: translation, rotation, uniform em scale and independent frame width. Width does not stretch letters. Baseline anchoring/orientation plus width/height dimensions fully constrain the group.
- Text regeneration preserves frame contour/edge/vertex identities and remaps its constraints, then returns solved geometry. Constraints on regenerated letter outlines and manual geometry changes still require resolution.
- Four Core tests cover dimension behavior/DOF, native reopening and rewording with retained references, conflict protection and metadata validation. A mounted real-font CAD test covers frame add/undo/redo and saved constrained text editing. Full Core **604** / CAD **403** tests, Core typecheck and CAD production build passed; all process handles exited 0. Existing build warnings remain.
- Browser discovery returned no sessions; mounted tests are not live-browser verification. Direct canvas text-box creation/resize, broader text layout and overall sketch parity remain unfinished. No silent default frame constraints are added.

## Retained text constraint grouping — 2026-09-09

- Added focused solver `text-coordinates.ts`: intact retained text contributes four transient coordinates (X/Y translation, rotation, positive uniform scale). Letter contours and counters transform together. Successful dimension solves update retained placement/em size and outline digest.
- Solver and constraint-state diagnostics use the same grouped coordinates. This prevents letter deformation under dimension constraints and reports meaningful text degrees of freedom. Modified or detached outlines continue through ordinary sketch coordinates.
- Shared `text/digest.ts` uses Noble hashes 2.4.0 for synchronous SHA-256 during solving; a compatibility test verifies the existing WebCrypto digest contract. License notice included in the text dependency notice asset.
- Four tests cover free/fully constrained DOF, proportional dimension-driven resizing with preserved holes and native reopening, incompatible aspect-ratio rejection, and digest compatibility. Full Core 600 / CAD 402 tests, Core typecheck and CAD production build passed. Existing build warnings remain.
- This establishes grouped text geometry; the dedicated selectable text frame, frame dimensions/constraints and rewording while retaining frame references are still unfinished. Live browser acceptance remains open.

## Sketch Text ribbon command and icon — 2026-09-09

- Added a dedicated illustrated Text SVG to the shared icon registry and Text entry in the sketch Insert ribbon group. The command registry now has 123 commands and the ribbon catalog 217 entries.
- Focused `sketch/text-command.ts` enables the command only for an active sketch after plane selection. Executing selects the selection tool, opens/focuses text controls, loads bundled Noto Sans Regular when needed, and restores the cached preview when returning from another tool. Existing custom/embedded fonts remain selected.
- The mounted real-font command test verifies plane gating, focus, local default loading, reuse without refetching, preview restoration and cleanup after sketch cancellation. Shared UI 149 tests/typecheck/build and CAD 402 tests/production build passed. Core unchanged from verified 596 tests. Icon thumbnail rendered and visually inspected; existing build warnings remain.
- Live browser discovery again returned no sessions. Text-box constraints/dimensions, broader text layout and full browser acceptance remain unfinished.

## Bundled font styles and real text shaping — 2026-09-09

- Added unmodified Noto Sans Regular/Bold/Italic/BoldItalic assets with original OFL license and source/checksum manifest. `sketch/text-fonts.ts` loads the selected style from the installation, cancels obsolete requests and preserves custom-file/embedded-font workflows. License links are emitted into the production assets.
- Real-font tests exposed OpenType.js's unsupported contextual substitution lookup. Added lazy HarfBuzz 1.6.1 shaping in focused Core `text/shaping.ts`, retaining OpenType for exact per-glyph curves. `text/woff.ts` unwraps compressed WOFF1 tables for shaping without losing substitution/positioning data.
- Tests cover distinct closed real-font style profiles, compressed/original font shaping equivalence, and mounted style creation/change with native retained-font persistence. Full Core 596 / CAD 401 tests, Core typecheck and CAD production build passed. Final build also passed after license/config updates.
- Production emits all four font files and HarfBuzz WASM locally. A temporary Vite server returned valid 200 responses for transformed shaping JS, WASM magic/MIME, TTF and license; server stopped afterward. Vite excludes HarfBuzz from prebundling to preserve the WASM URL. These HTTP checks are not live browser acceptance.
- Existing chunk-size warning remains; Emscripten's Node-only module import is externalized for browsers. Text-box constraints/dimensions, mixed-script/direction layout, WOFF2 and live browser verification remain open.

## Persistent text flips — 2026-09-09

- Added shared Core `text/placement.ts`: reflect in local horizontal/vertical baseline axes, then rotate and translate; positive scaling supports normalized previews. The font outline generator and CAD text panel use this same transform.
- Optional validated flip flags persist in retained text records. The panel exposes horizontal/vertical checkboxes and restores them when selecting saved text. Existing records default to unflipped.
- Six transform tests verify local-axis behavior, baseline anchoring, preview scaling and invalid options. Retained/native UI tests verify saved flip flags and mirrored geometry. Four additional real OCCT cases cover reflected multi-letter new/cut solids with correct volume, counters and closed meshes.
- Full Core 594 / CAD 400 tests, Core typecheck and CAD production build passed. Existing chunk warning remains. Text-box constraints/dimensions, font styling, broader shaping and live browser acceptance remain incomplete.

## Retained text editing in the sketch panel — 2026-09-09

- Added focused `sketch/text-items.ts` for saved-text selection, create/update, detach and async commit checks. `text-panel.ts` loads embedded fonts and authoring fields; workspace rendering synchronizes the selector and fields after undo/redo.
- Users can create retained editable text or insert ordinary outlines. Saved text reopens without selecting the font file again. Detach preserves curves, and undo restores the retained item. Delayed generation is discarded after input changes/disposal and rejects a changed sketch snapshot.
- Mounted real-font/native tests exercise create, undo/redo, save/reopen, select/edit, field history synchronization, detach and undo-detach. A controlled async test proves concurrent sketch edits and disposed panels are not overwritten. Full CAD 400 tests and production build passed; Core unchanged from verified 584 tests. Existing chunk warning remains.
- Text-box dimensions/constraints, styling/flips, broader shaping and live browser acceptance remain incomplete. Existing manual edits or constraints on generated outlines still require resolution before text regeneration.

## Retained sketch text Core contract — 2026-09-09

- Added `text/records.ts` and optional validated `SketchDrawing.textItems`: wording, embedded font bytes, explicit em size/baseline/rotation, generated contour identities and an outline digest. Ordinary manual edits/deletion remain valid; divergence is reported by edit-state inspection.
- Added `text/edit.ts` operations to create/replace retained text, inspect editability and detach metadata without changing geometry. Replacement reuses embedded fonts, regenerates atomically and remaps unrelated constraint indices. It currently rejects text whose outlines have manual changes or constraints, rather than losing that work.
- Four tests cover native save/reopen and regeneration without an external font, unrelated constraint remapping, input immutability, modified/constrained detection, detachment and malformed metadata. Full Core 584 / CAD 398 tests, Core typecheck and CAD build passed. Focused edit tests also passed after the contour-ID prefix adjustment. Existing chunk warning remains.
- The current CAD panel still inserts exploded outlines: retained creation/selection/editing UI is the next integration step. Text-box constraints, styling/flips, broader shaping and live browser acceptance remain incomplete. No full-parity claim.

## Text solids and disconnected profile holes — 2026-09-09

- Real OCCT text tests exposed a missing-region bug: subtracting a later letter's hole from an already combined 2D drawing could discard an unrelated letter that already contained a hole. Two rotated rectangular O glyphs lost half their expected volume.
- Added focused `sketch/regions/groups.ts`: simple disjoint/nested boundaries are grouped by solid and relevant holes, with nested islands and redundant deeper holes handled. `kernel/part-evaluator.ts` now cuts each solid's holes before fusing completed regions. Touching/intersecting boundaries retain ordered Boolean evaluation.
- Eight native save/reopen OCCT tests cover new-solid and through-cut text, multiple letters, counters, cubic glyph boundaries, em scaling and rotation. Checks measure analytic volume, watertight tessellation and extrusion depth. Four grouping tests cover disconnected holes, nested islands, multiple holes and fallback behavior.
- Full Core 580 / CAD 398 tests, Core typecheck and CAD production build passed. Existing chunk-size warning remains. Interactive retained text editing, text-box constraints/styles and live browser acceptance remain incomplete; these tests do not establish full Text parity.

## Text canvas placement and outline caching — 2026-09-09

- `sketch/text-placement.ts` adds baseline picking with a live outline preview, origin/endpoint/midpoint/arc-center snapping, a snapping toggle, click acceptance, Escape restoration and listener cleanup. Canvas placement itself does not commit the sketch; Insert remains undoable.
- `text-panel.ts` caches a normalized outline after font/text changes. Size, rotation and numeric/canvas positioning use Core similarity transforms synchronously without reparsing the font.
- Mounted tests verify arc-center and origin snapping, immediate preview updates, one font-generation call during resizing/placement, no underlying sketch-click leakage, explicit insertion, Escape restoration and disposal. Existing real-font/native-save tests also passed. Full CAD 398 tests and production build passed; Core unchanged from verified 568 tests. Existing chunk warning persists.
- This remains an outline insertion workflow. Onshape's [Text reference](https://cad.onshape.com/help/Content/Sketch/text.htm) also requires editable text-box dimensions/constraints, styling, flips and other text authoring behavior; those are not claimed complete. Live browser acceptance and actual text-solid verification remain outstanding.

## Sketch text outline workspace insertion — 2026-09-09

- Added `Aether CAD/src/sketch/text-panel.ts` and mounted it in the sketch workspace: caller-selected OTF/TTF/WOFF font, text, em size, baseline X/Y, rotation, asynchronous live preview, cancel and atomic insertion into the active sketch. Core remains the font/geometry owner; workspace only wires undo and cleanup.
- Inserted outlines are ordinary editable contours, including nested holes. The UI explicitly explains that insertion converts text to curves; persisted text/font authoring and a complete Text ribbon tool are still outstanding.
- Mounted tests cover preview, size/placement, insertion, undo/redo, native reopening, unsupported glyphs and cancellation during a pending font read. Full CAD 396 tests and production build passed (existing chunk warning); Core remains at the prior verified 568 tests with no Core changes this slice.
- Browser discovery again returned no sessions. Live browser acceptance, text extrusion verification, canvas-driven placement and retained text/font editing remain open.

## Sketch text outline foundation — 2026-09-09

- Added focused Core `sketch/text/outline.ts` with lazy OpenType parsing, implicit font contour closure, exact quadratic-to-cubic conversion, nested counters, em sizing and baseline placement/rotation. Caller supplies font bytes; no fonts bundled.
- Five tests cover serialized synthetic-font geometry, holes, placement, curve conversion and rejected inputs. Full Core 568 / CAD 394 tests, Core typecheck and CAD production build passed; existing chunk-size warning remains.
- This is not the complete Text tool: interactive placement, font/text metadata and editing, font selection, complex shaping and intersecting outline repair remain. Actual text extrusion and live browser acceptance are still outstanding.

## Linked ring solid acceptance — 2026-09-09

- Added actual OCCT evaluation of a native ring sketch with outer radius = 2 × inner radius + 1 mm. Four cases cover unchanged dimensions, editing the inner driver, inversely editing the outer follower and editing after unlinking. Each case serializes/reopens before modification and again before solid evaluation.
- All four kernel tests passed: exactly one hollow solid, expected inner/outer radial bounds, 5 mm depth, and triangulated volume within 3% of the analytic annular volume (display meshing tolerance 0.08 mm). Core typecheck passed. This is solid-evaluation coverage, not only solver-value assertions.
- Test-only work: previous full Core559/CAD394 baseline remains; no new full-suite/build claim. Live browser, full wheel interaction and remaining sketch parity gaps stay open.

## Linked fillet radius integration — 2026-09-09

- Audited transforms: moves preserve driving constraints and reject conflicts; copied contours are intentionally independent geometry. Found/fixed literal-radius assumptions in the Fillet edit path instead of changing that transform contract.
- Fillet handles and the reopened Fillet panel now use resolved `dimensionValue`. `editFilletRadius` delegates to `editDrawingDimension`, preserving affine links and updating the shared driver. Reference-only radius measurements do not expose editable fillet handles.
- Full Core 559 / CAD 394 tests, Core check and CAD build passed (existing size warning). Core tests verify actual arc radius, resolved handles, immutable input and reference rejection. Mounted editor test opens a native linked fillet, edits through the Fillet tool, undoes/redoes and verifies retained links/driver values after reopening. Browser list empty; live/full parity remains open.

## Unlinking dimension relationships — 2026-09-09

- Core `unlinkSketchDimension` preserves the current resolved value and exact geometry while removing the upstream driver/scale/offset/sign fields. It retains the dimension ID and downstream relationships. Repeated unlink is harmless; missing/reference dimensions reject without mutation.
- Linked dimensions expose Unlink dimension in their relationship editor. The existing commit flow supports undo/redo; formerly linked dimensions can then be edited independently.
- Full Core 557 / CAD 393 tests, Core check and CAD build passed (existing size warning). Core tests verify a three-dimension chain, immutable input, unchanged geometry, independent upstream edits and retained downstream behavior. Mounted editor coverage verifies unlink undo/redo, independent edits and native persistence. Browser list empty; full/live parity remains open.

## Persistent multiplier/offset dimension relationships — 2026-09-09

- Existing stable-ID `valueFrom` links support optional dimensionless nonzero finite `valueScale` and canonical-mm/degree `valueOffset`. Core composes chained transforms, preserves legacy angular signs, rejects cycles/missing or incompatible drivers/nonfinite arithmetic, and inversely updates the shared root when a follower value is edited.
- `linkSketchDimension` creates/replaces a relationship atomically through the existing solver. Removing a driver or converting it to a reference dimension materializes surviving values and clears link-transform metadata. Native files retain the relationship without duplicate cached values.
- Saved numeric dimensions expose an expandable relationship editor: driver, multiplier calculation and offset in document units. Core owns semantics; `dimension-link-editor.ts` owns presentation and unit-binding disposal. One-driver affine relationships are implemented; named variables and general multi-input expressions remain open.
- Full Core 555 / CAD 393 tests, Core check and CAD build passed (existing size warning). Tests cover chains/inverse edits, signs, coefficients/overflow/cycles/unit mismatch, deletion/reference transitions, UI authoring/undo, dependent geometry and native reopening. Browser list empty; live/full parity acceptance remains outstanding.

## Unit-aware sketch dimension annotations — 2026-09-09

- Sketch dimension labels now use document length/angle units and decimal precision, including reference/linked markers. Unit changes update text and spacing without rebuilding pending constraint fields. Offset/slot handle accessible value text uses display units; geometry and handle computations remain canonical.
- Label activation previously discarded pending saved-dimension edits through selection-mode refresh. The panel now captures/restores those numeric input strings before focusing the chosen dimension. `dimension-label-units.ts` owns formatting and the workspace subscription, disposed on close.
- Full CAD 392 tests and CAD build/typecheck passed (existing size warning). Mounted tests verify inch/radian labels, precision, label activation with pending calculations, live unit changes without replacing inputs, unchanged native dimension values and cleanup. Core unchanged (546-test/check baseline). Browser list empty; live/full parity remains outstanding.

## Document units in constraint fields — 2026-09-09

- Creation and saved dimension fields now display document length/angle units and convert numeric calculations to solver millimeters/degrees. Saved reference measurements use the same display conversion. Updated instructions identify the displayed unit rather than assuming mm/degrees.
- Focused `sketch/dimension-input.ts` owns presentation conversion, labels and subscriptions. Valid pending calculations preserve their physical value through unit changes; invalid unfinished input clears. Bindings are disposed on saved-list replacement and panel closure; document geometry is unchanged by presentation conversion.
- Full CAD 390 tests and CAD build/typecheck passed (existing size warning), followed by instruction-copy corrections. Mounted tests verify inch fractions/radian angles, unit-switch conversion of pending calculations, canonical native persistence and listener disposal. Core unchanged (546-test/check baseline). Browser list empty; live/full sketch parity remains open.

## Calculations in constraint creation and editing — 2026-09-09

- Numeric driving constraints now accept the shared arithmetic syntax when created and when edited in the saved-constraint list. Input fields accept calculation text; parsing completes before any solver mutation is committed. Reference dimensions remain read-only measurements, and geometric constraints do not parse irrelevant numeric text.
- Existing panel units remain millimeters/degrees; display-unit-aware panel presentation, named variables, explicit unit suffixes and persisted expression dependencies remain open. Immediate curve sizing already converts its selected display units.
- Full CAD 388 tests and CAD build/typecheck passed (existing size warning). New mounted tests exercise length/radius/angle creation, invalid create/edit atomicity, undo/redo and native persistence. Core unchanged; prior 546-test/check baseline retained. Browser list empty; live and full parity acceptance still outstanding.

## Calculator input for immediate curve dimensions — 2026-09-09

- Core `quantity-expression.ts` parses decimal/scientific numbers, pi/π, parentheses, unary signs, arithmetic and right-associative powers without executing code. Bounded length/nesting and finite-result checks reject malformed/unsupported input. `parseQuantity` evaluates arithmetic before applying the selected unit factor.
- Immediate radius and ellipse-diameter fields share this parser, including conversion of pending valid calculations when display units change. Combined ellipse sizing remains atomic on invalid input. Persisted dimensions store the calculated numeric value; named variables, explicit unit suffixes, expression dependencies and other sketch input paths remain unfinished.
- Full Core 546 / CAD 385 tests, Core check and CAD build passed (existing size warning). Tests cover precedence, malformed/non-finite input, units, inch fractions, invalid-entry recovery, undo/native radius persistence and atomic ellipse sizing. Geometry assertions use solver-appropriate numeric tolerance. Browser list remains empty; live/full parity acceptance is outstanding.

## Three-point arc semicircle inference — 2026-09-09

- Three-point arc curvature placement snaps to the endpoint-diameter circle within screen-scaled tolerance, on either side and at arbitrary angular positions. Degenerate endpoints/center placements do not produce a snap. Geometry snapping controls inference; exact numeric half-circles also receive the relation when enabled.
- Core `semicircle-snap.ts` owns geometric snapping; `operations/semicircle.ts` adds a linked center and construction chord with a single center-on-chord constraint. This preserves the 180-degree sweep through radius edits without the redundant equation from a full midpoint relation. CAD placement integration stays in `sketch/drawing-tool.ts`.
- Profile counts now exclude construction geometry. Regression expectations account for persistent center/chord geometry through trim, offset, center snaps and undo. Core tests cover direction, rotation, tolerance, degeneracy, source immutability, radius edits and under-constrained diagnostics. Mounted pointer tests cover snapping on/off, undo/redo and native persistence.
- Full Core 517 / CAD 383 tests, Core typecheck and CAD build passed (existing chunk-size warning). Browser discovery returned no sessions; live visual and full sketch parity acceptance remain open. Reference: [Onshape 3 Point Arc](https://cad.onshape.com/help/Content/Sketch/3_point_arc.htm).

## Stable arc-center constraints — 2026-09-09

- Arc-center exposure resolves stable edge IDs before reading geometry and retains the ID in its concentric constraint. Inserting an earlier edge no longer redirects center selection; missing IDs reject atomically. Repeated selection reuses the center.
- Sketch center controls match stable identities and verify the center before committing. Both retained and fresh numeric selections resolve to the same construction point.
- Core regressions verify center identity through insertion, fixed-center radius edits and JSON roundtrip, source immutability and stale-reference rejection. Mounted UI verifies selection and reuse. Full Core 509 / CAD 381 tests and Core check passed; targeted UI regression and CAD build rerun passed after final selection guard (existing size warning). Browser list empty; live verification and full sketch parity remain outstanding.

## Temporary ellipse guide quadrant snapping — 2026-09-09

- Elliptical-arc construction guides snap start/end placement to their four local-axis endpoints within screen-scaled tolerance. Fixed, inferred and remembered radii are supported, including rotated frames. Preview displays the quadrant snap label. Known construction center is used directly to avoid reconstruction drift between preview and committed coordinates.
- Geometry snapping controls both guide snapping and new-arc endpoint quadrant inference. Canonical saved quadrant constraints keep those endpoints attached as diameters change; inference is idempotent and no temporary guide is persisted.
- Full Core 507 / CAD 380 tests, Core typecheck and CAD build passed after the center correction (existing size warning). Tests include snap tolerance, rotation, retained diameter relations and mounted enabled/disabled snapping with native save. Live browser/full parity acceptance remains outstanding.

## Pointer-sized elliptical axis starts — 2026-09-09

- Elliptical arcs remember the most recent valid temporary-ellipse width within the current gesture. Moving to a primary-axis start reuses that width; ordinary off-axis sizing stays dynamic. Explicit secondary radius takes precedence. The fallback resets for a new gesture/tool and does not become an unintended driving dimension.
- Core tests cover fallback versus dynamic sizing/explicit override. Mounted pointer test verifies guide continuity, axis-start preview/commit, native reopen and no width leakage into a new gesture.
- Full Core 505 / CAD 378 tests, Core typecheck and CAD build passed (existing size warning). Browser availability rechecked: no browsers. Temporary-guide quadrant snapping and broader/live parity remain open.

## Elliptical arc primary-axis starts — 2026-09-09

- Optional Secondary radius (mm) allows an elliptical arc to start at either primary-axis endpoint. Blank preserves third-point radius inference. With a supplied radius, start/end inputs define directions on the exact ellipse; preview and commit share the option. The entered radius persists as an ordinary secondary diameter driver.
- Focused Core tests verify both primary-axis ends, exact radius and invalid numeric values. Mounted editor test verifies axis-start placement, radius changes in preview, undo/redo, saved driving value, native reopen and tool-specific visibility.
- Full Core 504 / CAD 377 tests, Core typecheck and CAD build passed (existing size warning). Pointer-only remembered-radius placement, temporary-guide quadrant inference and live/full parity remain open.

## Elliptical arc solid evaluation — 2026-09-09

- Added actual OCCT acceptance for an elliptical arc closed by a chord, with endpoint quadrant constraints, before and after both diameter edits. Each case passes through native serialization/reopening before extrusion.
- Two kernel tests passed: exactly one body, expected depth and triangulated volume within 3% of the analytic elliptical-segment volume (display meshing tolerance is 0.08 mm). Supporting construction ellipse/axes do not add material. Core typecheck passed.
- Test-only slice; previous full baseline Core 501 / CAD 376 and check/build retained. Full parity and live browser acceptance remain open.

## Immediate ellipse diameter entry — 2026-09-09

- Newly drawn ellipses and elliptical arcs offer inline primary/secondary diameter fields in document length units. Enter commits primary and focuses secondary; Enter again commits secondary and returns to the canvas. The combined button computes both on a candidate before committing. Blank/invalid input reports an error without changing the sketch.
- `recent-ellipse.ts` owns the UI; `recent-curve-sizing.ts` composes lifecycle with existing radius entry. Core `set-ellipse-diameter.ts` owns driver creation/reuse through ordinary construction-axis length constraints. Values remain native editable dimensions.
- Full Core 501 / CAD 376 tests, Core typecheck and CAD build passed (existing size warning). Tests cover whole/partial ellipses, repeated Core edits without duplicate drivers, keyboard focus progression, invalid combined input, undo/redo and native reopen. Live browser, expressions and remaining parity gaps stay open.

## Partial elliptical-arc diameter controls — 2026-09-09

- Existing ellipse X/Y axis controls now work when a partial arc lacks the required finite quadrant endpoints. A dedicated candidate-only `ellipse-support.ts` adds a visible construction ellipse linked by canonical conic relations; ordinary axis quadrant/length constraints resize the source. Existing linked arcs remain preferred. Missing/invalid references still propagate; only missing finite endpoints trigger support creation.
- Repeated axis selection reuses support and dimensions. Core tests verify sequential primary/secondary edits, source immutability and residuals; mounted editor tests cover authoring, both axis dimensions, undo/redo, native reopen and reuse.
- Full Core 499 / CAD 374 tests, Core typecheck and CAD build passed (existing size warning). Immediate post-placement dimension entry, axis-start placement, temporary-guide inference and live/browser/full parity remain open.

## Elliptical arc authoring variant — 2026-09-09

- Added Elliptical arc to the Arc dropdown with a distinct theme-aware vector icon. Four clicks define center, primary radius, secondary radius/start, then end direction. Core `elliptical-arc.ts` owns exact native conic construction; preview shares it and shows a temporary dashed ellipse. Both sweep directions are selectable, and a linked selectable center persists.
- Core tests cover radius/center geometry, rotated frames, both sweep branches and invalid construction. Mounted editor coverage verifies temporary guide, direction-switch preview, exact commit, undo/redo and native reopen. Registry includes the new command.
- Verification: full Core 498 / CAD 373 / shared UI 149 tests passed. Core/UI typechecks and CAD/UI builds passed (existing CAD size warning). Initial CAD registry count and guide return-type issues were corrected; affected CAD suite/build and Core check reran successfully.
- Remaining for this variant: primary-axis start placement with an independently known secondary radius, temporary-guide quadrant inference, immediate primary/secondary diameter entry, modeling and live-browser acceptance. Overall parity remains open.

## Center arc direction control — 2026-09-09

- Center-point arcs now offer Clockwise/Counterclockwise selection while drawing. Switching refreshes the pending preview immediately; preview and placement use the same Core geometry option. The control is scoped to Center arc, with its own UI module. Saved geometry encodes direction without new document metadata.
- Core tests verify selected signed sweeps, constant radius/end direction and coincident-endpoint rejection. Mounted editor coverage verifies toggled pointer preview, identical commit, undo/redo, native reopen and control visibility.
- Full Core 495 / CAD 372 tests passed; Core typecheck and CAD build passed (existing size warning). Broader direction inference, elliptical arc variants, live browser acceptance and full sketch parity remain open.

## Arc Split editor acceptance — 2026-09-09

- Added a mounted real-editor workflow for a midpoint-constrained arc: Split, native save/reopen, edit the existing saved radius from 5 to 7, undo/redo, second save/reopen. The rendered geometry changes and reopens consistently; the midpoint relation and construction arc persist with one radius driver.
- Targeted DOM test passed. No production changes; prior full baseline remains Core 493 / CAD 370 with check/build passing. This verifies editor wiring, not live browser interaction; browser/full parity acceptance remains open.

## Split with retained arc midpoint — 2026-09-09

- Arc Split retains the midpoint of the original angular span through a visible construction arc linked to the outer endpoints and supporting circle. Dedicated `split-arc-span.ts` owns arc remapping; `split-span-links.ts` shares endpoint linking with line spans. Construction geometry remains excluded from solid boundaries.
- Tests cover both arc directions, radius edits, repeated Split, native drawing validation, immutable inputs and midpoint preservation together with a fixed endpoint. Corrected an old rejection fixture that used reversed midpoint operands; it now tests the supported relationship.
- Core 493 / CAD 370 full tests passed, Core typecheck and CAD build passed (existing size warning). Core was rerun after the test-fixture correction. Browser availability was rechecked and returned no browsers; live acceptance, arc-specific mounted workflow and broader topology/full parity remain outstanding.

## Split with retained line midpoint and equal length — 2026-09-09

- Line Split now retains midpoint/equal-length relations against an endpoint-linked construction span representing the original full line. `operations/split-line-span.ts` owns this remapping; supporting-line and overall-length handling stay in their existing modules. The construction span is visible reference geometry and does not contribute a solid boundary.
- Tests verify source immutability, identified source references, native drawing validation, overall-length edits moving the retained midpoint, equal-length residuals and repeated Split. A mounted editor test verifies Split, undo/redo and native save/reopen.
- Full Core 491 / CAD 369 tests, Core typecheck and CAD build passed (existing size warning). The subsequently added mounted Split-span test passed separately. Arc midpoint and broader finite-extent/control remapping, full sketch parity and live browser acceptance remain open.

## Imported face extrusion acceptance — 2026-09-09

- Added kernel-level acceptance for SOLID quadrilaterals, repeated-corner triangles, concave profiles and negative-Z TRACE. Each goes through ASCII import, unit scaling, native save/reopen and real OCCT extrusion.
- Four tests passed, verifying expected solid volume, depth and closed mesh edges. Core typecheck passed. No production changes in this slice; prior full baseline remains Core 486 / CAD 368, plus the subsequently added mounted face-import test. Live browser and full sketch parity acceptance remain outstanding.

## DXF SOLID / TRACE sketch boundaries — 2026-09-09

- Planar SOLID and TRACE entities import as editable closed line boundaries through dedicated `import/dxf/filled-face.ts`. DXF strip corner ordering and repeated-corner triangles are handled; scale, negative-Z OCS and source-layer provenance use the existing pipeline. Simple concave boundaries are supported. Crossing/zero-area boundaries and nonzero corner Z/thickness reject atomically.
- Verification: full Core 486 / CAD 368 tests passed, Core typecheck and CAD build passed (existing size warning). A subsequently added mounted editor test passed separately: preview, insert, undo/redo, native save/reopen. This is not live browser or full parity acceptance.

## Fresh mirror, offset and slot source identities — 2026-09-09

- Mirror sources/axes, offsets and slots now assign missing authored edge IDs on a candidate drawing before saving associative references. Earlier edge insertion no longer silently redirects these relationships; invalid operations leave the input untouched.
- Corrected slot boundary generation to avoid duplicating its centerline segment/vertex IDs onto newly generated boundary edges.
- Verification: Core 482 tests and CAD 368 tests passed; Core typecheck and CAD production build passed (existing bundle-size warning). Tests cover fresh and preidentified sources, insertion, persistence, immutable failure and mirror source/axis metadata. Live browser acceptance remains outstanding; full sketch parity remains open.

## Identity assignment for fresh pattern source edges — 2026-09-09

- Selected-edge pattern creation now assigns missing source edge IDs on its private candidate drawing before constructing relations. This makes stability available to ordinary freshly drawn edges, not only edges previously identified for projection. Existing IDs are preserved; projected geometry is not assigned locally invented IDs.
- Dedicated `operations/identify-source-edges.ts` owns selected-edge identification. Whole-contour and plain-point source contracts remain unchanged. Assignment is part of the pattern operation, so errors/cancellation leave the input drawing untouched.
- Core 480 / CAD 368 tests, Core typecheck and CAD build passed. The expanded fresh/preidentified source regression verifies earlier insertion, count edits and native persistence. Three targeted identity tests passed again after adding success/failure source-immutability assertions. Pattern repair/count tests now explicitly expect generated source IDs.
- Automatic ID assignment for other associative tool creation, general topology remapping and full sketch/live browser parity remain open.

## Stable modification source mouse selection — 2026-09-09

- The shared modification source picker now matches available stable edge IDs against the current picked segment instead of relying on an old option index. Legacy choices without IDs still use numeric positions.
- A mounted regression changes source segment order after creating the source list, then verifies click selection, exact source highlighting, click deselection and refusal to select a replacement edge with a different identity. Highlight geometry already used the corrected Core source projection.
- All 368 CAD tests and CAD typecheck/production build passed. Core production is unchanged from the prior477-test full baseline (two later handle tests also passed individually). Live browser/full parity acceptance remain open.

## Derived dimension handle verification — 2026-09-09

- Added focused offset/slot regressions that insert an earlier source edge, serialize the drawing, fix the source geometry, compute a new dimension from handle movement and edit the saved dimension. Both handles stay on the intended source midpoint; resulting constraints satisfy their residuals and input drawings remain unchanged.
- Both new tests passed. Production is unchanged from the prior Core477/CAD367/check/build baseline; this test-only work does not claim a new full-suite/build run.
- This verifies Core handle geometry and dimension-edit integration. Real pointer rendering/input, general topology remapping and full parity remain open.

## Stable offset and slot source references — 2026-09-09

- Selected-edge offsets now normalize/capture available source IDs instead of dropping them during relation creation. Shared offset relation construction captures available source/target IDs, including single-edge whole-contour offsets. Extracted offset edges retain source layer labels.
- Slot creation captures source IDs, and slot centerline evaluation resolves them before reading geometry. An earlier source-edge insertion therefore no longer redirects an existing slot to the wrong centerline. Legacy numeric references remain supported when no ID is present.
- Core 477 / CAD 367 tests, Core typecheck and CAD build passed. Two new regressions cover earlier insertion, drawing serialization, satisfied derived relations, repeated creation through stale indexes and atomic missing-ID rejection. The CAD suite includes the previously added mirror-menu regression.
- General topology remapping, spline/ellipse offsets/slots and live/full sketch parity acceptance remain open.

## Stable mirror-axis menu verification — 2026-09-09

- Added a mounted test of the actual saved mirror-axis editor. After an earlier edge is inserted, the menu selects the axis by stable identity, excludes the mirrored source and instance, allows a distinct same-contour edge, and preserves the intended axis through cancel/reopen/save and native document roundtrip.
- The new targeted test passed. Production is unchanged from the previous Core475/CAD366 full passing baseline; no new full-suite/build run is claimed for this test-only work.
- This is DOM/component integration evidence. Live browser verification and full sketch parity remain open.

## Stable mirror-axis validation and capture — 2026-09-09

- Mirror source/axis exclusion now resolves stable identities using the current drawing. The same edge is rejected despite stale numeric positions; a distinct edge in the same contour is allowed. Projected contour scope is distinguished, and missing stable IDs reject.
- Mirror creation and saved-axis edits capture available axis segment IDs. CAD source exclusion and saved-axis option filtering/preselection use the shared Core comparison, including mixed stable and legacy numeric references.
- Core 475 / CAD 366 tests, Core typecheck and CAD build passed after the final identity-capture change. New tests cover same-edge rejection, distinct-edge acceptance, saved-axis editing/capture, projected scope and missing IDs. Full source topology remapping and live/full sketch parity acceptance remain open.

## Stable selected-edge pattern sources — 2026-09-09

- Selected-edge patterns already existed; this pass fixed stale-index lookup in their shared source projection. `pattern-source.ts` resolves contour context and stable edge identity before extracting geometry. Source choices capture available segment IDs, and extracted edges retain imported layer labels.
- `pattern-source-key.ts` uses available stable segment/vertex identity and projected contour scope for membership/deduplication, retaining numeric indexes for legacy references. Missing IDs reject rather than silently selecting a replacement edge.
- Core 473 / CAD 366 tests, Core typecheck and CAD build passed. New coverage inserts an earlier source edge, resizes the pattern, verifies both instances still follow the intended edge/layer, and roundtrips native data. Broader source topology remapping, copied-edge joining and live/full parity acceptance remain open.

## Imported circle layer preservation through edits — 2026-09-09

- Circle-to-arc conversion in Split and Trim now preserves optional `sourceLayer`. Path splitting already retains contour metadata; cutter layers stay independent.
- New regressions import a DXF circle/cutter on separate layers, split the circle and a resulting arc, roundtrip a native document, and trim the circle while checking source immutability and layer labels.
- Core 471 / CAD 366 tests, Core typecheck and CAD build passed. Layer styling/editable membership, remaining import formats and full sketch parity/live browser verification remain open.

## Projected selection error presentation — 2026-09-09

- Selection status now asks Core to resolve a projected entity before labelling it read-only. Missing stable edges and missing source contours show an invalid-reference message. Restoring the source restores the read-only label and layer information; deselection clears the status.
- The dedicated status presenter contains no geometry validation logic: it displays Core's resolution result. A mounted DOM regression covers replacement edge identity, absent source, restoration and deselection.
- All 366 CAD tests and the CAD typecheck/production build passed. Core is unchanged from the previous 469-test passing baseline. Browser discovery still returns no sessions; live verification and full sketch parity remain open.

## Projected and identified curve diagnostics — 2026-09-09

- Core entity mobility analysis now resolves projected contour context and stable segment identity before reading arc/ellipse endpoints. Previously projected curves could invalidate the entire batched result, and a stale numeric index could supply endpoints from another edge.
- Projected-only selections are validated instead of returning early as an empty sketch. Valid projected geometry has zero local degrees of freedom; missing identities remain invalid. Whole sketches with no authored geometry still report empty. The UI's existing projected read-only label is unchanged.
- Core 469 / CAD 365 tests, Core typecheck and CAD build passed. Three new regressions cover projected arc/ellipse batches alongside free authored geometry, projected-only/missing-source cases, source immutability and stable authored arc selection. Live browser/full parity acceptance remain open.

## Linked ellipse mobility diagnostics — 2026-09-09

- Fixed a false over-constrained report for a split ellipse. Diagnostics now share the solver's stable common-conic coordinates for eligible linked ellipse paths. The regression verifies eight freedoms after Split, seven after one diameter, six after both, and three for a selected diameter's translation/orientation.
- Intrinsic conic relations are excluded from the numerical rank calculation; extra graph relations still count as redundant. Complete residuals remain active for satisfaction/conflict checks. `diagnostic-residuals.ts` excludes quadrant finite-span inequalities from mobility rank, so an endpoint bound does not falsely fix the endpoint.
- Core 466 / CAD 365 tests, Core typecheck and CAD build passed. Broader singular/inequality diagnostic cases, live browser acceptance and full sketch parity remain open.

## Sequential ellipse dimension solver and editor regression — 2026-09-09

- Mounted editor verification exposed failure when applying only the X diameter after Split. The prior engine test changed both dimensions together and did not establish this sequential workflow.
- `solver/ellipse-locus-coordinates.ts` now provides transient shared-conic and vertex-angle coordinates for connected all-ellipse paths. This avoids the singular endpoint/radius representation at half-ellipses. Fixed, unlinked, mixed-geometry or differently represented conics retain the general solver path. No saved format or second persisted geometry was added.
- The editor regression now authors an ellipse, splits it, applies X then Y diameter dimensions, exercises Undo/Redo, saves/reopens a native document and reuses the existing axis. Core tests also verify source immutability, shared radii, closure, residuals and conflicting-dimension rejection.
- Core 465 / CAD 365 tests, Core typecheck and CAD build passed. Browser verification remains outstanding; mounted DOM evidence does not prove real rendering/input. Broader solver singular cases and full sketch parity remain open.

## Ellipse dimensions after Split — 2026-09-09

- Diameter construction controls now follow explicit shared-ellipse relations to attach each endpoint to an arc containing its quadrant. Existing controls are reused after Split even when their endpoints reference different arcs. Isolated partial arcs with missing axis endpoints reject without changing the drawing.
- `operations/ellipse-axis-references.ts` owns linked-arc traversal and endpoint selection; `ellipse-axes.ts` owns construction control creation/reuse. Unrelated geometrically similar curves are not implicitly linked.
- Core 463 / CAD 364 tests, Core typecheck and CAD build passed. New tests resize both ellipse axes after drawing JSON roundtrip, check all split arcs and constraint residuals, verify control reuse/creation and atomic rejection. Existing bundle-size warning remains.
- Browser discovery still returns no sessions. Live browser acceptance and full sketch parity remain incomplete.

## Split ellipses with retained constraints — 2026-09-09

- Split now converts a full ellipse's shape relation into shared conic relations between the resulting arcs. Further splits preserve that shared geometry. Quadrant references move to a resulting arc that contains the required quadrant.
- Dedicated `split-ellipse-relations.ts` handles split reference conversion; `retained-ellipse-relations.ts` is shared with Trim. Geometry and constraints remain in Core.
- Core 461 / CAD 364 tests, Core typecheck and CAD production build passed. Regression coverage exercises repeated splits and checks all resulting constraint residuals; the CAD run also includes the previously added mounted ellipse Trim workflow.
- Live browser verification, general topology remapping and full sketch parity remain outstanding.

## Full-ellipse trim editor integration verification — 2026-09-09

- Added a focused mounted editor test that authors an ellipse and cutter lines, activates Trim and clicks the visible ellipse, then exercises Undo/Redo and native save/reopen. The resulting three arcs retain two shared-ellipse relations and the reopened outline matches the saved outline.
- The new test passed first through numeric placement and then through simulated pointer trimming. Production code is unchanged from the previous Core460/CAD363 full passing baseline; no new full-suite/build run is claimed for this test-only change.
- SVG screen coordinates are simulated. This proves editor command/persistence integration, not real browser input/rendering. Live trim acceptance and full sketch parity remain open.

## Trim full ellipses with retained shape — 2026-09-09

- Trimming a full constrained ellipse no longer rejects its whole-ellipse relation. The closed-half relation is replaced by `ellipse-locus` relations tying surviving arcs to a common supporting ellipse. Further trim fragments can retain the same supporting conic.
- The shared-ellipse residual compares centers and normalized conic shape matrices, so equivalent swapped axes do not conflict. The constraint is available in the existing panel/ribbon with an ellipse icon and explanatory hint.
- Core 460 / CAD 363 tests, Core typecheck and CAD build passed. New tests cover a three-arc trimmed result, satisfied shared relations, native persistence and equivalent axis representations. App checks caught and prompted the missing catalog icon/count integration, which was fixed before the passing rerun.
- Broader reference remapping, interactive solver singular cases, mounted/live full-ellipse trim acceptance and full parity remain open.

## Finite elliptical quadrant constraints — 2026-09-09

- Quadrant constraints now check visible-span membership for elliptical arcs as well as circular arcs. A point on the hidden supporting ellipse no longer counts as satisfied. Full constrained ellipses retain all four quadrants.
- Shared `quadrantSpan` supplies solver and manual-selection span data; ellipse snapping uses the existing angular-span helper rather than a separate clipping formula.
- Core 458 / CAD 363 tests, Core typecheck and CAD build passed. New tests cover local/external out-of-span relations, nearest visible quadrant choice and whole-ellipse preservation.
- General constraint/topology remapping, robust interactive solving across singular cases and live browser acceptance remain open. Full parity is not claimed.

## Circle and finite-arc quadrant snapping — 2026-09-09

- Ordinary sketches now expose circle quadrants and only the quadrants inside a circular arc's directed span. The shared projected snapping path also receives finite-arc quadrants. Inference retains quadrant constraints while avoiding duplicate point attachments.
- Manual quadrant creation accepts arcs and chooses the nearest visible quadrant; an arc with no axis quadrant reports that limitation. Solver equations include angular-span membership, so a point on the hidden supporting circle is not considered satisfied.
- Core 455 / CAD 363 tests, Core typecheck and CAD production build passed. Coverage includes both sweep directions, circle inference, duplicate prevention and out-of-span residuals. A draft-collinear-arc regression was found and fixed: invalid draft arc candidates are skipped while other snap targets remain usable.
- Broad singular-solver behavior, elliptical finite-span updates and live browser acceptance remain unfinished. Full parity remains open.

## Retained DXF source layers — 2026-09-09

- Imported contours retain optional `sourceLayer` provenance, including inherited block layers and the default layer `0`. Native save/reopen and affine placement preserve it. Projection carries the source layer into derived geometry.
- Endpoint joining now groups by source layer as well as construction/hole flags, preventing automatic cross-layer merging. Selected-entity status displays the source layer for authored and projected geometry using text content.
- Core 452 / CAD 363 tests, Core typecheck and CAD build passed; the updated mounted selection test also passed separately. Tests cover native persistence, layer-aware joining, invalid metadata and source-layer display after reopening. Updated the existing default-layer geometry assertion for the new metadata.
- This is provenance, not editable layer membership or visibility/style control. Layer style properties, general topology-operation propagation and live browser verification remain open.

## DXF block editor integration verification — 2026-09-09

- Added a mounted sketch-editor workflow for DXF block layer discovery/filtering, nonuniform circle-to-ellipse preview, numeric placement, Undo/Redo, native save/reopen and edit reopening. It verifies the placed ellipse coordinates and radii after persistence.
- The new integration test passed. Production code is unchanged from the previous Core450/CAD362 passing baseline; no new full-suite or build run is claimed for this test/documentation-only change.
- Corrected the primary DXF README and parity table to include embedded planar BLOCK/INSERT support, while retaining explicit attribute/xref/tilted geometry gaps.
- This uses a simulated DOM/file input, not a live browser. Browser import acceptance and full sketch parity remain open.

## Affine conic scale robustness — 2026-09-09

- General import mappings no longer apply the absolute near-edge-on tolerance used for sketch-plane projection. A small nonzero block determinant preserves conic geometry; the frame-projection entry point retains its explicit collapse tolerance.
- Conic axes are computed from a normalized shape matrix. Minor radius uses the map determinant and original radii, avoiding subtraction of nearly equal transformed products. Removed the determinant-only rejection of usable thin conics; geometric resolution limits remain explicit.
- Core 450 / CAD 362 tests, Core typecheck and CAD production build passed. New coverage includes a DXF circle scaled by 1e-8 from radius 1e8 to radius 1, a usable near-singular conic and large finite conic radii.
- Extreme underflow/resolution limits, nearly singular frame-collapse policy, other import gaps and live browser acceptance remain open. Full parity is not claimed.

## DXF block INSERT expansion — 2026-09-09

- ASCII DXF imports now expand nested embedded planar blocks using base points, insertion points, rotation, independent X/Y scales, planar reflection, and row/column arrays. Effective layer inheritance is exposed by the layer inventory; geometry decoding remains deferred until selected layers are filtered.
- Exact affine mapping is shared with the projection geometry implementation. Nonuniformly scaled circles become native ellipses. Expanded geometry is ordinary editable sketch geometry, not retained block instances.
- Core 447 / CAD 362 tests, Core typecheck and CAD production build passed. Tests cover nesting/base points, rotation/scaling, ellipses, arrays, reflection/units, layers, missing/cyclic definitions and invalid array counts. The first pass caught and fixed eager legacy-polyline decoding before layer filtering.
- Attributes, external references, tilted/elevated geometry, live import verification and remaining DXF/DWG/image coverage remain unfinished. Expansion has depth/record limits.
- Format basis: [Autodesk INSERT](https://help.autodesk.com/cloudhelp/2018/ENU/AutoCAD-DXF/files/GUID-28FA4CFB-9D5E-4880-9F11-36C97578252F.htm) and [BLOCK](https://help.autodesk.com/cloudhelp/2024/ENU/AutoCAD-DXF/files/GUID-66D32572-005A-4E23-8B8B-8726E8C14302.htm).

## Projected snapping editor integration verification — 2026-09-09

- Added a focused mounted workspace test file for actual pointer event dispatch, Undo/Redo, native save/reopen and source edits. Projected-edge placement retains its stable sliding contact and does not persist runtime projection context or modify source geometry.
- A second flow places a point at a projected circle quadrant, saves/reopens, and verifies visible authored geometry follows source center/radius changes. Cancel leaves the save count unchanged.
- All 362 CAD tests and the TypeScript/production build passed. Core implementation is unchanged from its prior 443-test passing baseline.
- Browser discovery returned no sessions. These tests simulate the SVG coordinate transform and do not prove live rendering, real pointer behavior or full browser acceptance. Full parity remains open.

## Continuous projected curve snapping — 2026-09-09

- Pointer placement can snap along identified projected path segments and circles after discrete endpoint/center/midpoint/quadrant candidates. Finite segment picking uses native curve evaluation; no tessellated geometry is saved.
- Inference persists external coincidence. Finite paths carry a stable segment reference and a sliding contact parameter; circles retain radial coincidence. This allows later dimensions to move the contact along its source curve.
- Core 443 / CAD 360 tests, Core typecheck and CAD build passed. Tests cover source edits with a later fixed-point constraint driving the sliding parameter, cubic/circle picking, finite-span rejection, and UI snap priority.
- Browser pointer acceptance, large-sketch snapping performance, broader topology lineage and remaining parity requirements remain open.

## Projected quadrant snapping — 2026-09-09

- Projected circles and ellipse spans expose quadrant snap candidates. Pointer placement records a persistent `quadrant` relation with the external contour/edge identity. Existing endpoint/center attachment precedence remains intact.
- Quadrant constraints now accept circles as well as ellipses in Core and the constraint panel. Circles use sketch axes; ellipses use local axes through a shared quadrant frame helper. Circular arcs are excluded from this extension.
- Core 441 / CAD 359 tests, Core typecheck and CAD build passed. Tests cover source circle center/radius edits driving a snapped point, ellipse quadrant coverage with stable segment references, and UI snapping before grid rounding.
- Continuous curve snapping, broader finite-span update validation, topology lineage and live browser acceptance remain open. Full parity is not claimed.

## Selected projection subentity identities — 2026-09-09

- Single-contour projection now assigns missing edge and vertex identities even when the contour already has an ID. Whole-sketch and selected-contour assignment share `document/identify-sketch-contour.ts`.
- A contour in a projected sketch can now be selected: assignment visits its upstream authored geometry atomically, while the reference retains the selected derived feature. The selector no longer disables unidentified derived contours.
- Core 439 / CAD 358 tests, Core typecheck and CAD build passed. Coverage includes native save/reopen, upstream chain assignment, identity reuse, and UI candidate immutability. No live browser acceptance claimed.
- Multi-contour topology lineage, external whole-edge remapping and the wider parity ledger remain open.

## Trim identity preservation — 2026-09-09

- Trim now assigns endpoint and edge identities from retained source intervals. Surviving endpoints/whole edges keep IDs; newly cut endpoints and partial edges get fresh IDs. A moved path start cannot inherit the removed start vertex identity.
- Local constraints resolve stable IDs before index remapping and capture retained identities afterward. Regression coverage includes a stale-index fixed endpoint, external surviving/deleted endpoint references, and a closed path whose start changes.
- Core 437 / CAD 357 tests, Core typecheck and CAD production build passed. The initial new fixed-point test omitted its required coordinate; the corrected fixture and full rerun passed.
- Trims that produce multiple contours still require external contour relinking. Cross-contour lineage, external whole-edge remapping and live browser acceptance remain unfinished.

## Split identity preservation — 2026-09-09

- Split retains original endpoint identities, creates identities for the new join/edges when the source is identified, and remaps local identified curve/control references onto the correct child. References are resolved before index remapping, so stored indices may be stale without redirecting constraints.
- External endpoint constraints remain attached after a source split. External references to the replaced whole edge fail explicitly and still need relinking; automatic external contact remapping remains unfinished.
- Ellipse subdivision no longer copies the original edge/endpoint identity to both pieces. Identity assignment belongs to the editing operation.
- Core 435 / CAD 357 tests, Core typecheck and CAD production build passed. Added projected-endpoint and identified cubic-contact regressions. Live browser verification remains outstanding.

## Stable projected endpoint references — 2026-09-09

- Authored paths now support start/end vertex identities. Whole-source projection assigns missing IDs atomically; one-to-one projection retains them. Closed paths share their start identity at the closing endpoint.
- Projected endpoint selection and snapping capture vertex IDs. Constraint resolution follows those IDs after earlier geometry is inserted, and missing/ambiguous references fail explicitly instead of falling back to stale indices. Legacy references remain supported.
- Core suite: 432 passed; added save/reopen identity test passed in the 3-test identity suite. CAD 357 passed, plus the updated picker test suite; Core typecheck and CAD production build passed. No live browser acceptance claimed.
- Split/trim topology remapping, collapsed projection identity mapping and full parity acceptance remain open.

## Stable projected edge references — 2026-09-09

- Projected edge selections, arc-center snaps and midpoint snaps now capture optional segment identities. One-to-one projection preserves those identities, and constraints resolve them instead of stale segment indices. Missing or ambiguous identified edges fail explicitly.
- Whole-sketch identity assignment includes authored path segments. New validation rejects duplicate or invalid segment IDs within a path. Legacy index-only references remain compatible.
- Core 430 / CAD 357 tests, Core typecheck and CAD production build passed. Regression coverage includes insertion before a constrained edge, deleted/replaced identities, projection preservation, duplicate validation and canvas selection identity capture.
- Vertex identities, topology-changing split/trim remapping, collapsed-projection mapping and live browser acceptance remain incomplete. Browser discovery returned no sessions.

| Family | Current Aether behavior | Remaining acceptance work |
|---|---|---|
| Line / midpoint line | Chained lines and symmetric two-click placement; selectable persistent midpoint; constrained center/endpoint dragging, dimensions, preview and native persistence | Broader automatic inference and live browser acceptance |
| Corner / center / aligned rectangles | Exact closed paths, previews, save/reopen, extrusion; persistent axis/parallel/perpendicular relations preserve shape during dragging; selectable center with construction diagonal and midpoint relation | Live browser workflow and broader constraint inference |
| Center / three-point circles | Exact circles, preview, dimensions, constraints; three-point construction points persist with coincidence relations and constrained dragging | Live browser acceptance and broader automatic inference |
| Ellipse | Exact elliptical segments, three-click placement, preview, extrusion; persistent selectable center, center snapping/inference, concentric constraints and construction axes with standard diameter-length/orientation constraints | Direct ellipse-specific radius annotations, broader manipulators and live browser acceptance |
| Three-point / center / tangent / elliptical arcs | Endpoint-first three-point arc with fixed-chord curvature preview and persistent semicircle inference; center arc with selectable persistent center, clockwise/counterclockwise preview and constrained endpoint/radius edits; endpoint tangent arc with live preview, persistent tangency and open-path continuation; four-click elliptical arcs with temporary full-ellipse guide/quadrant inference, CW/CCW preview, linked center and immediate diameters | Persisted radius expressions/named variables and explicit unit suffixes; tangent-arc automatic switching and branch joining; broader automatic direction inference |
| Polygons | Inscribed/circumscribed, 3–100 sides, exact geometry; persistent regularity, editable sizing circles and inline side-count editing preserving sizing references | More automatic changed-edge/vertex attachment remapping, large-drag robustness and live browser acceptance |
| Spline / Bézier / control-point insertion | Cubic Bézier with selectable editable controls; variable-point natural/open and periodic/closed cubic interpolation with persistent shape-linked refitting, shape-preserving point insertion with retained parameter spacing, preview, explicit finish, undo and native persistence | Endpoint tangent controls, arbitrary degree, knot/control insertion/remapping, scalable solving and browser acceptance |
| Point / text / construction | Point placement and construction conversion/drawing mode persist; construction excluded from solids; Core font outline conversion with counters, exact Beziers, em sizing and placement plus workspace font selection, cached preview, snapped canvas baseline placement, undoable outline insertion, native reopening and verified new/cut solids with counters | Retained text/font Core contract and panel create/reopen/edit/detach plus persistent local-axis flips and a dedicated illustrated ribbon Text command implemented; bundled regular/bold/italic/bold-italic fonts and HarfBuzz shaping added; grouped text similarity solving/DOF and selectable construction frames with independent width/proportional height and constraint-preserving rewording added; snapped drag/two-corner text-frame creation with live preview added; ordinary retained-group dragging and constraint-driven corner resizing added; dedicated width/height/corner resize handles added; multiline layout and textarea editing added; frame-center flips and removable default horizontal baseline inference added; explicit ascender-height sizing added with legacy em compatibility; typed expression evaluation/native variables and retained text formula binding with atomic drawing regeneration added; document-wide updates and cache validation added; text-expression editor added; variable-definition editor and draft-variable undo/finish/cancel integration added; native variable-to-dimension bindings and regeneration added; saved dimensional formula editor added; initial constraint formula entry added; constraint-preserving Transform copies added; editable text Transform copies added; Core clipboard fragments and browser clipboard placement/atomic undo added; reflected frame placement/regeneration added; live clipboard acceptance and broader tool propagation, mixed-script layout, richer point/property editing and live acceptance remain |
| Use / intersection | Face-frame placement; tested Core plane-to-plane projection geometry for lines/Béziers/conics and persisted whole-profile links with rebuild propagation and viewport creation/relinking; edge-on conics produce analytic line loci | Stable subentity references, edge/vertex selection, mixed projected/authored sketches, invalid-file recovery and browser acceptance; nearly singular nonzero conic handling |
| Fillet / chamfer / trim / extend / split | Exact line/arc/ellipse/Bezier trim (circle radius/center, surviving path entities, partial line/arc locus relations and finite fixed/sliding contacts retained) and line/arc/ellipse extend against curved boundaries; exact path-segment and two-point circle split and arc supporting-circle and line direction/overall-length relation preservation with preview/undo and drag Trim; free-end line/arc/ellipse extension retains satisfied constraints; connected-line corner/two-line fillet batches with virtual sharps, one shared radius, preview and extrusion; independent finite curve-pair and connected curved-corner fillets with radius and endpoint tangent constraints; picked straight-corner chamfer with equal/two-distance and distance-angle creation, preview, persistent dimensions and extrusion | Cubic extend targets, Remaining finite-extent/control constraint remapping, degenerate/retracing cubic overlap handling, separate multi-segment contour fillets; chamfer edge-pair batches, manipulators |
| Offset / slot / mirror / patterns / transform | Associative line/circular-arc and chain offsets; line/arc, open/closed-chain and circular-centerline slots with shared width; offset/slot dimension handles; associative fixed/live-axis mirrors and selected-edge/contour linear/circular instances with per-contour and whole-placement suppression; numeric uniform transforms; selection, preview, undo, persistence | Offset topology remapping and spline/ellipse offsets; slot corner-topology remapping and spline/ellipse slots; copied-edge joining; remaining manipulators and richer constraint-preserving transforms |
| DXF / DWG / image insertion | ASCII DXF embedded planar blocks/nested INSERT arrays with transforms and layer inheritance; XY lines/points/circles/arcs/ellipses and SOLID/TRACE boundaries, polynomial degree 1–3 spline spans and bulged lightweight/legacy polylines; planar negative-Z object-coordinate handling; unit conversion, numeric/canvas placement preview, endpoint joining, disjoint nested-hole classification, undo and native persistence | Remaining DXF entities/tilted OCS/elevation and layer style properties and editable layer management, interior intersections, persistent import attachment constraints, DWG/image insertion and browser acceptance |
| Dimensions / constraints | Circle/arc radius, equal radius, concentricity and tangency; arc midpoint; point-on-line/circle/ellipse and retained ellipse quadrants with snapping/placement inference, point-pair alignment; existing line dimensions; fixed-parameter line/arc/ellipse/Bezier tangent and curvature contacts; line/circle and finite-contact Normal; point/line/circular/elliptical-segment locus symmetry with a live axis; full-ellipse shared shape relations | Alternate-gesture inference, sliding-contact singular cases, full-ellipse parameter controls and topology remapping, spline topology/correspondence editing and external axes, curve-to-plane Normal, pierce, live verification of per-entity DOF colors and singular-case robustness |

## Definition of working

Every tool needs an accessible ribbon command (variants grouped in a dropdown), instructions, live pointer preview, numeric input where appropriate, degeneracy handling, selection/editing, undo/redo, serialization/reopening, and actual evaluator results. A button or an SVG approximation is insufficient. Entity operations must preserve or explicitly remap constraints. Projection must update from source changes and report broken references. Automated geometry assertions and mounted interaction tests are required, followed by an actual browser walkthrough.

## Current implementation architecture

- Core `sketch/primitives.ts` constructs exact contours shared by preview and commit.
- Persisted drawings now include line, circular arc, elliptical arc, and cubic Bézier segments plus circles. This extends the existing profile payload; old profiles remain readable. Old clients may reject newer segment kinds, so suites should update together.
- The evaluator feeds these curves to OCCT through Replicad, with explicit closed-region/hole handling. Arbitrary overlapping/intersecting sketch region selection remains unimplemented.
- The constraint solver handles bounded point/line/circle/circular-arc equations; Bézier controls participate as points. Arc equations use the analytic circle locus, without finite contact-parameter bounds. General curve tangency/curvature and under/fully/overconstrained diagnostics remain absent.
- Rectangle tools now retain canonical constraints. Polygons now retain regularity and sizing-circle relations. Midpoint lines now retain their selectable centers. Three-point circles retain their construction points. Center arcs retain their selectable centers. Ellipse placement handles still need work.
- Split buttons remember the selected variant during the mounted ribbon session. Unavailable spline production remains disabled.

## Verification at this checkpoint

Core geometry tests cover primitive degeneracy, exact contours, serialization/reopen followed by OCCT extrusion. CAD DOM tests cover live previews, all nine additions, control edits, failure atomicity, save/reopen, and selecting/reusing a dropdown variant. Browser runtime currently reports no connected browser; actual Safari/WebGPU interaction and visual validation remain outstanding.

## Contributor structure and current work order

The current focus remains **full sketch parity**. The limited implementations
above are checkpoints, not permission to move to another product section.

See `Aether CAD/src/sketch/README.md` for the UI/module map and
`core/engine/src/sketch/operations/README.md` plus `solver/README.md` for Core
ownership. New algorithms go in focused family files; session wiring stays in
the workspace controller. Keep one canonical drawing and one undo commit path.

Next acceptance packets:

1. Complete curve editing/intersections and constraint remapping for trim,
   extend, split, fillet, chamfer, offset and slots.
2. Finish drawing variants and editable spline/conic/text tools, then associative
   mirror/pattern relations and interactive transforms.
3. Implement persistent associative Use/intersection projections and file/image
   imports with explicit units and source-reference lifecycle.
4. Complete solver coverage, dimensional editing, inference, DOF diagnostics,
   dragging and conflicting-constraint explanations.
5. Walk the complete wheel construction, saved revisions and reopening in a
   connected real browser. Close each ledger row only with its acceptance tests.

### Exact curve subdivision checkpoint — 2026-09-09

`core/engine/src/sketch/curves/` now owns exact parameterization, degree-preserving
subdivision, closest-point picking, and line/curve intersections. Cubic polynomial
roots include tangencies; arc/ellipse intersections respect finite extents. The
Split tool preserves exact path segment types and remaps surviving endpoint
constraints. Constraints attached to the split segment itself still reject
rather than silently changing their meaning. Circle splitting still needs the
two-point workflow. Tests cover shape invariance, reflected/rotated ellipses,
finite-arc filtering, tangent roots and native UI save/reopen.

### Two-stage edit gestures — 2026-09-09

Circle splitting now accepts two clicked locations and preserves circular
radius/concentricity relations across the two resulting arcs. Existing center
point constraints are explicitly remapped to a construction center with a
concentric relation. Line Extend accepts a second-click projected endpoint when
no boundary is available. Preview and commit use one dedicated
`direct-modification.ts` interaction function. Curved Extend and general curved
Trim targets are still open; the broader row remains incomplete.

## Curved fillet groundwork

Core now has exact curve jets, bounded normal-offset tangent-circle searches,
and exact trimmed line/arc/ellipse/Bezier pieces joined by a tangent circle.
Tests cover line/arc, line/Bezier and arc/arc tangency and a line/Bezier bridge.
Independent single-segment curve pairs are now wired into the Fillet tool: pick
two retained sides, preview, Apply, undo/redo and native persistence. Exact outer
endpoint and circular-locus references remap; unsupported references reject
atomically. Connected adjacent curves now retain surrounding path segments and
closed seams; two-edge loop picks distinguish the two corners. Separate
multi-segment contour joining remains open.
Numerical candidate coverage also needs singular/degenerate stress cases.

Finite tangent contacts now persist as `kind: "curve"` references with segment
index and parameter in [0,1]. Start/end selectors expose them in the app. Curved
fillets use this contract at both joins. Generic constraint radius editing solves
the joins, but can deform underconstrained source curves. Preserving original
curve design intent during radius changes, curved virtual sharps and live browser verification remain unfinished. Older clients
without this reference kind may reject the new saved constraints.

Curved and straight corners can now share one driving fillet radius in a batch.
Endpoint tangent references remap into retained curve intervals when both ends
of a curved edge are rounded. Reopened curved arcs expose the shared radius
and a center-based radius handle. This does not resolve original-curve design
intent during dimensional edits or live-browser acceptance.

## Sketch chamfer

[Official reference](https://cad.onshape.com/help/Content/Sketch/sketch_chamfer.htm)
requires vertex/two-edge selection, multiple linked chamfers, dimensional editing,
invalid-size feedback and a manipulator. Current app supports picked straight
vertices or two lines (connected or separate single-line contours), equal-distance/two-distance/distance-angle creation, preview, atomic
Apply, undo, native persistence and solid extrusion. Virtual sharp references
preserve original-corner dimensions. Equal-distance setbacks now share one saved dimension driver. Editing either
entry in the constraint list edits that driver; removal preserves surviving
dimensions at their last value.
Separate multi-segment joins, edge-pair batches, dedicated reopened chamfer controls
and a drag handle remain acceptance work.

Linked dimensions persist `valueFrom` (a constraint ID) instead of a duplicate
`value`. Length/radius/distance drivers share millimeters; angle drivers require
degrees. Cycles, missing drivers, incompatible units and conflicting literal
values reject. Older clients without this contract cannot solve these drawings.

Two-line chamfers retain picked sides at virtual intersections. Their first
distance/angle follows the first selected line even when path order is reversed.
Fillet and chamfer share `line-corner-selection.ts` for topology/reference mapping.

Chamfer vertex batches now share one driver per distance/angle parameter.
Opposite-turn angular followers use `valueSign: -1` with `valueFrom`; editing a
follower adjusts the driver with the inverse sign. Removing a driver preserves
the signed resolved value. Signed links require an updated client; clients that
ignore `valueSign` cannot interpret them correctly. Edge-pair batch selection
and dedicated chamfer handles remain outstanding.

## Selection, constraint state and variant artwork

Clicking an active drawing tool again or Escape returns to Select. Sketch
vertices/edges highlight on selection; blank clicks clear it. Selection dragging
uses temporary Core point targets and commits one undo step; existing constraints
can reject a move. Bézier/ellipse curves are pickable as well as lines/arcs/circles.
Multi-selection/window selection and richer constrained drag behavior remain open.

Core now estimates local geometric degrees of freedom from a normalized numerical
Jacobian, distinguishes redundant/unsatisfied constraints, and exposes empty,
under-constrained, fully-constrained, over-constrained or unavailable status.
Arcs use five geometric parameters; analysis is capped at 256 coordinates and
is local, not a global uniqueness proof. Per-entity state coloring and singular
configuration coverage remain acceptance work. Existing drawing-tool design
relations (rectangle/polygon constraints, etc.) remain incomplete.

Dropdown menus now render their artwork. Distinct shared SVG variants include
center/aligned rectangles, midpoint line, center arc, three-point circle, ellipse
and circumscribed polygon, using the existing theme palette.

### Rectangle design intent — 2026-09-09

New corner and center rectangles store four H/V constraints. Aligned rectangles store opposite-edge parallel relations and one perpendicular relation, retaining rotation freedom. Center rectangles also create a selectable construction center and diagonal tied to opposite vertices through coincidence and midpoint constraints. Fixing the center yields symmetric resizing. Existing saved free paths are not retroactively constrained.

Focused Core operation: `core/engine/src/sketch/operations/rectangle-relations.ts`; CAD placement delegates to it. No special rectangle solver or duplicate saved shape state. Deterministic tests cover 4/5 DOF, fixed-center resizing, atomic rejection, native persistence, pointer drag/undo/reopen and exact extrusion excluding construction entities. 137 Core / 208 CAD tests, Core check and CAD build pass. Browser connection list is empty; live acceptance remains pending. Polygon/midpoint-line gesture relationships remain incomplete.

### Polygon design intent — 2026-09-09

Inscribed and circumscribed polygons now persist regularity through equal chords and a shared construction circumcircle. Circumscribed polygons also retain the concentric, tangent inner sizing circle. Four free coordinates remain (center, scale, orientation); fixing center and radius leaves rotation. Construction entities are excluded from solids. Existing free paths are not retroactively changed. Focused implementation: `core/engine/src/sketch/operations/polygon-relations.ts`.

Verification: 143 Core / 209 CAD tests, Core check and CAD build pass. Tests cover triangle/square/pentagon/hexagon dragging, equal sides AND angles, editable inner/outer radii, source immutability, 100-side radius editing, native persistence, undo/reopen, and kernel extrusion. Solver constraint ceiling raised from 64 to 512 to retain the existing 100-side tool's full range; coordinate and diagnostic limits remain explicit. Live browser acceptance, side-count editing after creation and large-drag branch robustness remain open.

### Midpoint-line design intent — 2026-09-09

The first click now persists as a selectable construction point with an ordinary midpoint constraint on the created line. Dragging the center translates the line; fixing the center permits symmetric endpoint edits. Fixed center + direction + length fully defines the line. Core operation `operations/line-midpoint.ts` adds no duplicate shape state or UI math; CAD placement calls it. Existing saved free lines remain unchanged.

Verification: 147 Core / 210 CAD tests, Core check and CAD build pass. Tests exercise center dragging, symmetric endpoints, full definition and length edits, unique IDs, atomic invalid-edge rejection, pointer undo/redo/native save/reopen. Live browser and broader inference remain outstanding.

### Three-point circle design intent — 2026-09-09

Three-point placement now appends three selectable construction points with ordinary point-on-circle coincidence constraints. Fixing two points permits editing through the third; fixing all three fully defines the circle and points. Unfixed placement points retain their own sliding freedoms. Existing saved circles remain unchanged. Dedicated Core operation: `operations/circle-points.ts`.

A mounted drag test exposed and fixed selection ties: coincident points now beat earlier curves in document order within numerical tolerance. Verification: 151 Core / 212 CAD tests, Core check and CAD build pass. Coverage includes analytic expected circles after dragging, full definition/conflict rejection, collinear/mismatched source rejection, pointer undo/native persistence and exact extrusion with construction points excluded. Live browser acceptance remains open.

### Center-point arc intent — 2026-09-09

New center-point arcs retain a selectable construction point linked to their analytic center with the existing concentric constraint. Fixing this point preserves the center through endpoint and radius edits. The point adds no independent geometric freedom. Dedicated Core `operations/arc-center.ts` owns the relationship; CAD placement delegates. Existing saved free arcs remain unchanged.

155 Core / 213 CAD tests, Core check and CAD build pass. Tests cover center dragging, fixed-center endpoint/radius edits, invalid references, native persistence, undo/reopen and exact extrusion with construction center excluded. Tangent/elliptical variants, endpoint-first three-point interaction, direction control and live browser acceptance remain open.

### Tangent arc tool — 2026-09-09

Reference: [Onshape tangent arc](https://cad.onshape.com/help/Content/Sketch/arc_tangent.htm). The Arc dropdown now includes a distinct illustrated Tangent arc. Click a finite curve endpoint, move to preview and click to commit. Core constructs the exact signed circular arc and stores endpoint tangency. Extending the end of a compatible open path appends to it, so switching back to Line can close and extrude one contour. Other endpoints create explicit constrained branches; automatic branch assembly remains work. Degenerate straight-line targets and missing endpoints reject atomically.

Focused modules: Core `operations/tangent-arc.ts`, CAD `sketch/tangent-arc-tool.ts` for interaction, existing preview renderer for display. Shared SVG is `core/assets/icons/tools/tangent-arc.svg`. Main/registry edits only register/enable the new contextual drawing tool. Extracted `sketch/history.ts` restores active path with geometry; undo/redo no longer silently starts an unrelated contour when continuing.

160 Core / 216 CAD / 149 UI tests pass; Core/UI checks and CAD/UI/Animation builds pass. Tests cover signed arcs, persistent tangency after dragging, reverse endpoint branch, curved source, invalid targets, ribbon dispatch/artwork, pointer preview, continuation after undo/redo, native save/reopen and exact extrusion. Live browser, click-drag-release placement, automatic line/arc switching, immediate radius entry and expression input remain open.

### Tangent arc drag-release placement — 2026-09-09

Tangent arc now supports dragging from an existing endpoint and releasing at the arc end. `sketch/tangent-arc-gesture.ts` owns pointer capture/threshold, click suppression and cancellation; it calls the same placement/preview path as two-click drawing. Geometry stays unchanged during preview and one undo checkpoint is added only for a valid release. Escape, tool changes, undo/redo, new contour, pointer cancellation and lost capture cancel the gesture. A subsequent pointerdown resets click suppression, preserving ordinary selection.

220 CAD tests and CAD typecheck/build pass. Mounted tests exercise drag preview, release/native persistence, synthetic-click suppression, one-step undo/redo, Escape/pointer cancellation, invalid-release atomicity and the existing two-click workflow with pointer events. Live browser capture behavior remains unverified. Automatic switching, immediate radius entry and branch joining remain open.

### Endpoint-first three-point arcs — 2026-09-09

The standard arc tool now uses start → end → point on arc, matching the [reference interaction](https://cad.onshape.com/help/Content/Sketch/3_point_arc.htm). The ribbon explicitly labels it “3 point arc.” After selecting the endpoints, moving the pointer changes curvature while the chord endpoints remain fixed. For an open path, its endpoint supplies the start. Closure snapping applies to the chosen end, never to the curvature point. Coincident endpoints reject immediately; collinear curvature rejects without discarding the chosen endpoints. Stored geometry format is unchanged.

223 CAD tests and CAD typecheck/build pass. Existing arc modification tests now use the corrected placement order. Added tests for preview on both sides, native undo/reopen, arc closure of a line contour and recovery after invalid input. Browser discovery returned no connections; live verification remains outstanding. Drag-to-set-chord, semicircle inference and immediate numeric entry remain open.

### Three-point arc chord drag — 2026-09-09

Three-point arcs now also support drag/release for the chord followed by a curvature click. Releasing creates no geometry or undo checkpoint; the final click commits one arc. Dragging from an existing open path endpoint continues it. Ordinary endpoint clicks remain available for continuation, and cancellation clears transient preview without changing geometry.

Renamed the existing generic pointer handler to `sketch/endpoint-drag-gesture.ts` and reused it for both tangent and three-point arcs. `arc-chord-tool.ts` owns chord staging; no duplicate pointer state machine or geometry engine. 226 CAD tests and CAD typecheck/build pass, including drag/chord preview, delayed commit, undo/native reopen, continued contour closure, cancellation and ordinary pointer clicks. Live browser, immediate numeric sizing and semicircle inference remain open.

### Immediate circle/arc radius — 2026-09-09

After creating a center/three-point circle or three-point/center/tangent arc, an optional inline radius field appears. Typing a digit from the canvas focuses that field; Enter or Set radius adds a saved driving radius and returns canvas focus. Starting another gesture/tool or undoing clears the temporary target. The existing constraint list edits the saved dimension after reopen.

Core `operations/set-radius.ts` updates an existing radius driver (including linked dimensions) or adds one canonical constraint. CAD `sketch/recent-radius.ts` owns only entry/target presentation. Invalid or conflicting dimensions reject atomically. Values are explicitly millimeters; expressions/variables and document-unit entry remain incomplete.

165 Core / 232 CAD tests, Core check and CAD build pass. Tests cover all five creation tools, keyboard focus/Enter, undo/redo/native persistence, driver reuse, linked radii, tangent retention, invalid values and fixed-geometry conflicts. Live browser verification remains outstanding.

### Radius entry in document units — 2026-09-09

Immediate radius labels and values now follow the document's length preference (mm/cm/m/in/ft), using the shared Core unit catalog. Submission converts into canonical sketch millimeters. Changing preferences while the field is open converts a finite pending value without touching geometry; invalid drafts clear rather than being reinterpreted. The preference subscription is disposed when the sketch closes.

237 CAD tests and CAD typecheck/build pass. Coverage includes all nondefault length units, native dimension/geometry values and changing units before submission. Expressions/variables and live browser remain open. Other sketch controls retain their explicitly labeled units.

## Finite-contact curvature continuity — 2026-09-09

- Curvature constraint is available in the sketch ribbon and constraint panel. Two finite segment contacts enforce coincident position, parallel tangent directions and matching signed curvature. Reversed parameter direction is handled. Math lives in the focused Core `solver/curve-continuity.ts`, shared with finite tangency.
- Native sketches persist the new `curvature` constraint kind; readers need this updated constraint vocabulary. Endpoint UI supports line/arc/ellipse/Bézier contacts, not circle-locus selections or freely sliding contacts. Stationary points and incompatible selections reject.
- Verification: 171 Core / 238 CAD tests, Core check and CAD build pass. Tests cover nonzero curvature, line joins, reversed parameter speed, fixed-geometry conflicts without mutation, DOF rank, editor apply/undo/redo and native reopen. Shared UI's 149 tests and UI/Animation builds passed with the new icon in the preceding artwork verification. Live browser remains unverified.


## Normal sketch constraint — 2026-09-09

- Added persisted `normal` constraint, illustrated ribbon icon and editor controls. A line normal to a circle/arc locus passes through its center. A line normal to a finite curve contact passes through that point perpendicular to its tangent. Both selection orders work; zero-length lines, stationary contacts and incompatible targets reject.
- Equations live in Core `solver/normal.ts`; UI contains no duplicate geometric logic. The saved constraint kind requires an updated reader. Curve-to-plane Normal and free sliding curve contact selection remain incomplete.
- Verification: 176 Core / 239 CAD / 149 UI tests; Core/UI type checks and CAD/UI/Animation builds pass. Includes fixed-geometry conflict immutability, finite cubic contact, selection order, apply/undo/redo and native reopen. Browser discovery still returns no connections; live acceptance remains outstanding.

Reference: [Onshape Normal](https://cad.onshape.com/help/Content/Sketch/normal.htm) includes line/curve and curve/plane selections; the latter is not yet implemented.

## Initial exact sketch Offset — 2026-09-09

- Offset ribbon command now opens signed distance controls and contour selection with transient preview, cancel, undo/redo and native persistence. Core `operations/offset.ts` owns exact circle, individual circular arc and mitered line-chain geometry. Positive means left of directed paths and outward for circles. Invalid selections, collapsed radii/edges, reversing corners and transverse self-intersections reject atomically.
- Offset geometry is currently independent. Associative source updates, mixed curve chains, spline/ellipse offsets, full topology cleanup, individual-edge selection, drag manipulator and shared distance constraints remain required for parity. Unsupported curves reject explicitly.
- Fixed modification Apply/Cancel leaving the ribbon tool active; finishing now returns to Select so the tool can reopen on the next click.
- Verification: 182 Core / 240 CAD tests, Core check and CAD build pass. Tests cover exact radii, open/closed chain offsets, sign reversal, conflict rejection, previews, cancel/reopen, undo/redo and native save/reopen. Live browser remains outstanding.

Reference: [Onshape Offset](https://cad.onshape.com/help/Content/Sketch/offset.htm). Drag direction/distance and repeated equal-distance offsets remain acceptance items.

## Persistent circle and line offsets — 2026-09-09

- Circle and single-line Offset creation now saves ordinary `offset` constraints and links a batch to one editable signed distance. Circle relations retain center and radius difference; line relations retain endpoint correspondence, direction and length. Source/follower edits solve together. Removing a shared driver materializes remaining follower values.
- Geometry, relation creation and residual math remain separate in `operations/offset.ts`, `operations/offset-relations.ts` and `solver/offset.ts`. New saved `offset` kind requires updated readers. Arc/polyline offsets remain independent; their association is still required for parity.
- Verification: 185 Core / 241 CAD tests, Core check and CAD build pass. Covers source resize/rotation, shared signed distance edits, collapsed radius rejection without mutation, driver removal, native reopen and editor distance updates. Live browser acceptance remains outstanding.


## Persistent circular arc offsets — 2026-09-09

- Individual circular arc offsets now save offset relations preserving center, start angle, signed sweep and radial separation. Clockwise/counterclockwise arcs follow source radius and signed distance edits. Five independent geometric equations avoid adding a redundant through-point constraint.
- Offset default selection excludes construction geometry and empty point contours, so center-point arcs can offset immediately. Construction curves remain explicitly selectable.
- Verification: 189 Core / 243 CAD tests, Core check/CAD build pass. Source/follower changes, direction signs, DOF classification, collapse rejection, native edit/reopen and center-arc selection covered. Multi-edge association, general curve offsets, manipulators and live browser remain incomplete.


## Associative line-chain offsets — 2026-09-09

- Open and closed line-chain offsets now retain whole-contour correspondence, following joined corners, open ends and intermediate collinear vertices through source and distance edits. They participate in shared batch distance links and DOF diagnostics.
- Added persisted `contour` entity reference for this relationship; updated readers are required. Exact offset geometry moved to `sketch/curves/offset.ts` for reuse by creation and solver residuals. Operation orchestration and relation creation remain separate.
- Splitting/trimming a linked chain currently rejects until topology remapping is implemented; deleting a whole source contour removes its relationship normally. Mixed/spline/ellipse offsets, topology remapping, individual-edge selection, manipulators and live browser acceptance remain open.
- Verification: 193 Core / 244 CAD tests, Core check and CAD/Animation builds pass. Includes source resize, open/closed/collinear geometry, fully constrained DOF, collapse rejection, topology guards/deletion, native reopen and editor distance changes.


## Offset distance handle — 2026-09-09

- Offset preview now has a draggable signed-distance handle. Dragging projects onto the source normal; tangential motion does not change distance. Cancelling a drag restores its starting distance without committing geometry. Flip direction negates the numeric value; Enter in the distance field applies a valid preview. Arrow keys adjust the focused handle.
- Shared `dimension-manipulator.ts` is now generic over handle/value behavior. Fillet keeps its existing radius semantics; offset presentation lives in `offset-manipulator.ts`, with geometric projection in Core `operations/offset-handle.ts`.
- Verification: 198 Core / 245 CAD tests, Core check/CAD build pass. Includes signed projection for all supported offset types, linked dimensions, drag/cancel/flip/Enter/native persistence and existing fillet regression tests. Browser discovery returned no connections; live pointer-capture verification remains outstanding.


## Individual-edge Offset selection — 2026-09-09

- Offset supports whole contours or individual lines/circular arcs/circles. Clicking a curve enters edge selection and toggles it; selected edges share a distance while retaining original segment references. Only those edges are copied, and source edits update their offsets.
- Offset controls, selection, preview, handle and commit lifecycle now live in dedicated `sketch/offset-panel.ts`. General modification routing delegates to it. Core `operations/offset-entities.ts` reuses exact geometry and a shared relation constructor.
- Verification: 201 Core / 246 CAD tests, Core check/CAD build pass. Includes segment provenance, duplicate selection, invalid batches, source edits, click/toggle/native reopen, and existing contour/handle/fillet regressions. Test button queries now exclude hidden panels, matching visible interaction after extraction. General curved offsets, topology remapping and live browser acceptance remain open.


## Mixed line/arc offset geometry — 2026-09-09

- Whole connected line/circular-arc profiles now offset using exact line/circle carriers. Tangent joins remain connected; supported non-tangent joins use nearest carrier intersections. Native arcs are preserved. Collapsed edges/arcs, disjoint joins requiring topology changes and detected self-intersections reject.
- Dedicated `curves/offset-carriers.ts` and `offset-mixed.ts` own intersections and assembly. Mixed-profile copies are currently independent: associative mixed joins, topology repair and spline/ellipse offsets remain incomplete. The UI states this limit.
- Verification: 206 Core / 247 CAD tests, Core check/CAD build pass. Includes signed closed capsule offsets, line-circle and circle-circle joins, invalid joins, source immutability, whole mixed-contour preview and native reopen. Live browser acceptance remains outstanding.


## Mixed line/arc offset relationships — 2026-09-09

- Mixed line/circular-arc contours now retain shared signed offset relations. Dedicated `solver/offset-mixed.ts` constrains oriented line loci, arc centers/signed radii and open-end parameters. Shared vertices form joins; the solver does not repeatedly intersect tangent carriers during finite differences.
- Verification: 210 Core / 248 CAD tests, Core check/CAD build pass. Includes tangent capsule distance/source-growth edits, non-tangent joins, collapse rejection without mutation, and persisted editor distance changes. Tests compare offset geometry to the solved source, within solver residual tolerance.
- Near-singular tangent/diametric configurations still need improved DOF diagnostics and geometric error bounds: small residuals do not guarantee equally small derived center/vertex errors. Topology repair, split/trim remapping, branch robustness and live browser acceptance remain open; full Offset parity is not claimed.


## Line and circular-arc Slot — 2026-09-09

- Added illustrated Slot tool with centerline click/list selection, live preview, numeric width, Enter/apply/cancel and undo. Individual line/arc slots retain exact sides and semicircular caps. Batch slots share an editable width driver and follow source changes; standalone centerlines become construction geometry for extrusion.
- Core geometry, operation and solver modules are separate; CAD owns `sketch/slot-panel.ts`. Native sketches save the new `slot` constraint kind with width as diameter in millimeters; updated readers are required. Oversized/collapsed arcs and overlapping major-arc end caps reject.
- Verification: 215 Core / 249 CAD / 149 UI tests; Core/UI checks, CAD/UI/Animation builds pass. Covers shared width/source edits, DOF, invalid-input immutability, native editor reopening and a saved slot extruded through the real kernel.
- Multi-curve/closed-profile/spline slots, width manipulators, sequential application semantics, topology repair and live browser acceptance remain incomplete.

Reference: [Onshape Slot](https://cad.onshape.com/help/Content/Sketch/slot.htm) also covers chains, closed profiles and splines; those remain acceptance items.

## Slot width handle and capture cleanup — 2026-09-09

- Slot preview now has an on-canvas width handle with keyboard adjustment. Width is the full diameter: handle displacement is half the width, measured normal to the centerline from either side. Cancellation restores the starting width; Apply creates one undo transaction.
- Core `operations/slot-handle.ts` owns projection; CAD `slot-manipulator.ts` adapts the shared dimension manipulator. Shared handle cleanup releases pointer capture on cancellation/tool switches and clears stale click suppression on fresh pointer gestures.
- Verification: 217 Core / 251 CAD tests, Core check/CAD build pass. Includes line/arc projection, diameter semantics, drag/cancel/keyboard/apply/undo, and capture release during tool changes. Browser discovery returned no connections; live pointer capture remains unverified. Chain/closed/spline slot variants remain open.


## Open-chain Slot — 2026-09-09

- Slot selection now includes open line/circular-arc chains. Envelopes use exact offset sides, rounded convex joins, intersected concave joins and semicircular end caps. Selected source chains become construction geometry; saved whole-contour relationships retain shared width and the width handle.
- Geometry lives in Core `curves/slot-chain.ts`; smooth-chain solver equations live in `solver/slot-chain.ts`. Tangent/collinear joins retain smoothness through locus equations, avoiding microscopic arcs during finite differences. CAD selection stays in `sketch/slot-panel.ts`.
- Verification: 223 Core / 252 CAD tests, Core check and CAD build pass. Covers sharp/tangent/collinear chains, width edits, invalid/overlapping input, editor preview/undo/native reopen and exact-kernel extrusion of a saved chain slot.
- Closed/spline slots, corner-topology changes/remapping, automatic overlap repair and full live browser acceptance remain open. Existing smooth joins remain smooth; changing a rounded join into a straight join requires topology work still outstanding.

## Sketch symmetry — 2026-09-09

- Added illustrated Symmetric ribbon constraint and a line-only axis selector. Supports reflected point pairs, line supporting loci, and circle/circular-arc centers with equal radii. Finite line/arc endpoints remain independent, matching the reference's underlying-curve semantics.
- Core `solver/symmetric.ts` owns equations. The native constraint adds `axis: SketchEntityRef`; solver participation, deletion and split/trim/fillet reference remapping include it. Updated readers are required for the new kind/field.
- Verification: full Core suite (228 tests), six focused symmetry tests after adding arc coverage, CAD (253) and UI (149) suites pass; Core/UI checks and CAD/UI builds pass. Covers rotated-axis solving, locus semantics, zero/missing axes, axis deletion/index shifting/splitting, UI apply/undo/redo and native reopen. Live browser verification remains outstanding.
- Ellipse/spline symmetry, external plane/edge references, multi-pair viewport picking and full sketch parity remain incomplete.

## Elliptical-arc symmetry — 2026-09-09

- Elliptical segments expose a supporting-ellipse entity in constraint selectors. Symmetry reflects centers and quadratic shape, independent of trim endpoints, principal-axis swaps and half-turn-equivalent rotations. The native entity reference vocabulary adds `ellipse` (updated readers required).
- Solver coordinates now include ellipse radii (positive logarithmic coordinates) and rotation (radians internally). These were previously counted by diagnostics but absent from solving. Geometry representation remains the existing endpoint-arc format.
- Verification: 232 Core / 254 CAD tests, Core check and CAD/Animation builds pass. Covers rotated and radius-swapped equivalent ellipses, unequal-radius solving, source immutability, UI selection/application and native reopen.
- Full ellipses currently consist of two arc segments without a shared shape relationship: symmetry here applies to the selected segment's locus. Shared half-ellipse shape constraints, diametric/singular endpoint robustness, ellipse trim/split relation remapping, spline symmetry and live browser verification remain open.

## Full ellipse shape relationships — 2026-09-09

- Newly drawn full ellipses now save an `ellipse-shape` constraint connecting both native half-arcs. Matching radii/rotation and diameter endpoints retain one ellipse with five geometric freedoms. The relation can be removed and reapplied through the constraint panel's Full ellipse selection.
- Core `operations/ellipse-relations.ts` captures intent; `solver/ellipse-shape.ts` owns five shape equations. Supporting-ellipse resolution uses the shared shape parameters for constrained full ellipses, avoiding singular endpoint-to-center reconstruction inside symmetry solving. Existing unlinked ellipse files remain unchanged until explicitly constrained.
- Verification: 235 Core / 255 CAD tests, Core check/CAD build pass. Includes five-DOF diagnostics, unequal-shape symmetry, linked half geometry, repeated drawing, undo/redo, native reopen and real-kernel extrusion. Browser discovery again returned no connections.
- Ellipse topology remapping, parameter-edit controls, stricter diametric geometric error bounds and full live browser verification remain open. Splitting a shape-linked ellipse currently rejects rather than losing its relationship; removing the relation permits independent editing.

## Ellipse point and quadrant constraints — 2026-09-09

- Coincident accepts point/ellipse pairs in either order and constrains the point to the supporting ellipse. Added illustrated Quadrant command: chooses the nearest local-axis endpoint when applied, persists its 0–3 index, and retains that endpoint as geometry changes. New `quadrant` kind/field requires updated readers.
- `solver/ellipse-contact.ts` owns radial contact, endpoint evaluation and nearest-quadrant selection. Existing constraint controls handle creation and undo; full ellipse shape constraints remain active during solving.
- Verification: 238 Core / 256 CAD / 149 UI tests; Core/UI checks and CAD/UI builds pass. Covers rotated quadrants, point-on-ellipse solving, reversed entity order, missing-index rejection, editor apply/undo/redo and native reopen.
- Automatic quadrant inference/snapping during drawing, direct quadrant reassignment controls, ellipse topology remapping and live browser acceptance remain open. Ellipse equal/concentric extensions were considered but not implemented in this work unit; Quadrant is an explicit reference parity requirement.

## Ellipse quadrant snapping and inference — 2026-09-09

- Geometry snapping now offers exact ellipse-axis endpoints with a Quadrant label. Full ellipses provide four candidates; trimmed elliptical arcs exclude endpoints outside their visible span. Quadrant labels win ties with generic endpoint labels.
- Newly authored vertices exactly at an existing ellipse quadrant gain a persisted relationship when geometry snapping is enabled, grouped with geometry creation in one undo transaction. Existing vertices are untouched and repeated inference does not duplicate their relationships. Numeric placement at the exact point also follows this inference rule.
- Core `operations/ellipse-snaps.ts` owns candidates and reference creation; CAD `sketch-snapping.ts` presents snap positions, with a small placement hook in the workspace. This does not implement all other inferred constraints or complete every alternate drawing gesture path.
- Verification: 240 Core / 258 CAD tests and Core check/CAD build pass; 95 focused editor tests pass after adding snapping-disabled coverage. Tests include finite-arc clipping, named snaps, relationship preservation/undo/native reopen and the geometry-snapping toggle. Live browser verification remains outstanding.

## Initial ASCII DXF sketch import — 2026-09-09

- Sketch ribbon Import DXF opens a dedicated panel with file selection, automatic/explicit source units, canvas preview and insertion in one undo step. Imported geometry saves as editable native contours. Common INSUNITS scales are supported; unspecified units require selection.
- Core `sketch/import/dxf/` separates tags, section/units handling and exact primitive conversion. Supports XY model-space LINE, POINT, CIRCLE, ARC and LWPOLYLINE (signed bulges and closure). Unsupported model-space entities reject atomically; paper-space entities are excluded.
- Verification: 244 Core / 260 CAD tests, Core check/CAD build pass. Includes unit conversion, wrapped arcs, bulged closure, invalid/unsupported inputs, file read/units/preview/undo/native reopen, and actual extrusion with cylindrical topology.
- Binary DXF/DWG, blocks, legacy polylines, splines/ellipses, text/hatches, object-coordinate transforms, layers, edge joining/hole classification, interactive placement and live browser verification remain incomplete. Import is a supported subset, not full parity.

## DXF ellipses and legacy polylines — 2026-09-09

- Added full/trimmed rotated ELLIPSE entities using actual ellipse parameters and major-axis vectors; full ellipses become two native half-arcs. Added planar unfitted POLYLINE/VERTEX/SEQEND sequences through the shared bulge converter, including closed clockwise curves.
- Dedicated `ellipse.ts` and `polyline.ts` keep entity geometry and sequence parsing separate. Paper-space polyline sequences are skipped as a unit. Missing sequence ends, invalid ellipse ratios and unsupported fitted/3D geometry reject.
- Verification: 249 Core / 261 CAD tests, Core check/CAD build pass; five focused curve-import tests pass after adding paper-space regression coverage. Includes unit-scaled rotated arcs, full ellipses, sequence boundaries, native UI reopen and actual rotated-ellipse extrusion.
- Import still lacks blocks, splines, object-coordinate transforms, DWG/binary input, layers, automatic edge joining/hole classification and interactive placement. Imported full ellipses are native geometry without automatically added shape relations; those can be applied explicitly. Live browser acceptance remains outstanding.

## DXF placement controls — 2026-09-09

- Import preview now supports X/Y in millimeters, rotation in degrees and positive uniform scale about the source origin. Place DXF on canvas follows pointer movement; clicking fixes the origin location without inserting, and Escape restores the starting location. Insert remains one undoable action.
- `sketch/dxf-placement.ts` owns fields and pointer interception. The import panel caches parsing across placement updates and reuses Core similarity transforms, preserving native circles/arcs/ellipses. Combined drawing validation runs before committing insertion.
- Verification: 263 CAD tests and CAD build pass; 99 focused editor tests pass after adding insertion validation. Covers translated/rotated/scaled previews, invalid scale, pointer placement/cancel, no accidental geometry creation, undo/redo and saved placement. Browser discovery returned no connections; actual browser pointer verification remains open.
- Custom source anchors, placement snapping/manipulators, geometry joining/hole classification and broader DXF/DWG support remain incomplete.

## DXF connected contour joining — 2026-09-09

- DXF import now joins endpoint-connected open paths by default; the panel offers Join connected edges to preserve separate entities when desired. Source entity count remains unchanged while preview/native contour count reflects joining.
- Core `import/join-contours.ts` traces unambiguous chains/cycles, reverses native arc/ellipse/Bezier geometry correctly, preserves construction/hole groups, and stops at branch nodes. Default endpoint tolerance is 1e-7 mm; Core options can override it. Matched endpoint movement is bounded by that tolerance. Constrained drawings reject joining until reference remapping is available.
- Verification: 255 Core / 264 CAD tests, Core check/CAD build pass. Includes reversed/shuffled closed outlines, native curve reversal, branch handling, tolerance bounds, UI toggle/native save and actual extrusion of independently imported DXF lines with checked solid dimensions.
- Interior intersections, ambiguous branches, nested-hole classification and live browser acceptance remain incomplete; joining does not infer manufacturing regions automatically.

## Nested imported DXF regions — 2026-09-09

- Core classifies disjoint closed imported contours by containment depth into solids, holes and nested islands. Touching/intersecting/ambiguous loops reject automatic classification; Detect nested holes can be disabled for manual import. Open/construction geometry is preserved.
- Kernel extrusion processes disjoint nested loops from outside inward so islands survive enclosing hole cuts. Source contours and native hole flags persist.
- Verification: 259 Core tests, 265 CAD tests, Core check and CAD build pass, including nested-circle extrusion retaining all three radial boundaries, native roundtrip and the import-panel override.
- Sketch fill compositing for arbitrarily ordered islands and live browser verification remain open. Classification does not resolve intersecting manufacturing regions.

## Sketch dropdown construction icons — 2026-09-09

- Refined dedicated vector icons for corner, center-point and aligned rectangles: corner handles, center crosshair/diagonals and a rotated baseline/right-angle marker distinguish construction methods. Midpoint lines, three-point circles and center/three-point arcs now use consistent highlighted defining points. Existing dropdown rendering uses each variant’s own SVG at 28px and theme-aware colors.
- Verification: 149 shared UI tests and 265 CAD tests pass; UI typecheck/build and CAD build pass. Browser connection discovery returned no connections; live light/dark dropdown visual verification remains outstanding.


## Nested sketch region display — 2026-09-09

- Sketch region fills now follow outside-in containment order, preserving islands inside holes even when imported contours arrive in a different order. Open and construction geometry paints afterward so region fills do not hide it.
- Core `regions/order.ts` supplies the same ordering to the sketch renderer and extrusion kernel. Original contour indices, geometry and constraints are unchanged; rendered contours carry their original index. Ambiguous intersecting loops retain explicit solids-before-holes behavior rather than receiving inferred region semantics.
- Verification: 261 Core and 266 CAD tests pass, Core check/CAD build pass. Tests cover every permutation of three nested boundaries, fallback behavior, renderer ordering and unchanged source references. Live browser visual acceptance remains outstanding.


## DXF polynomial spline import — 2026-09-09

- ASCII DXF SPLINE control nets of degree 1–3 now import as native lines/cubic Bézier spans, preserving polynomial geometry rather than tessellating. Quadratic spans are degree-elevated; nonuniform and repeated knots and unclamped domains are supported. Equal positive weights cancel and are accepted. Closed/periodic flags require endpoint closure within 1e-7 mm.
- Focused Core `curves/bspline.ts` owns curve conversion; `import/dxf/spline.ts` owns DXF counts, coordinates, weights and flags. Existing preview, placement, endpoint joining, undo and native persistence apply. No curve evaluation logic was added to UI.
- Verification: 266 Core / 267 CAD tests, Core check/CAD build pass. Independent Cox–de Boor basis tests compare span geometry; tests cover invalid knot/control data, nonplanar later control points, unsupported weights, spline-to-line closed joining, preview, undo/redo and native save/reopen.
- Higher-degree and unequal-weight rational curves, fit-only splines, source B-spline control-net editing and associative continuity across converted spans remain incomplete. Browser discovery returned no connections; live browser acceptance remains open.


## Fit-point spline authoring — 2026-09-09

- The spline dropdown now exposes Fit-point spline. Click any number of distinct consecutive points (2–1001), preview the interpolated curve as the pointer moves, then use Finish spline or Enter on the canvas. Escape cancels pending points. Finishing the sketch with an unfinished spline reports the needed action instead of silently discarding it.
- Core `curves/fit-spline.ts` uses chord-parameterized natural cubic interpolation and emits native Bézier spans. Initial geometry passes through every fit point with C2 continuity in chord parameters. `sketch/fit-spline-tool.ts` owns completion controls; drawing/preview modules share the Core result. One completed spline is one undo step; construction mode and native save/reopen work.
- Verification: 268 Core / 268 CAD tests pass; Core check/CAD build pass. Tests cover interpolation/continuity, duplicate rejection, pointer and between-click previews, explicit/keyboard completion, cancellation, undo/redo and native reopening. Browser discovery remains empty.
- Persistent fit-point-driven refitting, periodic closed splines, tangent-end controls and arbitrary-degree/control insertion remain incomplete. Editing native Bézier handles does not preserve the initial natural-spline relationship automatically.


## Periodic closed fit-point splines — 2026-09-09

- Fit-point splines can close by clicking near their first point after at least three points, or using Close spline. Pointer preview uses the same closed geometry; completion is one undoable native contour. Closed splines require 3–1000 distinct consecutive fit points.
- Core `curves/periodic-spline.ts` solves the cyclic tridiagonal system in linear time/storage. Position, tangent and second derivative match across all fit points, including the seam. Open splines retain their natural endpoint behavior.
- Verification: 270 Core / 269 CAD tests pass, Core check/CAD build pass. Tests cover nonuniform triangular/five-point seam continuity, hover closure, click/button completion, undo/native persistence and actual OCCT extrusion of a saved periodic loop with checked depth.
- Initial periodic geometry is implemented; subsequent native-handle edits do not yet maintain fit-spline relationships. Persistent refitting, tangent endpoint controls and live browser acceptance remain open. Browser discovery returned no connections.


## Persistent fit-spline refitting — 2026-09-09

- Newly authored open/closed fit splines save a `spline-shape` constraint referencing their whole native contour. Fit knots remain the existing vertices; no duplicate geometric point store was added. Solver residuals keep Bézier handles on the natural/periodic interpolant during point dragging and constraint solving.
- Shape-linked contours expose a whole-spline constraint selection. Removing the shape constraint allows independent handle editing. Unsupported segment splitting reports a remapping requirement rather than silently breaking the relationship.
- Verification: 276 Core / 269 CAD tests pass, Core check/CAD build pass. Tests verify six freedoms for three open fit points, eight for four closed fit points, fully defined status with fixed fit points, interior dragging with fixed neighbors, periodic seam dragging, native constraint persistence, topology guards and validation of a 100-point curve.
- Solver now checks already-satisfied residuals before allocating iterative coordinates, allowing large generated curves to save unchanged. Iterative editing still has the existing 512-coordinate limit; full diagnostics retain their 256-coordinate limit. Endpoint tangent controls, source-fit topology insertion/remapping, scalable solving/diagnostics and live browser acceptance remain open. Browser discovery returned no connections.


## Sketch projection geometry foundation — 2026-09-09

- Core `sketch/projection/` now projects solved native curves between arbitrary orthonormal sketch frames. Lines/Bézier controls transform directly; circular and elliptical arcs become exact native ellipse segments. Oblique circles produce closed ellipse halves, while circular results remain circles. Orientation reversal changes sweep correctly.
- Output preserves construction/hole flags and omits source constraints whose meaning does not survive projection. Edge-on conics reject explicitly; no collapsed or tessellated substitute is silently created.
- Verification: 281 Core tests and Core check pass; CAD build passes. Includes pointwise geometry checks under translated/oblique frames, reflected sweep, source dimension solving, immutable source data, invalid/degenerate frames and actual native projected-ellipse save/reopen/extrusion with checked dimensions.
- This is a geometry foundation, not a shipped associative Project tool. Persisted source references, source-edit propagation, broken-reference reporting, edge/vertex picking and UI integration remain open. No new browser behavior was claimed.


## Associative whole-sketch projection documents — 2026-09-09

- A profile can now persist `{type: "projection", sourceFeatureId}` instead of a geometry snapshot. Core `document/profile-projection.ts` resolves earlier profile IDs, solves source geometry, projects between source/target frames, and supports chained references. Renaming/editing the source retains the relationship.
- The kernel resolves projected profiles during rebuild, including extrusion consumers. Missing/forward references are rejected by document validation; suppressed sources report an explicit rebuild error. Rollback excludes downstream projection/body evaluation. Named frame conversion matches the evaluator's XY/XZ/YZ conventions; explicit frame origins avoid double-applying offsets.
- Verification: 285 Core / 269 CAD tests pass; Core check/CAD build pass. Includes serialized reference-only payload, rename/radius propagation, chained/suppressed/missing/forward references, frame conventions, native projected-solid dimensions after edits and rollback.
- Whole-source reference semantics now work in Core, but Project selection/creation UI, mixed authored/projected sketch geometry, stable subentity references, broken-link recovery UI and live browser acceptance remain incomplete. Direct editing of a projection currently raises an explicit source-driven-editing error to prevent accidental detachment.


## Whole-sketch projection editor — 2026-09-09

- Sketch ribbon Project sketch opens a viewport editor for whole-source projections. Choose an earlier source sketch, target named plane/offset, and name; native preview geometry updates before Create projection. Editing a projected feature routes to the same editor, retaining its ID and allowing source relinking or preservation of its explicit frame.
- The editor saves only the source reference. It protects active sketches and rejects stale-document apply, invalid/edge-on previews and suppressed sources. Cancellation leaves the document unchanged. An already-open document with a missing reference can select a replacement source; invalid files still fail document parsing, so file-level recovery remains incomplete.
- Feature dependency traversal now includes projected source IDs, so source suppression/unsuppression and cascading removal include projected sketches and their solids. Auto-fit previews bound grid density to avoid excessive grid elements for large coordinates.
- Verification: 286 Core / 273 CAD tests, Core check/CAD build pass. Mounted DOM tests cover reference-only creation, preview, relinking after native reopen, invalid/stale/cancel paths and replacement of a missing reference. Core tests cover dependency cascades. Browser discovery returned no connections; live visual acceptance remains open.
- This is a whole-sketch projection feature. Individual source edges/vertices, mixed projected/authored contours and their constraint references remain incomplete.


## Arc-center dimension access and stable contour references — 2026-09-09

- Sketch snapping now includes analytic circular-arc centers, including later segments in a path. Degenerate arcs do not disable other snap targets. Snapping alone positions geometry; it does not yet create an automatic persistent concentric relationship.
- In the active sketch constraint panel, select an arc as Entity A and use **Select arc center**. This exposes/selects a construction point constrained concentric to the arc, reusable for distance, alignment and fix constraints. Existing exposed centers are reused. Empty/nonfinite dimension values are rejected. Radius edits and fixed-center behavior use the existing Core solver.
- Core contour references now support optional scoped stable IDs and projection `sourceContourId`; the transactional reference helper assigns IDs to authored contours. Reordering/coordinate edits preserve references; deleted selected contours fail explicitly. Copies/offsets discard IDs; multi-fragment trims and joined paths avoid arbitrary identity inheritance. The projection settings editor preserves existing selected-contour references. Creating individual-contour references from the GUI, segment/vertex identity, mixed authored/projected geometry and comprehensive topology remapping remain open.
- Verification: 290 Core tests and 277 CAD tests pass, including mounted sketch center selection/fix/native-save and projection-reference preservation. Core typecheck and CAD production build checked. Browser discovery returned no connections; live browser interaction and visual acceptance remain outstanding. Full Onshape parity is not complete.


## Persistent center snap inference — 2026-09-09

- Ordinary sketch point placement now adds a saved concentric constraint when a newly authored point exactly matches an existing circular arc or circle center and geometry snapping is enabled. Existing vertices and off-center points are not constrained retroactively; closed-path duplicate vertices are counted once.
- Core `sketch/operations/center-snaps.ts` owns center candidates and inference. CAD uses those same candidates for snapping. Geometry and inferred constraints share one undo checkpoint. This covers the ordinary drawing placement path; alternate gestures and broader coincidence/alignment inference remain open.
- Verification: 293 Core / 278 CAD tests pass; Core typecheck and CAD production build pass. Tests cover constrained edits after JSON reopen, off-center/existing point exclusion, degenerate arcs, circle centers, mounted native save and undo/redo removal/restoration. Live browser acceptance remains outstanding; full parity is incomplete.


## Endpoint and origin inference — 2026-09-09

- Canvas-click completion now infers saved endpoint coincidence and origin anchoring for explicitly placed vertices. Core `operations/point-snaps.ts` excludes existing vertices, off-target points, duplicate closed endpoints and points already attached by center/quadrant inference. Generated centers are excluded when they were not among gesture placement points.
- Numeric Place point remains explicit coordinate entry for this new inference path. Center/quadrant inference retains its existing behavior. Alternate gestures, consistent snap provenance across all tools and broader alignment inference remain open.
- Verification: 297 Core / 279 CAD tests pass; Core check and CAD production build pass. Tests cover source movement after serialization, origin anchoring, idempotence, generated-center exclusion and mounted canvas endpoint inference with undo/redo/native save. Live browser acceptance remains outstanding; full parity is incomplete.


## Persistent line alignment — 2026-09-09

- Canvas placement of line and midpoint-line tools now retains exact horizontal/vertical alignment as native constraints. Existing segments and diagonal lines are not constrained retroactively. Duplicate inferred line relations are avoided.
- Core `operations/alignment-snaps.ts` owns geometric inference. CAD `sketch/drawing-inference.ts` now groups drawing gesture inference policy before the workspace undo commit, replacing inline orchestration.
- Verification: 299 Core / 280 CAD tests pass; Core typecheck/CAD production build pass. Tests verify constrained corner movement after serialization, appended-segment scope, idempotence, canvas creation, undo/redo and native save. Browser discovery returned no connections. Arbitrary alignment guides, alternate gesture coverage and full browser parity remain open.


## Persistent midpoint snapping — 2026-09-09

- Line and circular-arc midpoint candidates now come from Core `operations/midpoint-snaps.ts`, shared by CAD snapping and inference. Arc midpoint means halfway along its sweep, not chord midpoint or the stored through-point.
- Explicit canvas placement at a midpoint creates a native midpoint constraint, unless another inferred attachment already controls that point. Existing vertices, generated unplaced points and duplicate closed vertices are excluded. Undo groups the relation with new geometry.
- Verification: 301 Core / 281 CAD tests pass; Core check/CAD production build pass. Tests verify midpoint movement after endpoint edits and serialization, arc midpoint geometry, idempotence, generated-point exclusion and mounted canvas placement/undo/redo/native save. Live browser acceptance and remaining full parity are still open.


## Selected-contour projection editor — 2026-09-09

- Project sketch now offers Entire sketch or one source contour. New references assign a scoped stable ID to the authored source and save that source update together with the projection. Preview/cancellation never mutate the live document.
- Reopening identifies the selected contour by saved ID even after source reorder/coordinate edits. A deleted contour remains an explicit broken reference until a replacement contour or entire sketch is selected. Source changes reset the geometry selection. Projected-source contours can be selected when they already expose stable IDs; anonymous projected contours remain disabled.
- Focused `sketch/projection-source-selection.ts` owns menu-to-reference translation, using the Core transactional reference helper. Temporary menu indices are never persisted.
- Verification: 283 CAD tests and production typecheck/build pass. New mounted tests cover preview, atomic ID/source commit, cancellation, reorder/edit/native reopen and explicit broken-contour repair. Core remains at the last verified 301 tests (no Core changes in this unit). Individual segment/vertex references, mixed authored/projected sketches and live browser acceptance remain open.


## Driving diameter dimensions — 2026-09-09

- Sketch constraints/ribbon now include Diameter for circles and circular arcs. The native solver stores the displayed diameter in millimeters and drives twice the circle radius. Positive finite values are required; dimension links use the literal displayed length value.
- Circle-to-arc splitting retains diameter constraints. Existing radius-setting operations update a diameter driver with twice the requested radius rather than adding a competing radius constraint. The constraint panel supports initial application and editing of saved diameter values.
- Verification: 304 Core / 284 CAD tests pass; Core check and CAD production typecheck/build pass. Tests cover fixed-center diameter edits after serialization, radius-tool reuse, invalid values, split arcs, linked dimensions and mounted diameter creation/native save. Full graphical dimension placement, other dimension variants and live browser acceptance remain open.


## Independent X/Y distance dimensions — 2026-09-09

- Sketch constraints now include Horizontal distance and Vertical distance, each driving the signed coordinate difference B minus A in millimeters. Zero and negative values are supported. These are independent from straight-line distance and participate in native length-dimension links.
- The constraint panel/ribbon exposes both tools with explicit direction hints and editable saved values. Multiword constraint labels now display spaces in the tool selector/ribbon.
- Verification: 306 Core / 285 CAD tests pass; Core check and CAD production typecheck/build pass. Tests cover independent X/Y edits, zero/negative distances, fixed reference points, fully defined point state, invalid geometry/value rejection and mounted native save. Full graphical dimension placement and live browser parity remain open.


## Canvas dimension annotations — 2026-09-09

- Saved radius, diameter, length, point distance and X/Y distance dimensions are now drawn on the 2D sketch canvas. Labels resolve canonical driver values, show millimeters and mark linked dimensions. Automatic label positions are presentation-only.
- Clicking a label or activating it with Enter/Space focuses the matching saved dimension input. Pointerdown/click propagation is stopped so annotation editing does not create or select geometry. Updates rebuild the geometry and annotation through the existing constraint commit path.
- `sketch/dimension-annotations.ts` owns rendering; Core still owns dimension values and referenced geometry. Theme variables style the annotations.
- Verification: 287 CAD tests and production typecheck/build pass. Mounted tests cover annotation click → focused editor → changed diameter/model/native save and linked signed axis labels. Core unchanged (last verified 306 tests). Draggable placement, dimension leaders/extension-line polish, angle/offset/slot annotations and live browser visual acceptance remain open.


## Angular annotations and axis extension guides — 2026-09-09

- Saved line-angle dimensions now show a signed degree label and arc centered at the supporting lines' intersection. Parallel lines use a finite fallback anchor; zero-length lines are excluded. The shared annotation activation opens the canonical saved value editor.
- X/Y dimension lines are offset from their source geometry with extension guides back to both points. Layout remains automatic and does not alter geometry or persisted dimensional values.
- `sketch/angular-dimension-layout.ts` owns the presentation geometry. Verification: 290 CAD tests and production typecheck/build pass, covering positive/negative arc direction, intersecting/parallel/invalid references, angle labels, extension guides and nonmutation. Core unchanged (last verified 306 tests). Manual placement, overlap handling, offset/slot annotations and live browser visual acceptance remain open.


## Offset and slot-width annotations — 2026-09-09

- Saved offset and slot dimensions now have selectable canvas annotations. Offset uses the canonical signed distance handle; slot width spans both sides of the centerline and displays the full width. No geometry/measurement formulas are duplicated from Core.
- Verification: 292 CAD tests and production typecheck/build pass. Tests cover negative offset direction, full-width span, rendered values and Enter-key activation without forwarding the keyboard gesture to the canvas. Core unchanged (last verified 306 tests). Browser discovery returned no connections; live visual acceptance, manual placement and overlap handling remain open.


## Manual dimension-label positions — 2026-09-09

- Dimension labels can be dragged within the sketch canvas. Release commits one presentation-only undo step; Escape/pointer cancellation restores the original position. Dragging captures the pointer and keyboard focus, and consumes the following click so a drag does not open an editor or place geometry. Ordinary label clicks still edit the value.
- Native Part documents now store optional `sketchPresentation[featureId].dimensionLabelPositionsMillimeters`, keyed by constraint ID. The format validator requires finite coordinate pairs. Solver/kernel geometry never consumes this metadata. Sketch history includes positions, save prunes removed constraint IDs, and reopening restores placement.
- Verification: 308 Core / 293 CAD tests pass; Core check and CAD production build pass. The final focus adjustment was additionally verified with all 110 mounted workspace tests. Tests cover metadata validation/roundtrip, dragging, undo/redo, cancellation, native reopen and unchanged geometry.
- Leader/extension geometry still uses automatic layout; only label placement is manual. Leader tracking, overlap handling, broader parity and live browser visual acceptance remain open.


## Manual label connector tracking — 2026-09-09

- Manually placed dimension labels now connect to their measurement guide. Connectors update during drag preview, restore/remove on cancellation and undo, and rebuild from current geometry after edits or reopening.
- `sketch/dimension-label-leader.ts` owns the SVG presentation update shared by rendering and dragging. No connector coordinates are persisted; only the label position remains saved metadata.
- Verification: 294 CAD tests and production typecheck/build pass. Mounted tests cover connector endpoints after geometry changes and drag/undo/cancel behavior. Core unchanged (last verified 308 tests). Dimension-line relocation, automatic overlap avoidance and live browser visual acceptance remain open.


## X/Y dimension-line relocation — 2026-09-09

- Moving a horizontal/vertical distance label now relocates its measurement line and both extension guides during preview and after native reopen. Original source endpoints remain attached to geometry. Cancelling restores the original guide layout.
- `sketch/axis-dimension-layout.ts` derives SVG guide positions from current label placement; no extra layout truth is persisted. Other dimension types retain their existing connectors.
- Verification: 296 CAD tests and production typecheck/build pass. Tests cover saved X/Y placement, source attachment, live drag relocation and cancellation. Core unchanged (last verified 308 tests). Non-axis dimension-line relocation, overlap avoidance and live browser visual acceptance remain open.


## Aligned length/distance guide relocation — 2026-09-09

- Length and point-to-point distance annotations now have offset measurement lines and endpoint extension guides. Manual label placement relocates the dimension line perpendicular to its measured direction, preserving parallelism and measured span for diagonal geometry.
- Generalized `axis-dimension-layout.ts` to `linear-dimension-layout.ts`; X/Y and aligned layouts share the same presentation update path used during drag/restore.
- Verification: 297 CAD tests and production typecheck/build pass. Tests cover length and point-distance layouts on both sides of diagonal geometry, preserved span/parallelism and original source attachments. Core unchanged (last verified 308 tests). Angular/radial placement refinement, overlap handling and live browser acceptance remain open.


## Angular and radial manual placement — 2026-09-09

- Angular measurement arcs now expand/contract with label distance while retaining the measured line directions. Radius/diameter guides orient toward manually placed labels; partial-arc guides clamp to the visible sweep when the label lies outside it.
- `sketch/curved-dimension-layout.ts` handles render-time layout only and restores original graphics on cancellation. Connectors attach to the relocated radial endpoint or angular arc, not a stale guide position.
- Verification: 299 CAD tests and production build passed; an additional cancellation test was then added and all 12 canvas-renderer tests passed. Coverage includes angle arc radius, radial guide direction, partial-arc clipping and restoration. Core unchanged (last verified 308 tests). Overlap avoidance, broader sketch parity and live browser visual acceptance remain open.


## Automatic dimension-label spacing — 2026-09-09

- Automatic dimension labels now reserve space around manually positioned labels and move apart when their padded label bounds overlap. Layout is deterministic, recomputed on render and never saved over manual metadata. Associated measurement guides/connectors update after automatic movement.
- `sketch/dimension-label-spacing.ts` uses browser SVG text bounds when available, with an estimated fallback for hidden/headless rendering. Dense layouts can place labels above the existing label area; viewport fitting and geometry/leader collision avoidance remain incomplete. Manually overlapping labels are intentionally left in their chosen positions.
- Verification: 301 CAD tests and production typecheck/build pass. Tests cover label separation, pinned manual placement, deterministic rerender and unchanged drawing/metadata. Core unchanged (last verified 308 tests). Live browser visual acceptance and broader sketch parity remain open.


## Reference dimensions — 2026-09-09

- Length, point distance, X/Y distance, radius, diameter and angle dimensions can now be created as Reference dimension (measurement only). Native constraints store `reference: true` without a literal value or driver link. Core measures current geometry and contributes no solver equations.
- Reference values are read-only in the constraint panel and parenthesized on the canvas. They update after geometry changes. They cannot drive another dimension, and the radius-setting tool adds/updates a driving constraint rather than trying to edit a reference measurement.
- `solver/measured-dimension.ts` owns geometric measurement; no copied measured value is persisted. Verification: 311 Core / 302 CAD tests, Core check and CAD production build pass. Tests cover unchanged DOF, live measurement after driving edits, native save, signed axes/angles and invalid driver/value rejection.
- Reference offset/slot measurement, driving/reference conversion UI and full browser visual acceptance remain open, along with broader sketch parity.


## Driving/reference dimension conversion — 2026-09-09

- Saved supported dimensions now expose Make reference / Make driving controls. Converting to reference removes driving values/links while preserving ID and geometry; converting back takes the current measurement as its driving value. Label metadata stays attached through the unchanged ID.
- Direct dependent dimensions of a converted driver retain their current numeric values as independent drivers. Their own downstream links remain intact. The UI explains this behavior after conversion. Existing Update action placement remains unchanged.
- Core `operations/dimension-reference.ts` owns the atomic conversion. Verification: 313 Core / 303 CAD tests, Core check and CAD production build pass. Tests cover dependency-chain values, stable identity, current measured value, idempotence, invalid IDs and mounted undo/redo/native save.
- Reference offset/slot types, broader parity and live browser visual acceptance remain open.


### 2026-09-09 — Point-to-line distance

Implemented driving/reference perpendicular point-to-line distance in either selection order, sharing Core measurement geometry with canvas annotations. Infinite-line semantics and degenerate rejection are explicit. 315 Core / 304 CAD tests, Core check and CAD build pass. Browser acceptance and broader sketch parity remain open.

### 2026-09-09 — Parallel-line dimensions

Driving distance now constrains two lines to parallelism and perpendicular spacing; reference dimensions require parallel lines. Shared Core geometry drives canvas annotations. 318 Core / 306 CAD tests, Core check/CAD build pass, including mounted editing/undo/native persistence. Browser acceptance and broader parity remain open.

### 2026-09-09 — Selected-entity DOF

Implemented optional entity mobility analysis using the complete constraint Jacobian and geometric observables, with mounted selection readout and deselection clearing. 320 Core / 307 CAD tests, Core check/CAD build pass. Canvas state colors, singular robustness and live browser workflows remain open; browser discovery returned `[]`.

### 2026-09-09 — Entity constraint colors

Implemented token-based per-vertex, circle, segment and Bézier-control colors with Core batched mobility analysis. Fills/construction/selection stay separate; SVG state labels complement the selection readout. 321 Core / 309 CAD tests, Core check/CAD build pass. Browser visual acceptance and numerical singular/scaling limits remain open.

### 2026-09-09 — Associative pattern geometry

New linear/circular instances persist generated Core pattern relations and follow source geometry edits. Solver, native reopening and mounted source dimension/undo workflow verified: 324 Core / 310 CAD tests, Core check/CAD build pass. Instance detachment is supported by relation removal. Editable group controls, topology remapping, live mirror axes and browser acceptance remain open.

### 2026-09-09 — Associative mirror and live axis

Fixed-coordinate and live-line mirrors now preserve geometry linkage through solver edits and native persistence. The axis selector excludes its contour; conflicting moves reject. 326 Core / 311 CAD tests, Core check/CAD build pass. Edge-level selection within the axis contour, post-creation controls, topology remapping and browser workflows remain open.

### 2026-09-09 — Saved mirror-axis editing

Saved mirror relations support live-line reassignment or fixed-coordinate editing with stable identity and undo. Focused Core operation and CAD editor; 328 Core / 312 CAD tests, Core check/CAD build pass. Group-level controls, topology remapping and browser acceptance remain open.

### 2026-09-09 — Shared pattern settings/editing

New groups use canonical definitions and derived instance transforms. Saved linear spacing and circular center/step edits retain IDs and support cancel/undo/native save. 330 Core / 313 CAD tests, Core check/CAD build pass. Count edits reject explicitly; legacy ungrouped relations are retained without inferred grouping. Count remapping, suppression, topology and browser workflows remain open.

### 2026-09-09 — Pattern count editing

Grouped linear/circular count edits now add/remove linked instances and preserve retained grid identities. Dependency guards and existing reference remapping protect sketch constraints. 333 Core / 314 CAD tests, Core check/CAD build pass. Partial detachment rejects until repair exists; suppression, edge-level selection/topology and browser acceptance remain open.

### 2026-09-09 — Pattern membership repair

Partially detached or deleted slots can be restored as new linked instances while detached geometry stays untouched. Core repair and mounted undo/native persistence verified: 335 Core / 315 CAD tests, Core check/CAD build pass. Fully detached source membership is not inferred. Suppression, edge selection/topology and browser acceptance remain open.

### 2026-09-09 — Pattern-instance suppression

Individual grouped source/instance contours can be suppressed and restored from current source geometry while retaining membership and identity. Count edits/repair respect suppression. 338 Core / 316 CAD tests, Core check/CAD build pass; final identity regression verified in Core after CAD tests. Whole-placement batch controls, edge/topology and browser acceptance remain open.

### 2026-09-09 — Whole-placement controls

Group editors expose atomic multi-contour placement suppression/restoration with mixed-state counts. 340 Core / 317 CAD tests, Core check/CAD build pass, including late-member failure and single undo/native save. Edge-level tools, topology/manipulators and browser acceptance remain open.

### 2026-09-09 — Selected-edge mirrors

Edge-list mirror selection creates live segment relations, supports a distinct same-contour axis and keeps source edit propagation. 342 Core / 318 CAD tests, Core check/CAD build pass. Direct viewport selection, joining copied edges, selected-edge grouped patterns/topology and browser acceptance remain open. Browser list remains empty.

### 2026-09-09 — Mirror canvas source picking

Canvas picking toggles source edges/contours, excludes the live axis and synchronizes list/highlights/preview. 319 CAD tests, Core check/CAD build pass, including mounted cancel/reopen/apply/save. Core geometry unchanged. Live browser visuals, joining and grouped edge patterns/topology remain open.

### 2026-09-09 — Selected-edge grouped patterns

Closed the selected-source gap for linear/circular groups: canvas/list edge selection, separate memberships for edges in the same contour, count edits, repair, suppression, and persisted references. Shared selection UI extracted to `source-control.ts` and `source-selection.ts`; identity bookkeeping is in Core `solver/pattern-source-key.ts`. Added 3 Core tests and 1 mounted CAD workflow. Core 345 / CAD 320 pass; typecheck/build pass. Live browser remains unavailable. Other unchecked parity requirements remain open.

### 2026-09-09 — Ellipse center constraints

Added selectable construction centers linked by concentric constraints, plus ellipse center snapping/inference. Full ellipses preserve their shared shape while their center is dragged; native reopening retains the relation. Core owns center projection/inference/solving; the shared CAD `center-controls.ts` owns arc/ellipse center selection. Core 347 / CAD 321 tests pass; Core check passes. Broader ellipse axis dimensions and live browser acceptance remain open.

### 2026-09-09 — Ellipse axis construction handles

Full X/Y diameters are selectable construction lines tied to opposing ellipse quadrants. Existing line length/angle/alignment constraints now provide persistent axis sizing/orientation; repeat selection reuses the complete relation pair. Core tests cover both diameter changes, rotated geometry, native JSON and invalid selections; CAD mounted test covers selecting an axis, dimensioning, undo/redo and save. Core 349 / CAD 322 pass. This is not full ellipse or sketch parity.

### 2026-09-09 — Editable quadrant relationships

Saved quadrant constraints expose four local-axis endpoint choices. Core preserves relation identity, solves dependencies and rejects conflicting changes atomically. Added all-quadrant, native, invalid selection, conflict and mounted undo/save coverage. Existing quadrant tests now inspect the actual editor presence rather than concatenated button text. Full sketch parity remains open.

### 2026-09-09 — Circle-locus continuity

Circle/arc supporting loci now accept tangent and signed-curvature constraints against a fixed finite curve contact. Core geometric residuals handle either entity order and traversal direction; an exact cubic fixture solves to its osculating circle and conflicting radius rejects atomically. CAD creation/undo/native-save is tested. Core 354 / CAD 324, typecheck/build pass. This does not provide free sliding contact parameters for the other curve or enforce finite arc extents on locus refs.

### 2026-09-09 — Whole-spline symmetry

Exact Bézier control-point reflection now supports whole spline contours with a live line axis and persisted reverse correspondence. Matching segment count/closure is required; closed seams must correspond. Core tests cover native constrained control dragging in either direction and conflict/topology failures; mounted CAD tests cover reverse selection, undo and save. Core 356 / CAD 325 tests, Core check/CAD build pass. Full parity and real browser acceptance remain incomplete.

### 2026-09-09 — DXF anchors and snapping

DXF placement accepts custom millimeter anchors or source endpoint/center/midpoint/quadrant choices. Anchor-to-target rotation/scale uses existing Core transforms. Canvas targets snap to existing sketch geometry in screen-space tolerance, with optional snapping and Escape restore. Mounted regression covers transformed anchors, endpoint snapping, cancel, undo and native persistence. Snapping positions the import without creating target attachment constraints; other import gaps remain open.

### 2026-09-09 — DXF layer inclusion

Used model-space layers and counts can be inspected without decoding geometry, then selectively imported. Core validates structure and complete legacy polyline sequences before selected entity decoding; excluded unsupported layers no longer prevent importing supported layers. CAD preview, empty selection, undo and save tested. Core 359 / CAD 327 pass. Layer metadata is not persisted after import; layer styles, other DXF entities/OCS and browser acceptance remain open.

### 2026-09-09 — Extend point boundaries

Verified the official Extend reference describes lines/arcs extending to the nearest bounding point or edge: https://cad.onshape.com/help/Content/Sketch/extend.htm . Existing line/conic extension already considers cubic boundary curves; missing standalone point boundaries now participate, with exact locus checks and nearest-forward selection. Added Core geometry/conflict and mounted undo/save coverage. Core 362 / CAD 328, check/build pass. Cubic *source* extrapolation remains unimplemented and is not explicitly required by that tool page; do not confuse it with cubic boundary support. Automatic persistent boundary attachments and browser acceptance remain open.

### 2026-09-09 — Persistent Extend point attachments

Extend now creates/reuses coincidence when its new endpoint matches an authored standalone point. Native reopening and boundary-point dragging retain the connection; implicit centers and near misses do not attach. Geometry and relation share one undo step. Core 364 / CAD 328 tests and Core check pass. General curve-boundary attachments and live browser acceptance remain open.

### 2026-09-09 — Extend curve-boundary relations

Extended endpoints now retain line/conic locus coincidence or fixed-parameter cubic contact, after preferring explicit point boundaries. The parameter contact also supports stationary positions without allowing undefined tangent/normal directions. Core 367 / CAD 329 tests and Core check pass, including boundary edits, native roundtrip and UI undo/save. Supporting-locus attachments do not enforce finite extents after subsequent edits, and cubic contacts do not yet slide freely. Full parity/browser acceptance remain open.

### 2026-09-09 — Sliding contact parameters

Optional `SketchEntityRef.sliding` adds bounded relation-owned solver coordinates for coincidence/tangency/curvature/normal finite contacts. Geometry DOF removes parameter-only freedoms; dragging retains solved parameter state. CAD creation opts in, new Extend cubic attachments slide by default, old contacts remain fixed. Tests cover fixed-curve mobility, endpoint-to-interior movement, finite-bound conflicts, tangent solving, native reopening and mounted creation. Saved-contact mode editing, singular configurations and live acceptance remain open.

### 2026-09-09 — Saved contact mode controls

Each saved curve side can switch between fixed and sliding without recreating its constraint. Freezing retains the last solved parameter and geometry; DOF updates accordingly. Core mode operation and focused CAD editor tested through native roundtrip, drag, freeze, undo and save. Full parity and live browser acceptance remain open.

### 2026-09-09 — Split contact parameter remapping

Fixed and sliding finite contacts now map to their correct new segment with an affine parameter change for exact subdivision. IDs, modes and geometry are retained for coincidence/tangent/curvature/normal. Contacts at the split use the left piece; sliding stays within that piece. Whole-fit-spline and control-point topology still require separate handling. Core 375 / CAD 332, typecheck/build pass, including all curve types and mounted undo/save. Trim remapping and live browser acceptance remain open.

## Trim finite-contact checkpoint — 2026-09-09

Trim now remaps surviving curve contacts by retained parameter intervals, including closed-path seam changes; removed contacts drop with undo restoration. Endpoint contacts and fixed/sliding flags persist. Dedicated Core trim-contact.ts keeps mapping out of the UI controller. Core 380 / CAD 334 tests, typecheck/build pass; mounted trim/undo/native save verified. Whole-chain/control topology remapping and live browser workflows remain incomplete; this does not close the parity acceptance ledger.

## Extend finite-contact checkpoint — 2026-09-09

Existing contacts now retain their physical positions through line/circular-arc/elliptical-arc extension by affine parameter remapping. Both ends and sweep directions, fixed/sliding mode preservation, fixed-end conflicts, undo and native save are tested. Dedicated Core extension-contacts.ts owns the mapping. Core 382 / CAD 335 tests and check/build pass. Cubic source extension and full browser acceptance remain open; the acceptance ledger stays incomplete.

## Unified Trim checkpoint — 2026-09-09

Line-only and general Trim now share one implementation with separate picking policies. Removed obsolete constrained-line rejection and duplicate geometry/remapping code. Core 383 / CAD 335 tests, check/build pass; line-only picking with nearby point and retained finite contact covered. Full acceptance ledger remains open.

## Edge-on projection checkpoint — 2026-09-09

Analytic rank-one circle/ellipse/arc projection now yields bounded line geometry, preserving interior extrema and associative source updates. Focused collapsed-conic.ts owns extrema. Core 386 / CAD 336 tests, check/build pass, including mounted create/native reopen/source radius update. Nearly singular nonzero conics and other projection acceptance gaps remain open; full parity is not claimed.

## DXF planar OCS checkpoint — 2026-09-09

Negative-Z planar OCS import now maps circles/arcs/2D polylines correctly and distinguishes WCS ellipse centers/major axes and line/point/spline coordinates. Dedicated coordinates.ts reuses reflection math. Core 390 / CAD 337 tests, check/build pass, including mounted preview/undo/native save. Tilted OCS/elevation/thickness, remaining formats and browser acceptance remain open.

## Polygon side-count checkpoint — 2026-09-09

Inline side-count editing derives the existing constraint recipe and preserves sizing circles/dimensions, surviving point references and traversal. Conflicting topology attachments reject without mutation. Dedicated polygon-definition/polygon-sides/polygon-controls modules; no extra stored count. Core 394 / CAD 338 tests, check/build pass, including mounted undo/native save. Large-drag robustness, automatic changed-edge remapping and live acceptance remain open.

## Polygon attachment checkpoint — 2026-09-09

Side-count edits preserve surviving directed line loci, symmetry axes and finite contacts inside corresponding new segments. Exact geometry correspondence replaces index reuse; conflicting dimensions/disappearing geometry still reject. Core 396 / CAD 339 tests, check/build pass, including mounted undo/native save. Browser list remains empty; full parity remains incomplete.

## Polygon preview checkpoint — 2026-09-09

Side-count editing now previews Core candidate geometry in the sketch canvas before commit. Invalid counts clear/disable; Escape cancels; Enter applies; source changes invalidate the editor. CAD 340 tests and build/typecheck pass, including mounted nonmutation, undo and save checks. Live browser acceptance remains open.

## Circular slots checkpoint — 2026-09-09

Circular centerline slots create two exact concentric boundaries with one width driver, preview/handle, construction source and hole classification. The circle-source slot relation persists slotBoundary inner/outer. Core 400 / CAD 341 tests, check/build pass, including native radius/width edits and annular extrusion with an open bore. Noncircular closed chains, spline slots and browser acceptance remain open.

### 2026-09-09 — Closed line/arc slots verified

Closed chains now reuse exact offset geometry with linked inner/outer width relations. Tests cover both orientations, mixed line/arc chains, two-arc loops, invalid collapse, persistence, mounted preview/undo/edit and exact ring extrusion. Core 404 and CAD 342 tests pass; typecheck/build pass. Arc-center/origin snaps and driving/reference dimension workflows were also checked against their existing implementation and tests. Full parity and live browser acceptance remain open.

### 2026-09-09 — Offset collinear contact guard

Straight-chain offset validation rejects overlapping or touching collinear nonadjacent output edges. Core 407 tests and typecheck pass, including finite interval and distance-tolerance cases. Topology repair remains outstanding. Browser availability was checked again: no connected browser; live acceptance remains unverified.

### 2026-09-09 — Core cubic point insertion

Added exact cubic subdivision with a saved curvature-continuity relation at the inserted join. Existing finite contacts remap, repeated insertion retains earlier joins, and inserted points can move through the constraint solver after serialization. Core 410 tests/typecheck pass. This is not full spline-tool acceptance: the new operation still needs ribbon/pointer/preview/undo UI integration; shape-linked fit-spline insertion and arbitrary-degree/knot/control remapping remain open.

### 2026-09-09 — Cubic insertion ribbon and interaction

Insert spline point is available in the spline dropdown with a pointer preview marker, standard click placement, undo/redo and native reopen. Mounted tests cover the valid flow and endpoint rejection without a history change. Command registration and catalog placement are checked. The prior Core-only UI TODO is resolved for cubic spans; fit-spline/control remapping, arbitrary knots/degrees and live browser acceptance remain open.

### 2026-09-09 — Fit-spline insertion

Natural and periodic fit splines now support exact point insertion using optional positive relative span intervals on the existing shape constraint. This closes the prior fit-spline insertion rejection. Point editing refits at retained parameter spacing; old files without intervals keep chord-length fitting. Core tests cover whole-curve preservation and saved constrained edits. Arbitrary-degree knot/control support, unsupported external control references and live browser acceptance remain open.

Fit insertion verification: Core 412 / CAD 346 tests, Core typecheck and CAD build pass. Mounted preview, undo/redo and native reopen preserve the stored intervals.

### 2026-09-09 — Spline tangent handles

Cubic spans expose linked construction start/end handles through the constraint panel. Standard dimensions drive their canonical endpoint/control vectors; Core tests cover fitted-spline shape preservation during handle adjustment. This adds selectable dimensionable handles, while richer direct manipulators, insertion with attached control references and live browser acceptance remain open.

### 2026-09-09 — Retained cubic control references

Split and insertion retain endpoint-relative control vectors using optional positive controlScale on references. Dimensioned handles and fixed controls survive subdivision, repeated insertion and native reopening. This closes the prior cubic control-reference rejection for these operations. Broader topology operations, arbitrary spline degrees and live browser acceptance remain open.

### 2026-09-09 — Mixed projection model and relinking

Optional authored geometry is stored separately on projection records. Rebuild combines live derived contours with independently solved authored contours; authored indices never depend on source topology. Relinking preserves this data and combined previews include it. Duplicate identities reject. Mixed editing, constraints to projected entities and live browser acceptance remain outstanding; this foundation alone does not satisfy mixed-sketch acceptance.

### 2026-09-09 — Mixed projection editor integration

Save and edit geometry opens standard sketch authoring over a live-derived read-only backdrop. Only authored geometry enters history and saved authored data; the projection source reference remains intact. CAD 351 tests/build pass, including undo/redo, native reopen, source change and cancel. Cross-projection snapping and constraints, stable projected entity selection and live browser acceptance remain open.

### 2026-09-09 — Projected constraint resolution

Added stable projected contour references to authored constraints and temporary fixed source geometry during solves. Native document validation resolves source context, and rebuild updates authored geometry after source edits. Missing IDs/conflicts fail rather than moving projected geometry. UI context/selection/snapping and stable subentity topology are still pending; full/browser parity remains open.

### 2026-09-09 — Editor projected-constraint context

Identified projected entities can be selected in constraint selectors in mixed sketches. Runtime context supports solving/rendering/editing without storing derived geometry. Mounted concentric-circle creation/undo/native/reopen/source-update is covered; serialization rejects leaked context. Pointer picking/snapping, unidentified source contour assignment and stable segment references remain pending. Full parity is not complete.

### 2026-09-09 — Projected pointer selection

Canvas picking supports identified projected points/edges/curve contacts, external highlights and read-only status. Source drag gestures reject; authored geometry wins overlapping picks. Interior contact parameters populate the constraint selectors. Pointer snapping/inference, source identity assignment and stable segment topology remain pending.

### 2026-09-09 — Persistent projected point snaps

Projected endpoints, centers and line/arc midpoints now snap and create external relations for newly placed vertices. Source updates propagate after save/reopen. Existing local attachments win; unidentified contours remain excluded until stable identity assignment is handled. Quadrant/locus snapping, stable segment topology and live browser acceptance remain open.

### 2026-09-09 — Whole-source contour identity assignment

Entire-sketch projection now assigns missing IDs at authored sources, following projection chains and preserving existing identities. IDs commit atomically on Save; cancellation does not alter sources. Legacy primitives become equivalent native drawings. This closes the unidentified whole-source contour gap for newly saved/relinked projections. Stable subentity identity through topology edits and live browser acceptance remain open.
