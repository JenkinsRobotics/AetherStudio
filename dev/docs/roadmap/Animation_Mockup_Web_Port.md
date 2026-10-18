# Aether Animation Mockup — web port

**Status: built and accepted, 2026-09-23.** Jonathan signed off on the port the
same day and the Swift source at `dev/archive/AnimaStudio Demo` was removed
(68 tracked files, in git history before this change); this port is now the
reference for the demo's shell, workspaces and widgets. Launchable from the Aether UI gallery's Concept
apps directory at `core/ui/gallery/?demo=animation-mockup` (served by the Studio host
at `/ui/?demo=animation-mockup`). This is the port of `dev/archive/AnimaStudio Demo`
— the dark-theme, UI-only SwiftUI mockup — **not** the production Aether Animation Studio
app Codex is porting (`core/ui/gallery/AnimationStudioDemo.tsx`). The two are
different apps and stay separate on purpose.

Jonathan, 2026-09-23: *"import over the demo app 'anima studio demo' 1:1 into
aether ui … import over all the ui widgets and convert them to our new standards.
we do not want to delete widgets we already have … later we will evaluate and
list all the variants of the widgets and consolidate."*

## Central showcase ownership — 2026-09-23

Jonathan requested that the demos' UI Kit pages become part of Aether UI's
main showcase. `gallery/showcase/AnimaKit.tsx` and `AtlasKit.tsx` now own those
specimens (79 Anima/Rex/CodexUI + 29 Atlas), classified into the existing six
gallery tabs. Their original source variants and interactions remain; the
UI Kit tabs were removed from demo navigation. Old UI Kit deep links redirect
to the main Widgets tab. Native Anima's 36 templates and 26 variants join the
same showcase. No existing main-gallery section or widget was deleted.

## What was ported

Source of truth was `dev/archive/AnimaStudio Demo/Sources/AnimationStudioDemo/`
(11,004 lines of Swift, now deleted; the `Renderers/` and GeomKit engine were **not** ported
— the viewport is the mockup's own `ViewportMock`, which is what the UI Kit
showed anyway).

| Swift | Web | Notes |
|---|---|---|
| `Design.swift` tokens, `Theme.swift` | `core/ui/src/kit/theme.css` | Dark default, light, five accents, all scoped under `[data-aether-kit]`. The suite's `--aether-*` tokens are re-pointed inside the scope so shared menus/popovers match. |
| SF Symbols (171 names) | `Sym` = `AetherIcon` from the system pack `core/assets/icons` (2026-09-24: every glyph exported into the pack under pack names; the inline SF table is gone) |
| `Layout.swift`, `ToolRibbon.swift` state, `PanelStackState`, `TreeModel.swift` | `state.ts` (+13 tests) | Pure functions; hooks are thin wrappers. |
| `Design.swift`, `Widgets.swift`, `PanelWidgets.swift`, `TreeRow.swift`, `NodeWidgets.swift` inputs, `App.swift` chrome | `widgets.tsx` | 40 widgets. |
| `ViewportMock`, `PerspectiveGrid`, `EmptyStage`, `RadialMenu`, `CenterTray`, `AxisGizmo`, `ViewCube` (same projection math), `MoveGizmo`, `MaterialSphere`, `VisualizationIcon` | `viewport.tsx` | |
| `Timeline.swift`, `Graph.swift`, node/feature/document widgets, `CurveInspector`, `MateInspector`, `PerformanceHUD`, `EnvironmentPanel`, `VisualizationPanel`, `PartPropertiesPanel`, `NewCharacterDialog`, `SettingsKit.swift` | `graph.tsx` | |
| `TreeView.swift` | `tree.tsx` | Drag-and-drop reorder / move-into-folder, group, rename, delete, visibility, context menu. |
| `WorkspaceShell.swift`, `Sidebars.swift` | `shell.tsx` | `KitShellProvider`, `StackRail`, `StackCard`, `PanelSidebar` (header drag → reorder or tear-off), `ToolSidebar` (Compact = icons; Standard = grouped with headings and category tabs; Expanded = that plus the boxed workspace dropdown, Jonathan 2026-09-24; docked forces Expanded), `ToolRibbon`, `PromptBar`, `ViewTabContent`, `WorkspaceScaffold` (floating / docked / canvas with edge reveal, floating cards clamped to the canvas, centre switcher, zone overlay). |
| `App.swift` Shell/TopBar/StatusBar, `Settings.swift` | `core/ui/gallery/animation-mockup/AnimaDemoApp.tsx` | Header breakpoints 1320 / 1060 / 880, overflow menu, Live popover, layout button (click cycles, caret picks), the seven settings pages. |
| `Workspaces/*.swift` | `gallery/animation-mockup/workspaces/*.tsx` | Home (three columns), Character (+ Gallery/Table centre), Rig (+ asset library), Animate (dope sheet drives the mates), Show (node graph), Hardware (wiring + live servo tracks), Design (category ribbon, place-and-drag sandbox), UI Kit. |
| `DemoModel` / `ProjectModel` / `RigModel` / … | `gallery/animation-mockup/model.tsx` | Seeded with a representative character (four parts, three mates, one clip) since there is no STEP import; "Import Model" adds a sample part behind the `ProgressCard` overlay. Tool catalogs are verbatim. |

