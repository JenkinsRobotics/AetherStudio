## Standard overlay containers

Overlays is the container collection: shared sidebars, toolbars, floating/editing
popups, settings windows, dialogs and popovers. Apps supply widgets and elements
inside these containers; they preserve the shared frame and behavior. A different
sidebar tab, feature editor or information screen does not require a new container.
See [the overlay standard](WIDGETS.md) for ownership and approval rules. Review
containers under Overlays and their contents under Elements/Widgets; Workspaces
only combines those independently showcased assets.

# Aether UI

The Aether family's shared design system: framework-neutral **design
tokens** plus a **one-widget-per-file React library** and a UIDev-style
**gallery**. Decision record:
`dev/docs/roadmap/UI_Framework_Decision.md`.

`ApplicationSidebar variant="captioned"` is the shared captioned navigation
variant: static section labels remain in its collapsed rail, with a larger app
mark and uniform navigation glyphs. Clicking the icon/name area collapses or
expands the tray; Overview/Home stays in navigation. The sidebar
reference page shows its isolated light/dark palettes and selection treatments.
See [ApplicationSidebar](WIDGETS.md#applicationsidebar).

Feature editor accessory rows are fixed icon controls. Their gray off / blue
active states use `aria-pressed`; Help and additional accessories never insert
content or expand the editor. Use `onHelpToggle` / `actionIcon` for state changes
and `setHelpActive` for app-owned synchronization. All editor variants use the
same row. See [the accessory contract](WIDGETS.md#feature-editor-accessory-row).

## Floating toolbar variants

`FloatingToolbar` is a controlled, product-neutral alternative to the ribbon.
Use `variant="tools"` for a row of large line-icon commands with an optional
command/search row and tinted shortcuts; use `variant="document"` for the compact
menu, identity, selection-mode and document-picker arrangement. Groups accept
active/disabled actions, separators and a shared capsule for related toggles.
`FloatingToolbarMenu` reuses the standard menu for leading and trailing controls.
Supply command matching, action callbacks and selected values from the application.
Arrow keys/Home/End move through enabled actions without activating them. Narrow
bars scroll internally and command suggestions wrap; all styling uses theme tokens.
See Widgets → Toolbars for both working specimens alongside the existing ribbons.

## Central showcase libraries

The showcase is flat, like a reference book: six tabs, a caption per section,
then the assets side by side, each with a one-line caption naming its source
(`@aether/ui`, `animation-mockup`, `CodexUI`, `Rex build`, `native template`,
`native variant`). Imported demo specimens file under the same section as the
Aether UI widget of their kind — a demo toolbar sits beside the ribbons, its
dialog beside the dialogs — never under a tab or section of their own
(`gallery/showcase/inventory.ts` holds the section map; `showcase.ts` the
tabs). No frames, inner toolbars, per-box theme pickers or zoom controls: the
demo kits follow the page's light/dark appearance.

Retained inventory: 36 native templates, 26 state variants, 79 kit
Demo/Rex/CodexUI specimens and 29 Atlas specimens, each rendered exactly once
(`src/ShowcaseMigration.test.tsx`). Source variants stay separate and
interactive; where two demos render the same kit component with the same data
they sit next to each other, captioned, as input to the consolidation pass.
The native UI Dev browser itself (tool ribbon, template board, variant board)
stays whole as a launchable tool: `?demo=ui-dev`, listed under Concept
applications.

The three demo apps no longer expose UI Dev/UI Kit workspaces. Old
`?demo=…&ws=uiKit` / `&ws=ui-dev` links open the main Widgets showcase.
`OverlayScope` keeps the demo kits' menus/popovers inside their theme scope;
normal app overlays still use the body.

## Electronics presentation

`CircuitSymbol` renders shared resistor/capacitor/LED/switch/connector/MCU SVG
artwork, with optional LED highlighting. `SignalMonitor` presents caller-supplied
normalized traces, labels and duration, including an empty state; it performs
no simulation. Both are exported from `@aether/ui`. The central Widgets →
Panels → Electronics + instruments specimen includes populated/empty monitors,
all symbols, and the electrical `AppIcon app="io"` identity. Product state and
simulation remain outside this library.

## Rules

- One widget per file, importable like a class: `import { Tree } from "@aether/ui"`.
- Widgets are product-free: data in, events out. Nothing here names a
  product concept or calls an engine verb — that is app code.
- Widget CSS consumes ONLY token variables. `tokens/tokens.json` is the
  single theming source; `tokens.css` mirrors it (native shells may
  generate their themes from the JSON).
- The baseline theme IS Aether CAD's current look (extracted 2026-08-01).
- The viewport stays imperative: mount renderers through
  `ViewportCanvas`, never re-render through React.

## Workspace shells

`WorkspaceShell` is the original flexible panel/viewport scaffold.
`RibbonWorkspaceShell` is the second layout, matching the current CAD workspace:
document header, left workspace selector, tabbed command ribbon, dockable panels,
persistent viewport, optional bottom panel, and status strip. Find its example
in **Workspace chrome → CAD workspace shell** in the gallery.

```tsx
import { RibbonWorkspaceShell } from "@aether/ui";

<RibbonWorkspaceShell
  preset="docked"
  style={{ height: "100%" }}
  documentBar={{ leading: documentControls, trailing: accountControls }}
  ribbon={{
    workspaces, workspaceID, onWorkspaceSelect,
    tabs, activeTabID, onTabSelect, onCommand,
  }}
  leftPanels={featurePanels}
  rightPanels={inspectorPanels}
  defaultOpenLeft={["features"]}
  statusBar={status}
>
  {viewport}
</RibbonWorkspaceShell>
```

Give the parent a definite height. Workspace and active-tab state are controlled
by the consumer; switching them does not remount the viewport. Each ribbon tab
contains groups of tool descriptors. Group captions expose menus; `menuItems`
can supply additional commands beyond the prominent tools. `WorkspaceRibbon`
can also be used independently. The shell accepts the existing panel placement,
storage, bottom-panel, and status-bar props, and retains panel content by default.
Products supply their commands and rendering; the gallery's editable sample part
does not depend on a CAD engine.

## Commands

```bash
npm install
npm run gallery     # UIDev-style widget gallery (Vite dev server)
npm test            # RTL behavior pins (vitest + jsdom)
npm run typecheck
npm run build       # static gallery build
```

## Launchable concept applications

The gallery's **Concept apps** tab is the review home for complete application
specimens. These are app-shaped consumers of `@aether/ui`, kept in
`core/ui/gallery/`; they exercise shared widgets without introducing product
or engine dependencies into `core/ui/src/`.

- **Aether Animation Studio** (`?demo=animation-studio`) ports the archived native shell and
  Assets workspace, with working Assets, 3D Modeling, Animate, Show, Hardware,
  and UI Dev stages. It uses the shared float/dock/canvas shell, rails, panel
  lifecycle, tables, search, selection, property fields, ribbons, timeline,
  status bar, app launcher, and System/Light/Dark appearance.
- **Aether CAD workspace** (`?demo=cad-workspace`) launches the existing
  ribbon and live sample-part demo as a complete application canvas.

Each demo header contains the shared app launcher, so reviewers can move among
the concept apps and the component gallery without editing the URL. The Swift
archive remains the behaviour and visual reference until parity has been
reviewed; building these demos does not authorize deleting it.

The studio header preserves the native stage strip exactly: a working 3D/2D/VR
character-type selector followed by Assets, 3D Modeling, Animate, Show,
Hardware, and UI Dev. Assets keeps Create, Import, Manage, and Prepare visible
together as in its reference. The authoring workspaces use the native category
strip above one active command row: Modeling exposes Build, Mates, Relations,
and Inspect; Animate exposes Transport, Keyframes, Curves, Tracks, Reference,
Keys, Playback, and Edit; Show exposes Sequence, Clips, Events, Sync, Nodes,
Output, and Edit. Build preserves the reference's Create and Structure group
captions. Transport commands drive the shared timeline.

The toolbar's trailing settings button preserves the archived Compact,
Standard, and Expanded densities plus Square, Soft, and Rounded chrome shapes.
Compact mode opens each group as an icon palette; Standard keeps labeled
primary commands with per-group overflow; Expanded displays full groups and
headings. Choices persist locally. Oversized tool rows remain bounded to the
window and support horizontal scrolling through the scroll buttons, scrollbar,
trackpad, or Shift+wheel. Floating mode renders one toolbar surface without a
second shell backdrop, uses the compact centered panel and pill category state,
and docked mode uses the integrated full-width strip with an underline state.

The Animate stage opens on the archived Dope Sheet presentation. Its shared
`Timeline` editor variant provides previous/next key and frame stepping, stop,
play/pause, loop preview, clip identity, 24/25/30/60 fps display, frame
timecode, output state, detailed motion/audio/event rows, selectable keys,
scrubbing, and a Curves presentation. The bottom center-view switcher moves
between the persistent 3D preview, Dope Sheet, and Curves without replacing the
underlying animation state. The compact `Timeline` presentation remains the
default for existing product consumers.

The Show stage opens on the archived Node Graph presentation. It includes the
searchable node library and complete draft vocabulary, connected and draggable
sample graph, Select/Hand/Connect tools, zoom/grid/frame/validate controls,
editable node inspector, graph deletion/reset, and a performance strip sharing
the show playhead. Its bottom switcher moves among Node Graph, the scene-action
Table, and the 3D show preview.

The UI Dev stage restores the archived 36-template living-standard matrix in
its original seven sections. Each template uses the archived ideal size and
preview height. Its ribbon filters the same production chrome, layout modes,
recents, navigation, 3D viewport, assistant, timelines, inspectors, material
tools, creation palette, dense layer list, hardware and floating tools,
dialogs, popovers, import staging, controls, empty/status states, concept-card
set, and five-palette icon lab. The focused Nodes tool retains the detailed
node workspace outside the 36-template count. The concept
composites used there are product-free exports from
`@aether/ui/concept-widgets`:

```tsx
import {
  AnnouncementCard,
  AssistantPanel,
  ImportWorkflow,
  MaterialBrowser,
  MaterialEditor,
  SpecimenBoard,
} from "@aether/ui/concept-widgets";
```

These composites accept data and event callbacks; product names, persistence,
and engine behavior stay with the consuming application.

The migration inventory now preserves all nine archived product workspaces:
Assets, 3D Modeling, Animate, 2D, VR, Show, Nodes, Hardware, and Design. The
center stage strip retains its compact native shape; the character selector
routes its authoring slot among 3D/2D/VR, and the complete workspace menu keeps
Nodes and Design reachable without crowding the strip. UI Dev remains a tenth,
development-only surface. See
[`Animation_Studio_Web_Migration.md`](../../dev/docs/reality/Animation_Studio_Web_Migration.md).

The header Settings control opens a compact modeless utility window. Its Layout
pane applies and saves Floating (overlay), Docked (push), or Canvas presentation
and can move panel cards to the window edge while keeping the icon rail inboard.
The window retains macOS traffic lights, grouped navigation, dragging, keyboard
movement, and Escape/close behavior.

## Authoring trees

Use `TreePanel` for feature, scene and layer collections. It composes `Tree`,
`Menu`, and `IconButton` into a bounded scrolling list with a fixed bottom
`TreeToolbar`. The gallery's **Workspace chrome → Authoring tree panel** is a
working example. CAD features/bodies and Map scenes/layers consume this standard.

- Rows use aligned disclosure, item icon, name, then state indicators. Labels
  truncate with a full-name tooltip. Selection and keyboard focus are distinct.
- `TreeNode.status` supplies read-only `{ id, label, icon }` indicators. States
  use SVG icons, accessible labels and tooltips; `badge` is for short metadata
  such as a count, never words standing in for status icons.
- A pinned `TreeNode.actions` entry is a row-specific state control, such as
  showing a hidden item or unlocking a locked one. Its click affects that row.
  Other commands belong in `menuItems` and `controls`, not repeated on every row.
- `controls` define footer commands and availability for the selection. Delete
  (also Backspace) and F2 shortcuts only run from selected tree rows; fields keep
  their editing keys. Right-click or Shift+F10 opens the focused item's menu.
- Existing Tree selection/range selection, activation, expansion, filtering,
  inline rename, drag/drop, virtualization and child loading/error APIs remain
  available. Applications own document semantics and validate reorder/delete.

This follows the aligned hierarchy and keyboard interaction guidance in
[Carbon's tree view reference](https://carbondesignsystem.com/components/tree-view/usage/),
with Aether's shared footer and state controls for authoring applications.


## Native concept widgets

`@aether/ui/concept-widgets` exports `CompactActionPanel`, `AppearanceInspector`,
`ConfigurationInspector`, and `SequenceEditor` alongside the specimen board,
assistant, material, import and announcement components. Their state/callback
contracts stay independent of product engines. The launchable Aether Animation Studio
concept (`?demo=animation-studio`) demonstrates them in the 36-template matrix and
separate 26-variant board. Its native light/dark palette is scoped to that demo
session; it does not replace the suite's active product theme.

See `dev/docs/reality/Animation_Studio_Web_Migration.md` before removing archived
Swift references: automated verification does not constitute pixel parity.

## Workbench window template

`WorkbenchWindow` is exported by `@aether/ui/concept-widgets`. It preserves
Codex Bench's useful split-window layout without any renderer dependencies.
Run `npm run gallery` and open `/workbench-window.html`, or use
`/ui/workbench-window.html` on the Studio host. The template is a second
Vite HTML entry, independent of the main showcase's current reorganisation.

Pass sidebar/header/footer content, toolbar actions, canvas children, optional
canvas overlays and a status bar. Sidebar width and collapse support either
controlled props or local state; hidden content stays mounted. Shared
`SplitPane` supplies pointer/keyboard resizing (220–340 px; default 265 px).

### Optional Graphite Ribbon tool icons

The **Icons & Assets → App tool packs** browser (Graphite Ribbon entry) now
compares the original illustrated pack with Graphite Ribbon in light and dark.
Wrap tools with `<ToolIconTheme pack="graphite-ribbon">` or set
`<ToolIcon name="extrude" pack="graphite-ribbon" />` to opt in. Palette follows
`data-aether-theme`, with an optional `palette="light" | "dark"` override.
This is local to the React subtree; the existing pack stays the default.
All 121 original tool names are covered, plus `cylinder` and `sphere`.
Source, standalone SVGs, build instructions and a visual contact sheet live in
[`core/assets/icon-packs/graphite-ribbon`](../assets/icon-packs/graphite-ribbon/README.md).

### FreeCAD Graphite icon theme

**Icons & Assets → App tool packs → FreeCAD Graphite** includes 1,707
FreeCAD-derived SVG icons in light and dark palettes across all bundled workbench
categories, including CAM and FEM. Filter by workbench or name; the gallery uses
96-icon pages. This separate opt-in pack leaves Aether Classic and Graphite Ribbon
intact. Use `<FreeCADIcon name="PartDesign/PartDesign_Pad" palette="auto" />`;
`freecadIconCatalog` lists every stable ID. `auto` follows `data-aether-theme`.

Original source SVGs, per-file attribution, license declarations and editable
transformation source live in `core/assets/icon-packs/freecad-graphite/`.
See that pack's README and ATTRIBUTION before redistributing its artwork.

FreeCAD Graphite also covers every illustrated Aether tool name: 99 upstream
matches and 24 purpose-drawn Aether additions (1,731 icons total). You can use
`<FreeCADIcon name="pen" />` or `<FreeCADIcon name="extrude" />`; exported
`freecadToolIconMap` links all 123 aliases to their stable catalog IDs. The icon
page can search those aliases and filter **Aether additions**. See the pack's
`COVERAGE.md` for the audited mapping; monochrome interface glyphs are separate.

### Showcase categories and subsections

Widgets and Windows & Overlays use the same hierarchy in the Library navigation
and on the page. Widgets are grouped into **Menus**, **Lists**, **Tables**,
**Inspectors**, **Editors** and **Panels**. Menus contains dropdown/context/radial
menus, toolbars, sidebars, center bars and command palettes. Windows are grouped
into **Application windows**, **Floating windows**, **Dialogs & overlays** and
**Notifications**. Lists and tables have separate sections, as do dialogs and
popovers. Library categories collapse independently; subsection buttons jump to
the matching examples. Existing widget mode controls and the imported specimen
inventory remain intact. `gallery/showcase.ts` owns this ordering and grouping.

## Commerce dashboard concept app

Open **Apps → Concept applications → Commerce Dashboard**, the Concept apps rail,
or `?demo=commerce-dashboard`. This reference-led business dashboard uses the
shared `DashboardShell`, metric/goal/activity cards, interactive SVG/HTML charts
and `DashboardTable` (a presentation of the existing DataTable). Its new Aether
Commerce theme has independent light/dark palettes and does not change other
apps' defaults. Choose Settings to switch appearance or return to Aether UI.

The demo supports store/time filters, dashboard search, keyboard/hover chart
inspection, sorting and fulfilling orders, creating a sample sale, editable goals,
editable product prices, activity pause/acknowledgement, revenue CSV download,
sidebar collapse and navigation across 15 commerce/finance/platform views.
Data is fictional, session-local and not connected to a commerce service.

Reusable components also appear under **Widgets → Panels → Dashboards + analytics**.
Eight outline commerce icons live in the central icon pack; region artwork is in
`core/assets/illustrations/dashboard/`. The original themes and demos remain.

## Properties Studio reference study

Launch **Properties Studio** from Apps → Concept applications or
`?demo=properties-studio`. The same editable specimen lives in Widgets →
Inspectors → Inspectors + property panels. The reference's white surfaces, mint
fill, blue border, fine dividers and outlined fields are adapted to a 320px panel.
Light/dark modes use the existing Aether Studio theme and do not change saved
application preferences.

`StylePropertiesPanel` is a controlled, reusable inspector: pass `value` and
`onChange`, with optional `selectionLabel` and `onReset`. Values are presentation
units (CSS pixels, degrees, percent). Products adapt these values to their own
document and renderer. The gallery preview is session-only; no product property
model or existing inspector is replaced.

### Former Swift-based Anima Studio: panel motion and frame spacing

The **Aether Animation Studio** concept app is labeled “Former Swift-based
Anima Studio app — migrated to Aether UI.” It uses the shared default animated panel
lifecycle and measured visible-zone insets for framed workspaces. Map, CAD and
Animation, IO and Sketch inherit the full-size canvas and shared safe-zone measurements. Tables opt into an inner framed region; canvas controls use shared safe-edge anchors. See
[the source-backed verification and remaining limits](gallery/NATIVE_PARITY.md).
This is not exhaustive 1:1 migration sign-off.


### Native inspector and relation widgets

`LayoutStyleControls` (`@aether/ui`) offers controlled or local direction,
alignment, spacing, border, fill and clipping edits with a live preview.
`RelationEditor` (`@aether/ui` or `@aether/ui/concept-widgets`) is a display-only
form: consumers supply kinds, compatible DOFs, units and async action state.
Production Aether Animation performs conversion/validation through its own
adapter and canonical Python engine.

`MaterialBrowser` (`@aether/ui/concept-widgets`) accepts `usedIDs`,
`assignmentLabel`, an optional `environments` catalog, `environmentID`,
`onEnvironmentSelect` and `environmentControls`. Material and Environment are
separate views. The central native showcase demonstrates eleven materials and
five environments; product catalog data stays outside the reusable widget.


Shared workspace chrome now reserves safe padding automatically in every
`WorkspaceShell`. Common appearance preferences live in every `SettingsWindow`
under **Aether Studio → Appearance & icons**, and are also available from
`ThemeMenu`. Theme, light/dark/system and tool icon-pack choices carry across
applications in the same browser. Gallery icon-pack scopes remain explicit.


**Settings → Aether Studio → Workspace spacing** customizes the shared workspace
margin and floating-control clearance. Safe areas remain enabled, defaulting to
10px and 22px; **Restore Aether UI defaults** resets both values. These spacing
preferences persist in this browser and update other open Aether applications.


Workspace chrome is turnkey: `WorkspaceRibbon` defaults to the shared glass
appearance, workspace selector column and expanded density, and follows its
parent shell's docked/floating layout. Put it in `WorkspaceShell.toolbar`; avoid
a second product wrapper or a separate app-level toolbar position. The shell
automatically recognizes framed shared toolbars, retains panel drafts by default,
and keeps tall sidebars below the measured toolbar. Use `StatusBar` for the
common accessible status strip. Explicit variants remain available for the
showcase and intentional alternative layouts.

Adoption coverage and remaining product overrides:
[UI adoption audit](../../dev/docs/reality/UI_Adoption_Audit_2026-09-30.md).


Sidebar rails select a single panel per side by default. Selecting another icon
replaces the current panel without losing its retained editor state; the opposite
rail stays independent. Old saved layouts follow this default too. Specialized
layouts can opt into `WorkspaceShell panelSelection="multiple"`; the kit's
`panelStack` also defaults to exclusive selection.


An additive full-height floating sidebar is available with
`WorkspaceShell sidebarVariant="tabs-top"` or `"tabs-bottom"`. Tabs stay at the
chosen edge while the inspector scrolls, with single selection, preserved edits,
and the shared safe-area/motion behavior. See **Widgets → Menus → Sidebars** for
both live variants. `TabbedSidebar` is exported for standalone use; the existing
rail remains the default.

Every standard sidebar orientation supports **Attached** (one frame around tabs and content) and
**Detached** (separate tray and content frames). The combined card is the default
at every viewport, including touch devices. Legacy automatic preferences resolve
to combined; detached requires an explicit choice. There is no duplicate window header. Tabs switch/collapse panels; detach/close
buttons and collection window commands are omitted. Saved detached panels return
to the sidebar when selecting this variant.

Theme-menu and appearance-settings choices persist across reloads and host account
refreshes. An explicit browser theme takes precedence over host defaults; without
one, the shared controls show the resolved account/application/workspace theme.

Compare sidebar designs using the **Sidebar design** header menu in the CAD and
migrated Animation Studio demos, the main gallery and workspace-shell specimen.
Choose **Side rail**, **Top tabs**, or **Bottom tabs**; each demo remembers its
choice. Animation Studio also exposes this under **Settings → Layout**. These
use the same `WorkspaceShell` variants as Map, with a shared `SidebarDesignMenu`
control. Historical Mockup/Atlas shells retain their own reference layouts.


**Settings → Aether Studio → Toolbars & tabs** is included in every shared
`SettingsWindow`, also reachable through `ThemeMenu` on app homes. Configure tab
placement, combined/default or detached/secondary containers, compact/touch tab size, labels,
toolbar density, ribbon appearance, workspace selector, tool-group popup layout,
animation and workspace spacing. Shared choices persist under
`aether.workspace-chrome.v1` and synchronize across apps/tabs on the same origin.
“App default” preserves a product’s existing local preference. Both shared
toolbar families inherit density; family-specific controls identify their scope.

Attached panels animate their frame open/closed using the same 180ms motion and
easing tokens as the home navigation sidebar. Top tabs stay at the top; bottom
tabs stay at the bottom. Editors retain their state when switching or collapsing.
System reduced motion and the **No animation** preference skip these transitions.
`sidebarAttachment` explicitly pins a shell specimen; `inheritChromePreferences`
can pin its placement/motion policy. **Widgets → Menus → Sidebars** compares the
attached and detached variants and offers an automatic/manual preview selector.

The standard rail now uses the same `TabbedSidebar` frame as top/bottom tabs:
fixed square icon targets, one attached background and outline, and no shell
float/close actions. Explicit multiple-panel layouts retain their window controls.
**Toolbars & tabs → Opening direction** separates the requested edge from the
content side. Inside expands toward the workspace; Outside reserves the full
panel depth outboard of the tray. The tray stays fixed during collapse/reopen,
including horizontal placements. Side cards animate width, horizontal cards
animate height, with home-navigation motion tokens. The showcase compares all
three orientations with a direction toggle.

The Sidebars showcase also lists **Combined Card — Primary** and
**Detached Tray — Secondary** as separate, equivalent live specimens. Both offer
the same icons, editable content, tab placements and floating/docked layouts.

Docked combined sidebars are flush to the window edge with square corners and
no floating shadow or inset. A thin internal rule separates the icon tray from
the editor, following its side/top/bottom orientation. Floating mode retains the
rounded card and safe clearance; both modes share the same unified background.


### Icon command cells and tooltips

Horizontal header and toolbar icon commands fill the section height; vertical
rail commands fill its width. Keep glyph sizes unchanged, use rectangular
edge-to-edge hover targets, and place keyboard focus inside the same cell.
Selected and disabled states remain distinct. Tooltips name the action concisely
(e.g. Appearance, Apps, Windows, More); do not append click instructions. Keep
state and necessary detail in accessible labels and contextual help. This is
shared behavior, not a product-specific compact-button override.

### Unified tray selection

Grouped selection cells (sidebar tabs, rails, toolbar groups and segmented controls)
use the shared `selection-cell-inset/gap/radius` theme geometry. Current themes set
all three to zero. The group owns its rounded outer frame; active, hover and focus
states occupy the whole cell. A theme can opt into inset cells explicitly.

Attached and detached `TabbedSidebar` trays share 44px cells and 26px glyphs by
default on desktop and touch (46px tray including its border). Explicit Compact
uses 36px cells and 22px glyphs. Joining surfaces changes only their frame and the space between
tray and content. Collapse retains the configured edge in either mode.

The compact editing overlay is available through
`openFeatureWindow({variant: "compact", headerIcon, ...})`. It retains the same
body builders and validation as the standard window, with an icon/title header,
full-width pill tabs and bottom Cancel/Apply actions. The gallery demonstrates
all nine standard CAD bodies in both presentations.

Toolbar category text tabs retain their rounded reference shape independently
of full-cell icon selection. WorkspaceRibbon and ToolSidebar use the theme row
radius for these tabs; the ToolSidebar strip keeps its original padding/gaps.

FloatingToolbar distributes its fixed-size command tools across the available
tray width, with the evaluation capsule at the trailing edge. This reference
variant uses inset rounded blue icon selections; other toolbars retain their
own selection geometry. Narrow trays scroll without shrinking tool targets.

`IconButton` exposes `appearance="rounded"` (36px, 10px corners) and
`appearance="cell"` (44px, theme selection-cell corners) alongside default/plain.
Use controlled `aria-pressed` for selection; all appearances use the same accent
and selected-text colors. Hosts own grouping and spacing. FloatingToolbar uses
the shared rounded appearance with its established 40px/28px tool sizes.

`IconButton appearance="glyph"` is a quiet 28px state control: no border or fill,
muted off and accent-colored on, retaining keyboard focus and aria-pressed.
The inspector's axis locks use it. TabbedSidebar Automatic now uses 36px cells
and 20px glyphs; Compact is 30/18 and Touch remains 44/26. Both attachments share
the same dimensions. The reference inspector uses a 36px Display/Properties
selector with 12px labels and 28px numeric fields.

### Workflow widget standards

The reference workflow collection is available as shared UI exports in
0.2.0-alpha.106 with assets alpha14. See Widgets → Workflow widgets for independent
forms, lists, plans, mapping and account/team controls. Every new primitive has
an Elements entry; Aether Slate provides matching light/dark themes.

```tsx
import { AuthenticationForm, DashboardCard, PasswordField } from '@aether/ui';
// Supply app-owned actions; the shared widget performs no network requests.
<AuthenticationForm appName="My app" mode={mode} onModeChange={setMode}
  onSubmit={submitCredentials} />
<DashboardCard density="compact" title="Connection">
  <PasswordField aria-label="Access token" autoComplete="off" />
</DashboardCard>
```

Workflow widgets emit callbacks; apps own accounts, billing, data and persistence.
The showcase's light/dark previews and local actions are demonstration adapters.

### Analytics reference app

Apps → Aether Analytics (`?demo=analytics-dashboard`) is a local interactive mockup
assembled from shared components. Its `ComparisonChart` line/bar series,
`GaugeChart`, `RankedList`, compact `DashboardTable` and captioned `DashboardCard`
are independently shown under Widgets → Analytics charts + rankings.
`ChartLegend` and `StatusBadge` have Elements pages. `DashboardNavigation` reuses
the standard collapsible sidebar and tinted navigation rows, independently under
Overlays → Dashboard navigation. Aether Analytics is a light/dark theme in the
shared menu; the app opens in dark mode without replacing saved preferences.
CSV import/export and all data/metrics are local demo behavior.

`AppNavigationBar` provides compact top navigation in the standard `DocumentBar`.
Supply `brand`, optional `mark`, `items`, `activeID`, `onNavigate`, `onHome` and
optional shared `actions`. Page navigation wraps below the identity on narrow
containers; the row scrolls if needed. See Overlays → Navigation bars → Top app
navigation, or switch Top/Side navigation in the Analytics demo's Settings.

Aether Avatar Studio (`?demo=avatar-studio`) composes the standard floating sidebar
and toolbar around reusable `MediaPreview` and `ThumbnailPicker` widgets. Scene
presets, framing, mirror, freehand drawing, text, resolution and PNG export are
interactive. Widgets → Color & appearance includes the independent preview and
control specimens; all constituent elements already have library entries.
