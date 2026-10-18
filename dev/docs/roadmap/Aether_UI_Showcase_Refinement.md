# Aether UI showcase — review of the first reorganisation and the refinement plan (implemented)

Reviewed 2026-09-23 (Claude) at Jonathan's direction, after Codex's "additive
central showcase consolidation" (same day). Method: built `core/ui`, walked all
six tabs in Chrome at 1400 px, dumped the DOM inventory of every section, and
read `gallery/main.tsx`, `showcase.ts`, `showcase/*` and `Variants.tsx`.
Nothing here deletes an asset; every specimen keeps rendering. This is about
where things sit and how they are presented.

## Jonathan's rules for the showcase

1. **Flat, like a reference book.** Tab → section caption → the assets
   themselves. No widget inside another widget: no framed cards around a
   specimen, no inner toolbars, no per-box theme pickers, no zoom controls, no
   "Inspect" buttons, no "IDEAL W × H" badges.
2. **Variants of one thing live in one section**, side by side, compact, each
   with a one-line caption that names its source (`@aether/ui`, `animation-mockup`,
   `CodexUI`, `Rex`, `native template`). The Ribbons + toolbars section is the
   model.
3. **Nothing is segregated by origin.** Demo-app widgets sit next to the
   Aether UI widgets of the same kind so the full picture reads at once.
4. **Nothing is deleted.** Reorganise and re-present only.

## What the first round achieved

The six tabs, the tab strip, the Library list, the `sectionTab` registry and
the orphan test are right and should stay. The first 8–9 sections of Elements,
Widgets, Windows and Chrome already follow the flat rule and read well
(Buttons, Tabs, Text fields, Authoring fields, Toggles + pickers, Search,
Breadcrumbs, Indicators; Ribbons + toolbars, Trees, Tabular data, Property
inspectors, Command palettes, Timeline, Menus, Resizable workspace; Settings
window, Feature windows; Header chrome, Rail + Dock, Document tabs,
Collapsible sidebars, Viewports, Status bar). Codex preserved every import:
36 native templates, 26 state variants, 79 Anima/Rex/CodexUI specimens, 29
Atlas specimens.

## What is wrong now

### 1. Every tab ends in one boxed "Imported demo …" umbrella