Library entry: `@aether/ui/kit` (`core/ui/src/Kit.tsx`).
Nothing was added to the main `@aether/ui` index, and no existing widget was
changed.

## Widget variants to reconcile (the consolidation list)

Names that now exist twice, as different designs. The demo's version is the
*Anima* column; nothing here decides which survives.

| Concept | `@aether/ui` today | Anima demo variant |
|---|---|---|
| Status bar | `StatusBar` (24px, `StatusDot`) | `StatusBar` (24pt, accent dot + hairline groups, engine/theme/kernel) |
| Search field | `SearchField` (scopes, `onQueryChange`) | `SearchField` (inset box, clear button) |
| Document tabs | `DocumentTabs` (split direction, closable) | `DocumentTabs` (underline strip) and `DocumentTabBar` (floating pill) |
| Slider | `Slider` (unit, value readout) | `Range`, `LabeledSlider`, `SettingsSlider` |
| Segmented control | `SegmentedControl` | `Segmented`, `SegmentedIcons`, `InspectorTabs`, `ChipPicker` |
| Toggle | `Checkbox` | `Switch`, `ToggleRow`, `ToggleLine`, `SettingsCheck` |
| Tree row / tree | `Tree`, `TreePanel` | `TreeRow`, `TreeView` (+ `TreeState`) |
| List row | `ListBox` | `Row`, `ListRow` |
| Panel container | `DockPanel`, `PanelHeading` | `Panel`, `PanelCard`, `StackCard` |
| Layout shell | `WorkspaceShell`, `RibbonWorkspaceShell` | `WorkspaceScaffold` + `PanelSidebar` + `StackRail` |
| Tool bar | `Ribbon`, `WorkspaceRibbon` | `ToolSidebar` (3 densities), `ToolRibbon` |
| Layout preset button | `LayoutPresetButton` | header layout button (cycle + caret menu) |
| Toast / notification | `ToastStack`, `NotificationCenter` | `Toast`, `NotificationCard` |
| Dialog | `Dialog` | `DialogCard`, `NewCharacterDialog` sheet |
| Progress | `ProgressOverlay` | `ProgressBar`, `ProgressCard` |
| Property field | `PropertyGrid`, `FieldRow`, `NumberField` | `Field`, `PropertyField`, `StepperField` |
| Settings | `SettingsWindow`, `SettingsCard`, `SettingsRow` | `SettingsPage`, `SettingsSection`, `SettingsLabeledRow`, `SettingsColorRow` |
| Timeline | `Timeline` | `DopeSheetTimeline`, `FeatureTimeline` |
| View cube | `ViewportNavigationCube` | `ViewCube` |
| Icons | `AetherIcon`, `ToolIcon` | the same packs — `Sym` is a sized alias of `AetherIcon`, `ToolGlyph` routes tool names to `ToolIcon` (2026-09-24) |
| Menu / popover | `Menu`, `MenuButton`, `Popover` | reused as-is (restyled by the scoped tokens) |
| Badge / pill | — | `Badge`, `Pill`, `StageChip` |
| Graph | — | `GraphNode`, `LogicNode`, `NodeLibraryRow`, `ServoTrack` |
| Viewport stage | `ViewportCanvas` | `ViewportMock`, `EmptyStage`, `PerspectiveGrid`, `DotGrid` |
| Contextual | — | `RadialMenu`, `CenterTray`, `MoveGizmo`, `AxisGizmo`, `MaterialSphere`, `VisualizationPanel`, `EnvironmentPanel`, `PerformanceHUD`, `MateInspector`, `CurveInspector`, `PartPropertiesPanel`, `PropSection`, `SystemStatusView`, `Callout`, `MetricCard`, `ToolCluster`, `CommandButton`, `HeaderIcon` |

