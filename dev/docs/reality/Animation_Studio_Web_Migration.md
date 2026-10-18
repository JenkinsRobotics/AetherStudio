# Anima Studio web migration inventory

## Current update — 2026-09-30

The native Swift archive was removed from the working tree on 2026-09-23;
`fb1cc1c3^` remains its reference tree. Earlier deletion/sign-off language below
is historical. Jonathan clarified that the demo is a **UI-only concept** and
that useful production behavior belongs separately in Aether Animation.

The latest pass restores camera/environment/material inspectors, native Hardware
cards and mapping editor, relation forms, Design properties, local collection
editing and interactive central-showcase controls. Shared panel stacking and
scrolling fixes apply through `@aether/ui`. Production Animation separately gains
canonical relation authoring and save/reload; no alternate evaluator was added.

See [the source-to-web matrix and browser evidence](../../../core/ui/gallery/NATIVE_PARITY.md#ui-only-migration-and-separate-production-adoption--2026-09-30).
Current launch: **Aether UI → Apps → Aether Animation Studio**, or
`?demo=animation-studio`. The older route remains an alias.
324 UI tests, 214 Python bridge/rig tests, 3 relation unit tests, UI typecheck and
UI/Animation/Map/CAD builds pass. Chrome covers all nine workspace routes and the
listed interactions. Exhaustive visual/state equivalence remains unverified;
backend absence in the concept demo is intentional, not a migration defect.

---

**Verification verdict, 2026-09-23: incomplete; Swift archive deletion is not approved by this audit.** Earlier completion wording referred to selected implementation work, not exhaustive migration parity. Nine reachable workspaces and 36 matching template titles do not establish functional or visual equivalence.

The archive remains the visual and interaction specification until its commands, states, widget variants and layouts have individually verified web equivalents. A workspace may be reached through the centered stage strip, character-type selector, or complete workspace menu. The table below records existing web surfaces, not fully preserved functionality.

## Showcase relocation — 2026-09-23

At Jonathan's request, UI Dev is now part of the **main Aether UI showcase**,
not an Anima app workspace. Its 36 templates, 26 state variants, native lab
navigation and local interactions remain under `core/ui/gallery/showcase/`.
They are classified across Elements, Widgets, Windows & Overlays, Workspace
Chrome, Apps, and Icons & Assets, alongside the preserved Anima/Atlas demo-kit
specimens. Existing main-gallery sections remain. This changes ownership and
navigation; it does not change the remaining native-fidelity caveats below.

## Remediation implemented — 2026-09-23

Launch **Aether UI → Apps → Concept applications → Anima Studio** (`?demo=anima-studio`). This work concerns the production-native interface port; the separate dark mockup at `?demo=anima-demo` belongs to the other implementation.

- Added the separate **26-variant / seven-family board**, including search, family filtering, size controls, selection and distinct populated/empty/disabled/status specimens. The existing **36-template / seven-section matrix** remains separate.
- Exported `CompactActionPanel`, `AppearanceInspector`, `ConfigurationInspector`, and `SequenceEditor` through `@aether/ui/concept-widgets`. The compact panel starts Dark, Appearance computes RGB and updates opacity/tessellation, and configuration cancel restores its accepted checkpoint. The gallery supplies all **ten** archived mate kinds, connectors and units, plus the native two-column live-panel/tuning-controls lab with synchronized state; the shared widget owns no solver semantics.
- Timeline Design B has Dopesheet, Motion Curves and Waypoint Lanes with row/key editing, markers and playback. Ribbon Loop uses the same state as the timeline; previous/next key seeks actual key times. Both the standalone Nodes route and the UI Dev Nodes specimen advance their performance playhead.
- Imported a source snapshot of all **172 tools** in the five groups in `WorkspaceRibbonCatalog.swift` into `AnimaNativeRibbon.ts`. Native descriptors without actions are unavailable instead of reporting a fake selection action. The Nodes ribbon now exposes its complete 51-tool catalog. Bespoke Modeling/UI Dev/Design controls remain separate.
- Header Save/Undo/Redo/download, Preview and guide now respond. Local concept parts autosave and restore; source media previews remain tab-local and are explicitly labeled. Imported parts clear the collection filter so the new row is visible. The navigator, table, inspector and sample viewport share the parts list.
- Modeling includes Table and Exploded modes, a real Three.js sample scene, picking, orbit, ViewCube and material preview. Primitive commands create local sample rows; position fields update that sample. UI Dev viewport/triad cards use the same renderer and Three.js transform controls rather than inert CSS handles. This is **fixture geometry**, not the original imported CAD model or a CAD engine.
- Expanded Settings to the native field families: import units/frame rate, design preset/accent, density/chrome/status bar, grid/origin/ViewCube, materials/edges, lighting, navigation and optional workspace tabs. Device preferences persist. Toolbar settings and the settings window synchronize. Backend-specific defaults are retained as reference controls and are labeled as such; not every native renderer effect is implemented.
- Fixed invalid CSS tokens that were leaving panels/fields transparent. Added a session-scoped palette transcribed from `StudioDesignProfile.standard` and `.standardLight`, including source accent and surface hierarchy; it applies to demo portals and is removed on exit. Normal product themes are not changed.
- Removed the incorrect wide-card rule. Restored adaptive columns and source-sized scaled previews for mate/import/layout/theme/template labs; corrected card typography and the ribbon's 620×120 descriptor.
- Removed false live-engine/telemetry labels. Face and Pixel Pet time controls affect the local preview; Pixel Pet and Dino use the source's actual color-wheel/GIF assets. VR camera remains unavailable as in the reference.

## Current verification and remaining sign-off gates

- **248 tests / 62 files passed**, including eleven new regression tests for the audit failures, inspector behavior, settings synchronization, autosave/undo/redo, Timeline Design B and planned commands. These are automated React tests, not 248 visual-parity checks.
- Aether UI typecheck and production build pass; Animation web production build passes. Existing chunk-size/externalized HarfBuzz notices and unrelated React test `act` notices remain.
- Browser discovery still returns an empty list. **No rendered browser screenshots, light/dark comparison, narrow-window walkthrough, native popup geometry comparison, or WebGL pointer walkthrough were verified in this session.**
- Engine-connected import/evaluation, the exact original CAD model, native desktop file-location behavior, renderer-specific options and hardware services are not provided by this standalone UI concept. Those differences are explicit, not claimed as migrated engine capabilities.
- The remaining static/abbreviated native labs and complete settings/backend behavior still need individual visual/interaction review; inventory counts alone do not close that gate. Keep the Swift reference until that comparison is complete. This pass is not a blanket “every tool and widget is identical” sign-off.

## Initial audit results (before the remediation above)

- Current baseline: 232 tests passed across 60 files. These include another contributor's newly added demo widget tests; they are not 232 migration-parity checks.
- Four additional temporary React interaction tests all failed: missing Variants board, incomplete mate-type list, disconnected ribbon Loop, and stationary Nodes playback. Exact reproduction steps are below. The temporary audit test was removed after recording results; no application implementation changed in this audit.
- Typecheck failed: first on missing `AnimaDemoApp`, then, after that file arrived during the audit, on its five missing workspace imports (`Character`, `RigAnimate`, `ShowHardware`, `Design`, `UIKit`). `src/anima-demo/graph.tsx:93` also passes unsupported `style` to `Glyph`.
- Production build failed on the unresolved `AnimaDemoApp` import initially, then on `./workspaces/Character` at the final recheck. These files belong to the other contributor's active `anima-demo` claim. This is the observed checkout state during the audit, not an attribution to the production-Anima migration.
- A scripted source inventory matched all 36 archived matrix titles to web cards and counted all nine product workspace routes. The source also has a separate 26-entry variant catalog; it has no equivalent route/rendering in the current Anima UI Dev page.
- Browser selection failed, documented recovery returned an empty browser list. No live screenshots, pixel comparison, responsive rendering, native popup comparison, or complete light/dark review were performed.

## Initial source gaps (historical reproduction evidence)

These were the source-backed findings before remediation. The current implementation and remaining gates are recorded above.

| Area | Evidence in the current port | Required before claiming parity |
|---|---|---|
| Ribbon command behavior | `AnimaStudioDemo.tsx:355` handles only two Assets import launchers and several transport IDs specially; most commands fall through to selection/status text. All 232 catalog entries are enabled, including source-planned tools. | Map each source command to its actual demo interaction or preserve its source disabled/planned state. Engine-only functionality must remain honest and outside shared UI semantics. |
| Header actions | Project file commands, Save, Undo, Redo, Preview and guide buttons have no handlers (`AnimaStudioDemo.tsx:416`). SAVED is static. | Restore the relevant local demo flows and state; do not imply saved/connected behavior without it. |
| Animate transport | Ribbon Loop does not call `setLooping`; ribbon previous/next key steps one second, while timeline controls seek actual keys. | Both presentations must use the same state and seek operations. |
| Standalone Nodes | Its Play toggles `playing`, but the timer at `AnimaStudioDemo.tsx:320` only runs for Animate and Show. | Nodes playback must advance its shared performance playhead. |
| UI Dev Variants | `filterIDs` has no `variants` case and falls back to all 36 templates. Archive `UIDevVariantBoardCatalog.swift` declares 26 separate variants. | Port the distinct variant families, state presentations and navigation. |
| Mate specimen | Labeled eight-kind editor, but its Type picker offers only Fastened/Revolute/Slider/Ball and Apply has no action (`AnimaUIDevSpecimens.tsx:46`). The archived lab uses `MateCreationToolKind.allCases`, which now has ten entries; the eight-kind caption is stale in the archive too. | Preserve all ten source kinds and the interactive lab controls; correct the stale caption. |
| Timeline Design B | Mode selection changes a data attribute around the same child Timeline; header actions have no handlers (`AnimaUIDevSpecimens.tsx:160`). | Port the distinct curve/waypoint/dopesheet views and their source interactions. |
| Workspace panels | Appearance is a sentence; View and Environment are single selectors disconnected from previews; several left panels are text only (`AnimaStudioDemo.tsx:389`). | Bring full source panel content and interactions into the app, not only specimen cards. |
| Settings | Layout and outer-edge preferences work. Other pages use a few representative controls and omit source settings for themes, import units, lighting, renderer quality, navigation, and developer options. | Compare and port each page from `AnimaStudioSettingsView.swift`; verify actual effects/persistence. |
| 2D / VR | Local CSS face previews claim “Live from AnimaCore”; 2D time does not affect the preview and all subjects reuse the same face. The source renders distinct subjects through the bridge. | Preserve distinguishable preview states and accurate demo labels; explicitly document any intentional engine substitution. Camera capture was already disabled in Swift and is not counted as a newly missing feature. |
| 3D Modeling | `ModelingSurface` is a CSS silhouette with a tool caption; the reference's Table/Exploded presentations are absent. | Restore the source view modes, content and interactions, even when backed by local demo fixtures. |
| Specimen layout | Shared `SpecimenBoard` forces ideal widths >=700 into full-width rows. Archived `UIDevTemplateMatrixView.swift:342` uses adaptive columns for every template, without that rule. Floating Tool Ribbon ideal width is 720 in web versus 620 in Swift. | Reconcile with the actual native matrix and screenshots. The previous wide-card change is not evidence of fidelity. |
| Compact / Appearance details | Compact panel local commands and theme toggle work, but default theme is Light versus Dark in source. Appearance RGB becomes “Selected color” after a swatch change; Tessellation has an empty change handler. | Verify visual defaults and clearly distinguish static source examples from functional controls. Source appearance used constant bindings; do not claim newly added web behavior is a verified faithful port. |
| Library availability | `ConceptWidgets.tsx` exports seven composites; Compact Action Panel, Appearance specimen and many other compositions remain gallery-local. | Inventory which concepts must become reusable widget/variant exports and verify consumption outside this demo. |

## Reproduced interaction failures

These were executed with React Testing Library and Vitest against the current components (not a browser):

1. Open UI Dev, click **Variants**. Expected the archived separate 26-variant board; observed the same 36 template cards.
2. Open UI Dev, inspect **Mate Editor → Type**. The temporary test used the advertised eight kinds; observed four options. Subsequent inspection of the actual source enum revealed ten kinds, making the missing coverage larger than the caption-based test asserted.
3. Open Animate, choose **Transport**, click the ribbon **Loop**. Expected the timeline Loop `aria-pressed` to toggle; observed `true` before and after.
4. Choose **Nodes** through All Anima workspaces, click **Play show**, advance test time by one second. Expected the performance playhead to move; observed the same `left: 26.666666666666668%` before and after.

The source contains planned tools and static specimens too. Completion requires preserving those distinctions, not inventing an engine implementation for every icon. These findings establish that blanket “every tool/widget is migrated and verified” confirmation would be false.

## Product workspaces

| Archived `StudioWorkspaceKind` | Web route | Web surface | Existing presentation / interaction (partial) |
|---|---|---|---|
| Assets | `assets` | `AssetsSurface` | searchable/sortable/selectable table, gallery and 3D modes, import flow |
| Rig / 3D Modeling | `modeling` | `AnimaModelPreview` / Table | contextual Build/Mates/Relations/Inspect ribbon and selectable project content |
| Animate | `animate` | `AnimaAnimateWorkspace` | transport, timecode, tracks, keys, dope-sheet/curves/3D switching |
| Canvas 2D | `canvas2d` | `AnimaCanvas2DWorkspace` | subject picker, rendered face preview and live face parameters |
| VR | `vr` | `AnimaVRWorkspace` | avatar preview, tracker state and live blendshape controls |
| Show | `show` | `AnimaShowWorkspace` | node/table/3D views and the shared performance playhead |
| Nodes | `nodes` | `AnimaNodeWorkspace` | searchable library, selection, dragging, connection, inspection and performance strip |
| Hardware | `hardware` | `HardwareSurface` | selectable device table and complete hardware ribbon families |
| Design | `design` | `AnimaDesignWorkspace` | contextual Design/Sketch/Inspect tools and click-to-place sandbox feature cards |

UI Dev remains a development workspace beside those nine product workspaces. Its 36-card, seven-section matrix is exposed as `ui-dev`; it is not counted as a product workspace.

## Shared chrome and window behavior already implemented

- `DocumentBar`, `AnimaToolRibbon`, `WorkspaceShell`, and `StatusBar` expose the document/stage/ribbon/workspace/status hierarchy; exact geometry and visual parity remain unverified.
- Floating layout overlays the canvas. Docked layout participates in layout and pushes/reduces the center workspace. Canvas layout hides chrome behind edge reveal regions.
- The modeless `Anima Studio Settings` utility has macOS titlebar controls, grouped settings navigation, drag/keyboard movement, saved layout selection, and the panel-edge relationship switch.
- Each panel retains dock, float, hide, drag, keyboard move, and near-edge restack behavior.
- Toolbar density and shape preferences remain device-local and provide Compact, Standard, Expanded and Square, Soft, Rounded variants.

## UI Dev implementation inventory (not parity sign-off)

- Specimens use adaptive columns; source-scaled labs keep their design dimensions inside a clipped scaled preview.
- Compact Action Panel follows `UIDevCompactTabPanelWidget`: New Query and Settings command rows, shortcuts, immediate Light/Dark switch and result text.
- Appearance follows the archived inspector hierarchy: Palette/Mixer, color selection, Hex/RGB, opacity and tessellation.
- Floating Tool Ribbon retains category navigation, separated command groups, icon/label tools and group captions.
- Tests cover both the 36-card matrix and 26-variant board, compact-panel interaction, nine-workspace reachability, panel settings, source-planned availability and transport regressions. They do not establish pixel equivalence.

The web concept intentionally keeps gallery-local state. It demonstrates the UI contracts and interactions without creating a second animation engine; canonical project, scene, rig, timeline, hardware, and node meaning remains in AnimaCore.