Each tab has a final section ("Imported demo elements and feedback", "…widgets
and editors", "…windows and overlays", "…workspace chrome", "…home and template
cards", "…appearance and icon variants") that holds four nested libraries:

| Nested library | What the reader sees | Rule broken |
|---|---|---|
| **Aether Animation Studio · native templates** (`NativeLibrary` → `AnimaUIDevWorkspace`) | The whole native UI Dev browser: its own `UIDevToolRibbon` (App Surfaces / Interaction Labs / Patterns / Controls / Foundations), a "Living UI standard" banner, a "Native templates in this category" header card, then group captions and one framed card per template with title, blurb, `IDEAL 340 × 520`, and a fixed-height white preview (Layout & Style Controls is a 900 px card around a 300 px widget; Concept Template Cards is a thumbnail). Repeated on all six tabs with the same toolbar. | 1 |
| **Aether Animation Studio · state variants** (`AnimaVariants` → `SpecimenBoard`) | A board with search, family select and −/65 %/+ zoom, a header card "Window & Widget Variants · n of 26", then framed cards each with an "Inspect …" button and the widget scaled to 65 %. Repeated on five tabs. | 1 |
| **Anima Demo variants** (`AnimaKitLibrary`) | A bordered light box with its own "Anima specimen theme" picker, an inner `h1`, then a card grid (`.kit-grid`) of bordered specimens. On all six tabs. | 1, 3 |
| **Atlas variants** (`AtlasKitLibrary`) | The same, as a dark box with its own "Atlas specimen theme" picker. On all six tabs. | 1, 3 |

Sizes: the Widgets tab is 21,400 px tall and 17,600 px of it is this one
section. Elements 4,000 of 5,100; Windows 4,600 of 6,600; Chrome 5,700 of
7,000; Apps 2,500 of 4,800; Icons 2,000 of 4,400 — and on Icons the umbrella
comes *first*, above Application icons.

### 2. The same thing is shown in up to six places

Because each nested library was filed by tab rather than by section, a family
is spread across the flat section and several boxes. Timelines, for example:

- Widgets ▸ Timeline (dope sheet): `@aether/ui Timeline`, `animation-mockup DopeSheetTimeline`
- native templates: Animation Timeline, Show Timeline, Timeline Design B
- state variants ▸ Timeline Variants: Dopesheet, Motion Curves, Show Control, Empty Timeline
- Anima kit ▸ Timeline & Graph: Dope-sheet timeline · full width, Servo track
- Anima kit ▸ CodexUI · Timelines: Live Follow dope sheet, Show sequence
- Atlas kit ▸ Timelines: Production dope sheet, Full-width Live Follow, Show sequence

The same split exists for toolbars (flat section + Rex · Toolbars + Anima
Panels & Toolbars + variants Toolbars & Tool Rails + native Floating Tool
Ribbon / Rig Creation Palette + Atlas App Chrome adaptive ribbon), trees,
inspectors, node graphs, hardware panels, dialogs, status/feedback, viewports,
document tabs and settings.

**Appearance in particular** is in nine places: Appearance inspector (native
template, Widgets), Appearance state variant (Widgets), Material Editor and
Visualization Browser (native templates, Widgets), Material spheres /
Visualization icon / Visualization panel (Anima kit, Widgets), Environment
panel (Anima kit "Contextual widgets", Widgets), Material controls / Color
tokens / Layout contract (Atlas kit, **Icons**), Appearance / Workspace /
Behavior settings pages (Atlas kit, Windows), Theme tiles (Anima kit "CodexUI ·
Chrome", Chrome), Color tokens (Anima kit "Overlays & Shapes", Icons), Icon
Selector & Theme Lab (native template, Icons).

### 3. Exact duplicates

The Anima kit's "CodexUI · …" groups and the Atlas kit render the *same*
`@aether/ui/kit` components with the same sample data:
`NodeCanvas`, `CueTimeline`, `DopeSheetTimeline` (Live Follow),
`ChannelMapTable`, `SafetyStatus`, `ContextActionsCard`, `WorkspaceStageTabs`,
`RobotViewport`, `PerformanceHUD`, `MetricCard`. The kit `StatusBar` is shown
in the flat Status bar section and again in Anima kit "Chrome". These are not
variants; they are the same render twice. Proposal: keep one render, caption
it with both sources ("animation-mockup · also Atlas"). **Needs Jonathan's OK,
since it is the one place where a specimen count goes down.**

### 4. Things on the Apps tab that are not apps

"Imported demo home and template cards" holds: Recent Projects (native
template), Concept Template Cards (native template), Rex recent project cards,
Import stat chips, Controller identity, Calibration range bar, and the Atlas
"Component coverage" list. None is an application surface. Apps should hold
only Application home, Workspace shell, CAD workspace shell and the Concept
applications directory.

### 5. Misfiled singles

| Item | Where it is | Where it belongs |
|---|---|---|
| View cube, Axis gizmo | Elements ▸ Anima "Inputs" | Chrome ▸ Viewports |
| Radial menu | Icons ▸ Anima "Overlays & Shapes" | Widgets ▸ Menus |
| Shapes, Color tokens (Anima), Theme color tokens (Atlas) | Icons ▸ two boxes | Icons & Assets ▸ Colour tokens & themes (flat) |
| Live shell layout contract | Icons ▸ Atlas "Appearance & Layout" | Chrome ▸ Layout presets |
| Command buttons, Property fields, Document tabs | Windows ▸ Anima "Dialogs, Inspectors & Feedback" | Elements ▸ Buttons; Widgets ▸ Inspectors; Chrome ▸ Document tabs |
| Feature timeline, Document tabs · floating pill | Widgets ▸ Anima "Node Graph" | Widgets ▸ Timelines; Chrome ▸ Document tabs |
| Compact Action Panel, Layout & Style Controls | native "Buttons & Inputs" | Widgets ▸ Panels; Windows ▸ Settings |
| Performance HUD | Widgets ▸ Anima "Contextual"; Elements ▸ Atlas "Diagnostics" | Chrome ▸ Viewports |
| Recent project cards, Concept template cards | Apps | Widgets ▸ Cards & tiles |
| Import stat chips, Controller identity, Calibration range bar | Apps | Elements ▸ Indicators; Widgets ▸ Rows; Elements ▸ Toggles + pickers |
| Component coverage list | Apps | Bottom of Widgets as a plain text index, or drop from the page and keep in `WIDGETS.md` |

### 6. Gaps in the "full picture"

Library components no page renders today (all additive to add):

- `@aether/ui`: `CollectionFilter`, `FloatingPanel`, `Menu` (static open state), `TreeToolbar`, `WorkspaceSwitcher`.
- kit: `MouseControlDiagram`, `Range` with `gradient`, `Switch`, `PropSection`, `PartPropertiesPanel`, `NewCharacterDialog`, `CurveInspector`, `WaveformLane`, `MoveGizmo`; the shell family (`DockingWorkspace`, `DockSafeArea`, `PanelSidebar`, `StackRail`, `StackCard`, `PromptBar`, `WorkspaceScaffold`, `ViewTabContent`) appears only inside the two concept apps.
- other `src/`: `CollectionView`, `ConfigurationInspector`, `TreeRename`, `ViewportCubeHome`.

Minor: the Dialog + Popover section shows only trigger buttons, no static
specimen (the imported dialogs supply them once merged); the virtualised Tree
leaves ~900 px of empty column; the Header chrome section is three icons with
no caption.

## Target structure

Tabs unchanged. Sections are the unit; the "Imported demo …" umbrellas
dissolve and their contents distribute. New sections only where no home
exists. Within a section, rows go core → kit → source demos.

### Elements
Buttons (+ Pill active/idle/tints, CommandButton states, Atlas buttons & pills,
native Action Buttons) · Tabs (+ Inspector tabs, Stage chips, Atlas document &
inspector tabs) · Text fields (+ Stepper field, kit Field, Atlas inputs, native
Fields & Inputs) · Authoring fields · Toggles + pickers (+ Toggle row, Switch,
Chip picker, Segmented icons, Labeled slider, gradient Range, Calibration range
bar) · Search fields (+ kit SearchField) · Breadcrumbs · Indicators, status &
feedback (+ Badges, StatChip, Metric card, Toast, Callout, Progress bar,
Progress card, native Progress & Status, Empty Workspace, state variants
Empty / Processing / Hardware Connected / Emergency Stop, Atlas Diagnostics)

### Widgets
Top tool bars (2026-09-24: only the Aether tool bar `WorkspaceRibbon` and the
Aether tool bar `ToolSidebar`; everything else that was here is deleted) ·
Side tool bars (Rail + DockPanel, Anima PanelSidebar, ToolCluster) · Center
tray tool bar (CenterTray with the demo's popovers) · Trees + hierarchies (+
native Project Navigator, Layered Icon List, variants Navigator empty /
populated, Anima Panel card & List rows, Atlas Tree panel & hierarchy stack) ·
Tabular data + flat collections (+ Channel mapping, Servo track, Device status
rows, Controller identity) · Inspectors & property panels (+ Component
Inspector, Mate Editor, Mate inspector, variants Component / Mate / Hardware,
Atlas numeric inspector, Head Pan mate panel, Mate connectors + pose sliders,
`PartPropertiesPanel`, `PropSection`) · **Appearance, materials &
visualization** (new: `AppearanceInspector`, Appearance state variant,
`MaterialEditor`, `MaterialBrowser`, Visualization panel, Visualization
Browser, Environment panel, Material spheres, Material controls, Theme tiles,
`ThemeSwatchStrip`) · Command palettes · Timelines (all six sources above, one
row each, + Feature timeline, `WaveformLane`, `CurveInspector`, Curve card) ·
**Node graphs** (new: typed logic nodes, node states, node library, node
inspector & ports, Node canvas ×1, native Node Workspace) · **Hardware &
safety** (new: System status, Live hardware output, Safety state, Hardware
Monitor, Hardware variant, Emergency stop) · **Panels & cards** (new: Panel,
Panel card, Panel actions, Panel anatomy, Compact Action Panel, Recent
Projects, Recent project cards, Concept template cards, Project card, Context
actions card, Walkthrough card, Drop zone, Callout) · **Assistant & agent
panels** (new: Anima Agent template, Agent docked variant, `AssistantPanel`) ·
Menus (+ Radial menu, Component Menu, `Menu` static) · Resizable workspace +
bottom panel · Specimen board (the `SpecimenBoard` widget itself, once, as a
component)

### Windows & Overlays
Settings window (+ Atlas Appearance / Workspace / Behavior pages, native
Layout & Style Controls, Anima demo `SettingsPanes`) · Feature windows ·
Dialogs, alerts & popovers (+ Information Alert, Confirmation Dialog, Graphics
Popover, Notification Popup, Character Part Import, variants Information /
Confirmation / Graphics Popover, Mate dialog ×1, `NewCharacterDialog`,
`DialogCard`) · Toasts + notification history (+ Notification card, Toast) ·
Floating & detached windows (Detached Tool, `FloatingPanel`, `WorkbenchWindow`)

### Workspace Chrome
Header chrome (+ Production App Chrome, variants Document Header / Workspace +
Ribbon / Compact Workspace, `WorkspaceSwitcher`) · Workspace navigator (stage
tabs, label modes ×1, Guided walkthrough) · Rail + Dock panel + Tree (+ StackRail,
StackCard, PanelSidebar) · Document tabs (+ Document Tab Strip, DocumentTabBar
floating pill, kit DocumentTabs) · Collapsible sidebars · Layout presets
(Workspace Layout Modes, Live shell layout contract, `DockingWorkspace`
docked / floating / hidden) · Viewports & camera chrome (+ 3D Workspace, Triad
Manipulator, Viewport Controls, Viewport mock, Perspective grid, View cube, Axis
gizmo, Robot viewport ×1, Performance HUD ×1, `MoveGizmo`, `ViewportCubeHome`) ·
Prompt bar (`PromptBar`) · Status bar

### Apps
Application home · Workspace shell · CAD workspace shell · Concept applications
(+ a card for the native UI Dev browser, so the browser itself stays reachable
as an app instead of being embedded six times)

### Icons & Assets
Application icons · Illustrated ribbon tools · Shared vector icons · Colour
tokens & themes (Color tokens, Theme color tokens, Shapes, Icon Selector &
Theme Lab, the seven Atlas themes as swatches) · `Sym` glyph map (the 235 — retired 2026-09-24, the glyphs live in the system pack
SF-named glyphs, additive)

## Presentation rules to implement

1. One presentation primitive: `Variant` (caption under the asset, natural
   size, `flex-wrap` row). Everything imported renders through it. Delete the
   card chrome around specimens: `.kit-grid` cards, `.imported-kit-library`
   boxes, `SpecimenBoard` frames + Inspect buttons + zoom, `AnimaUIDevWorkspace`
   template cards + `previewHeight`, the embedded `UIDevToolRibbon`, the
   "Living UI standard" banner and per-category header cards.
2. The ideal size stays as caption text ("Appearance inspector · native
   template · 340 × 520"), never as a frame.
3. One theme control for the page. Imported Anima/Atlas specimens follow the
   gallery's light/dark (`data-aether-kit` scope set from the page appearance);
   if the seven Atlas themes must stay reviewable, one "Specimen theme" select
   in the gallery header, not one per box.
4. Natural height everywhere; `max-height` + scroll only for long lists
   (virtualised tree, layered icon list).
5. Section captions stay the uppercase 11 px `h2`; a variant family inside a
   section gets a 10 px caption row, nothing heavier.
6. Every tab's first section is a real section (fixes Icons).

## Implementation notes

- `showcase.ts`: replace the six "Imported demo …" titles with the new
  sections above; `showcase-tabs.test` keeps enforcing no orphans.
- `showcase/inventory.ts`: key specimens by **section**, not tab.
- `DemoShowcase.tsx`: becomes per-section fragments (`<ImportedRow section=…>`)
  that `main.tsx` places inside the matching `<Section>`.
- `AnimaKit.tsx` / `AtlasKit.tsx`: their `specimen()` helper renders `Variant`;
  drop `section()` boxes; export the specimens as a map so the same source
  serves several sections.
- `AnimaUIDevWorkspace.tsx`: keep the browser for the Apps card; add a flat
  `TemplateSpecimen` renderer used by the sections.
- `AnimaVariants.tsx`: render the 26 variants as flat rows; keep one
  `SpecimenBoard` instance as its own specimen.
- Duplicates (section 3): one render, dual-source caption — after Jonathan's OK.
- Acceptance: every specimen name in Codex's inventory still renders exactly
  once (or once per distinct variant); zero nested `.imported-kit-library`,
  `.native-showcase-library`, `.anima-variant-board-scroll` in the DOM; no
  section taller than its content; `npm test && npm run typecheck && npm run
  build`; ShowcaseMigration tests updated to the new counts; browser walk of
  all six tabs.

## Implemented (2026-09-23, Claude)

Jonathan approved the plan the same day and it is in. What shipped:

- `showcase.ts`: 44 sections across the six tabs (was 39); the six
  "Imported demo …" umbrellas are gone and Appearance / Node graphs /
  Hardware + safety / Panels + cards / Assistant + agent panels / Floating +
  detached windows / Workspace navigator + walkthrough / Layout presets /
  SF-named glyphs / Colour tokens + themes are real sections.
- `Section` in `main.tsx` appends `<ImportedSpecimens section=…/>` after its
  own widgets, so every section lists the imports filed under it; sections
  that only hold imports are self-closing.
- `showcase/inventory.ts` keys every kit specimen, native template and state
  variant by **section** (`kitSpecimenSection`, `nativeTemplateSections`,
  `nativeVariantSections`); Codex's retained inventory stays as the test data.
- One primitive: `Specimen` / `Variant` (caption, then the asset). The kit
  pages render rows instead of card grids; `NativeTemplate` and `StateVariant`
  render one template / variant at its design width with the size in the
  caption, no board, no fixed preview height, no Inspect button.
- The demo kits' `--ad-*` scope follows the page appearance
  (`usePageAppearance`); the per-box theme pickers are gone.
- The native UI Dev browser stays whole as a launchable tool (`?demo=ui-dev`,
  Concept applications card) instead of being embedded six times.
- Library gaps (§ 6) added as rows: `Switch`, `Range` gradient,
  `MouseControlDiagram`, `WaveformLane`, `CurveInspector`, `MoveGizmo`,
  `PropSection`, `NewCharacterDialog`, `DockingWorkspace`, `StackCard`,
  `ThemeSwatchStrip`, the `Sym` glyph map, `WorkspaceSwitcher`,
  `CollectionFilter`, `FloatingPanel`, `SpecimenBoard` as a widget.
- Nothing deleted: 108 kit specimens, 36 templates and 26 variants each render
  exactly once (`ShowcaseMigration.test.tsx`), the Apps tab holds no widgets,
  and appearance lives in one Widgets section.

Kept as-is on purpose: the exact duplicates in § 3 still render, adjacent and
captioned by source, until the consolidation pass decides; `TreePanelDemo`'s
778 px reference height (Codex's reference-standard collection list) leaves a
tall column in Trees + hierarchies; the Widgets tab is long (about 20,000 px)
because it now holds every timeline, toolbar and inspector variant in one
place. Tab heights after the pass: Elements 3.3k, Widgets 20.3k, Windows 5.3k,
Chrome 6.4k, Apps 2.9k, Icons 5.3k (were 5.8k / 22.2k / 7.2k / 7.7k / 5.4k /
5.0k with the umbrellas).

## One instance per widget (2026-09-24)

Jonathan, looking at six tool-sidebar rows: *"some of the widgets are the
exact widget just in a different mode — I don't need that; one import per
widget, I can flip modes directly."* So:

- **Modes flip on the instance.** The `ToolSidebar` is one row (density from
  its own "•••" menu, a `docked` switch above it); the `ToolRibbon` is one row
  with a `docked` switch; the `WorkspaceRibbon` is one row with
  `workspaceLayout` (strip · column) and `appearance` (panel · glass)
  switches; the `DopeSheetTimeline` row carries keys, the audio lane, the
  badge and transport at once; `SequenceEditor` already flips its own modes.
  State rows that were three specimens (Pill active / idle / tints, Row plain /
  selected, logic-node types / states) are one row each.
- **Mode and data duplicates are hidden, not deleted.** `inventory.ts`
  `MODE_DUPLICATES` maps every hidden key to the instance that stays (10 Anima
  rows, 22 Atlas rows, 9 native templates, all 26 native state variants —
  each re-rendered another template or a flat widget in a state). Their
  section mapping is untouched, so un-hiding is one line, and the native UI
  Dev browser (`?demo=ui-dev`) still shows every template and the whole
  variant board. `ShowcaseMigration.test.tsx` asserts each inventory row
  renders once or is in the map.
- Effect: the Widgets tab went from about 20,000 px to 12,100 px and the
  showcase from roughly 190 imported rows to 130 variants in total.

## Tool bar sections and specimen panels (2026-09-24)

Jonathan: *"I would call this section the Top tool bars, and remove (delete)
everything other than the two main tool bars we have updated"*, then *"after
Top tool bar show the list for the Side tool bar followed by the Center tray
tool bar"*, and on seeing the new rows: *"a side bar would only be
[one orientation], why are they so wide, where is the pop-up window they
launch"*, and *"their default panels are not being rendered — their panel is
a part of the widget itself"*. So:

- **Top tool bars** is two rows, deleted not hidden: the shared `Ribbon`
  demo, `ToolRibbon`, both `CenterTray` rows, `ToolCluster`, the selection
  rail, the native creation palette / floating ribbon templates and the Atlas
  adaptive ribbon left the inventory (`importedKitInventory`,
  `KIT_SPECIMEN_SECTION`, `MODE_DUPLICATES`, `nativeTemplateSections`).
  The kits still export the widgets; the native UI Dev browser still shows
  the two templates. Component names stay `WorkspaceRibbon` / `ToolSidebar`
  until `index.ts` is free; the captions say "Aether tool bar" / "Anima tool
  bar".
- **Side tool bars** shows what a side bar launches: `Rail` + `DockPanel`,
  `PanelSidebar` (StackRail + StackCard, docked switch), `ToolCluster`
  (vertical only — the axis switch is gone). Each card is its natural width
  (`justify-self: start`), not the caption's.
- **Center tray tool bar** is one `CenterTray` over `TRAY_ITEMS` through the
  demo's `useTray`, so its popovers are the demo's Display / Environment /
  Performance panels, not placeholders.
- **Imported specimens render inside the original specimen panel.** Both
  kit pages (`UIKit.swift` `specimen()`, CodexUI `UIKitPrototype`) framed
  every widget in a 16px-padded panel (50% panel fill, 12px radius, 1px
  stroke); `Specimen.tsx` now does the same (`.gallery-specimen-panel`), so
  a panel-less widget such as `EnvironmentPanel` reads as the panel it is in
  the app.
- `ShowcaseMigration.test.tsx` derives its counts from the maps instead of
  pinning 104 rows / 36 templates.

## Icons: system glyphs and tool packs (2026-09-24)

Jonathan: *"most icons, headers, Aether Studio should pull from a consistent
glyph style, similar to how macOS works; special things, primarily tools we
make for apps, pull from a tool icon pack like our CAD tools… the system will
be Aether Studio and consistent across apps, then a specific app might use
icon pack X for its tools"*, and for the Icons tab: *"two sections, one for
the system icons and one for the app pack, each with controls to flip between
packs, filter, and toggle light and dark palette; between them every icon
Aether Studio uses should be reachable."* Done as described; STATUS has the
shipped shape. Themes (a system theme plus a per-app theme) are the next
layer, not started.

## Next: the app side (to do, after Jonathan's widget review)

The showcase now holds one instance per widget; the products still compose
their own lookalikes (Map's `MapRibbon`, CAD's traditional ribbon). The
agreed direction — Aether UI draws, apps populate — and its steps are in
`dev/briefings/tasks/Aether_UI_Consolidation.md`. Not started; it follows
Jonathan's pass through every current widget and design.