## Known simplifications

- Glyphs are approximations of the SF Symbols, drawn by hand. Swapping them
  for shared `core/assets/icons` artwork is a name-map change in `icons.tsx`.
- The Swift demo's `LayoutSettings` "Inspector: Auto" (unpinned right sidebar)
  is stored but the scaffold does not auto-hide it; floating and auto look the
  same.
- Canvas-mode edge reveal is hover-only (no keyboard reveal yet).
- Design is reached from Home (it is not in the pipeline strip), exactly as in
  the Swift `pipeline` array.

## Verification

From `core/ui/`: `npm test && npm run typecheck && npm run build`. Screenshots
were taken through the Studio host (`/ui/?demo=animation-mockup`) with a throwaway
Playwright spec in `aether-map/e2e/` during the port and then deleted.

## CodexUI elements folded in (2026-09-23)

Jonathan: *"review this other app 'anima studio demo' … the header read rex
animatronic … import any missing ui element from it … to our already imported
demo app ui kit tab page."* The app is `dev/archive/CodexUI` (header "Atlas
Animatronic"), the presentation walkthrough the Anima demo's `Widgets.swift`
credits as its source. Its 21-asset `UIKitAssetCatalog` plus the shell and
workspace prototypes were diffed against this kit.

Already covered (no change): PrototypePanel→`PanelCard`, PrototypeRow→`ListRow`,
PropertyField, LabelPill→`Badge`, MetricCard, ChromeIconButtonStyle→
`CommandButton`, PrototypeNodeCard→`LogicNode`, node library rows, search /
stepper fields, `StageChip`, AdaptiveRibbon→`ToolRibbon`, DockingWorkspace→
`WorkspaceScaffold`, PerformanceHUD, settings pages, mate dialog, notification.

Added to `@aether/ui/kit` and shown under "Imported from
CodexUI" on the demo's UI Kit page:

| CodexUI | Kit |
|---|---|
| MockViewport (robot, mode pill, mini cube, camera chrome, stage) | `RobotViewport` |
| PrototypeNodeCanvas | `NodeCanvas` + `connectionPath` |
| PrototypeNodePortRow | `NodePortRow` |
| ShowPrototype cue sequence | `CueTimeline` |
| TimelinePrototype / Live Follow audio lane, LIVE FOLLOW pill | `DopeSheetTimeline` `audio` + `badge`, `WaveformLane` |
| walkthroughCard | `WalkthroughCard` |
| "Load 3D Assembly" drop target | `DropZone` |
| RigPrototype connector slots | `ConnectorField` |
| SpatialSelectionToolsSpecimen | `ToolCluster` `solid` + per-tool `tint`, `ContextActionsCard` |
| SpatialContextStackSpecimen hardware rows | `DeviceStatusRow` |
| HardwarePrototype safety panel + E-Stop | `SafetyStatus` |
| HardwarePrototype channel map + live capsule | `ChannelMapTable`, `LiveBar` |
| WorkspaceStageTabs + WorkspaceTabLabelMode | `WorkspaceStageTabs`, `showsStageLabel` (+ test) |
| PrototypeSettingsView theme grid | `ThemeTileGrid` |
| Inspector tabs with icons | `InspectorTabs` accepts `{ label, icon }` |
| pose sliders | `LabeledSlider` `tint` + `readout` |

Not ported on purpose: the "float ribbon at bottom edge" placement (a layout
behaviour, not a widget — the scaffold floats the tool sidebar at the top) and
CodexUI's parts table (the demo's `PartsCenterView` already covers the pattern).

## The July-19 "Rex Animatronic" revision (2026-09-23)

Jonathan's reference screenshot was the build at `~/Desktop/AnimaStudio Demo`
(sources dated Jul 19, header "Rex Animatronic", first tab "Assets"), an
earlier revision of the same demo than the Jul 20–21 archive this port came
from. Diffing the two (4,840 diff lines; the later one had already renamed
Assets→Character, replaced `FloatingWorkspace` with the rail scaffold and
dropped the tray) gave these leftovers, now in the kit and on the demo's UI Kit
page under "From the July-19 Rex Animatronic build":

| Rex build | Kit / app |
|---|---|
| Tinted per-workspace `ToolRibbon` as the toolbar (Nodes orange, Output blue, Edit teal…) | `ToolGroup.tint` + `ribbonGroupsOf`; catalogs tinted; Settings ▸ Interface ▸ **Toolbar: Tool sidebar / Tinted ribbon** |
| `CenterTray` under every viewport (Import · Display · Environment · Performance · Fit; Scene · Trigger · Audio · Video · Sequence; Bind · Arm · Calibrate · Test · Home; Key · Record · Ease · Loop · Ghost) | `TRAY_ITEMS` + `useTray`, `WorkspaceScaffold.tray`; Settings ▸ Interface ▸ **Center tray** |
| Header project "Rex Animatronic" | the demo's project name |
| Home RECENT cards — Rex · animatronic dinosaur, Marble Bust · AR avatar, Show — Lobby | `ProjectCard`; Home shows them under RECENT and in Recent Projects |
| Hardware controller identity (circle badge, name, port) + Firmware/Latency fields | `DeviceIdentity`; controller inspector |
| Calibrate inspector's MAP RANGE bar with µs markers, Invert/Center pills, trim note | `CalibrationRangeBar`; calibrate inspector |
| Assets `importStat` chips | `StatChip` |

Both toolbar styles and the tray default to the later revision's look; the
switches are in Settings. Not restored: the rail-less docked `Panel` columns of
the old `FloatingWorkspace` (the rail scaffold supersedes it) and the old
five-button transport (the dope sheet keeps the later three).

## Atlas Studio Demo (2026-09-23)

`dev/archive/CodexUI` — the "Atlas Animatronic" walkthrough, removed from the
repo on 2026-09-23 once the port was accepted — is now its own
launchable concept app at `?demo=atlas-demo` (`gallery/atlas-demo/`), built
entirely from `@aether/ui/kit`: `AtlasDemoApp.tsx` (CodexUIShell:
Atlas header with SAVED capsule, file menu, undo/redo, centred
`WorkspaceStageTabs` with the authoring|utility divider and label modes, Live
status popover with Master Live, Preview, the tinted layout button that cycles
Floating → Docked → Canvas with per-panel submenus, walkthrough toggle;
AdaptiveRibbon = kit `ToolRibbon` + dock/float-top/float-bottom/hide menu;
status bar; `WalkthroughCard`; PrototypeSettingsView's Appearance / Workspace /
Behavior; seven PrototypeThemes incl. CAD Light and Midnight), `catalog.ts`
(WorkspaceCatalog verbatim), `workspaces.tsx` (Assets, Rig, Animate, Show,
Hardware, Nodes over the new kit `DockingWorkspace` — docked / floating /
hidden regions, capped floating cards, draggable right stack, Canvas-preset
edge reveal), `uikit.tsx` (UIKitPrototype's sections and the 21-asset coverage
list). `?ws=<id>` deep-links a workspace; ⌘[ / ⌘] step workspaces.
`DockSafeArea` / `useDockInsets` port `avoidsFloatingWorkspacePanels`: a
`DockingWorkspace` publishes the insets its floating panels and ribbon cover,
and structured content (tables, timelines, the viewport HUD) opts in per edge
while spatial canvases ignore them, as CodexUI does.


## Final audit of the remaining Swift apps (2026-09-23)

Two Swift app bundles were still on the machine. `~/Desktop/AnimaStudio
Demo/swift/apps/AnimationStudioDemo.app` is the July-19 revision of this mockup: all
63 of its views map to the kit or the concept app; only `Renderers/` and GeomKit
(native Metal / RealityKit / WebGPU engines) were never ported, by design. The
`qt/` PySide sibling beside it is a subset. Deletable.
`aether-animation/archive/Aether Animation Studio.app` was the archived production app
(removed from the tree later the same day); its
port is the Aether Animation web rebuild (see `Aether_Studio_UI_Convergence.md`,
gates 1–6). Of its 171 views, the reusable ones already live in `@aether/ui`
(`DemoKit*` → this kit, `Studio*` chrome → `WorkspaceShell` + kit shell,
`UIDev*` → the gallery's UI Dev pages, `Viewport*` → the ViewCube /
visualization / HUD widgets). Two were missing and are now kit widgets:
`MouseControlDiagram` and `Range` with `gradient`. Everything else in the list
(mate inspector family, asset builder, import units sheet, rig / show / servo
centre views, node canvas, context menus, drag-drop) is product behaviour bound
to the bridge and belongs to the web app's parity gates.
