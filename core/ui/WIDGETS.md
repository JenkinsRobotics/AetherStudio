## Shared application design — Alpha 0.1

`StudioAppFrame`, `StudioDocumentBar` and `StudioWorkspace` compose the approved
Model Studio design for real products. The header is transparent, with document
identity on the left and shared pin/settings/app/account controls on the right.
The default Model Studio theme applies only when there is no host or user choice.

`StudioWorkspace` uses the existing controlled `WorkspaceShell` with the additive
`design="studio"` presentation: 216px resizable floating side cards, the primary
left tree kept visible beside an auxiliary card, 42px side-control trays and a
center workspace selector. Product tools occupy the bottom tray; specialist
workspaces can pass `toolPosition="top"` to preserve a timeline. `compactTools`
on `WorkspaceRibbon` keeps category navigation and direct tools reachable.
Measured tray clearance protects bottom canvas controls. Existing shell presets
and saved user layout choices remain available.

`WorkspaceFileBar.fileActions` places product file commands on the right beside
the shared folder and part/document manager. Components own presentation only;
products retain geometry, commands, persistence, accounts and service behavior.
UI145/assets27 are consumed by CAD, Map, Animation, Sketch, IO, Vector, Drive and
Studio. Vector currently exposes its home only; no editor implementation is implied.

## Branch version timeline and compact legend — 2026-10-17

A host can pass `VersionControl.activeBranch` for the checked-out branch. The
header has a title/settings line, a full-width search line, then version actions
and a right-aligned branch dropdown. There is no Close X. Branch rows show saved thumbnails, name/date/status, selected summary and an
explicit missing-image fallback. Row actions open changes/compare/restore;
selection alone stays compact and can be cleared. The branch chooser returns to
the full graph. First-parent ancestry retains the branch's shared history through
its fork; merged source history stays in the complete graph. Create actions pass
the selected/current-branch source ID to the host.

The pinned bottom legend pairs each shared glyph with its full visible name.
Compact 16px rows use two columns in side trays and three in wider panels.
Selected-version actions keep their icon and a bounded single-line label; the
compact Changes count retains its full Show/Hide accessible name and tooltip. No count/demo caption or additional create
button appears at the bottom. Model Studio supplies its current branch and captures
the viewport when creating a demo version. Stored thumbnails stay on their own
entries; old example versions without images are never assigned the live snapshot.
This remains a window-local review demo, not a geometry checkout operation.

## Version control symbols and footer — 2026-10-17

Version control has no built-in close X or result-count footer. Its host toggles
the tray. The example adapter supplies no demo caption. The pinned type legend
uses shared artwork: hollow workspace, solid version, small change node, outlined
release candidate, filled release, release with an obsoletion dot, automatic
version and three-node branch/merge symbols. These symbols also identify rows and
menus; the three-node branch glyph identifies the header and workspace toggle.
Legend labels stay on one line in two columns (three in wider panels). The actual
ancestry graph, selection/deselection and creation/filtering behavior are retained.
The optional footer slot remains available for host-specific content.

## Feature tree header actions — 2026-10-17

The shared Features header shows its title, New folder and feature actions menu.
Rollback stays in feature context menus and the draggable/keyboard-accessible
history divider. The divider is a plain handle without decorative end marks;
there is no separate rollback button in the header.

## Model Studio workspace icon controls — 2026-10-17

Change workspace remains the sole dropdown in the top workspace toolbar. Display
style is a direct cycle: Solid (filled cube), Shaded with edges (outline cube),
Wireframe (dashed wire cube). Construction plane cycles Hidden/XY/YZ/XZ; selection
and camera planes remain available in the inspector and update the same state.
All adjacent controls use the shared IconButton glyph appearance: the current
icon/tint communicates state, with no selected-cell fill at rest or on hover.
Materials, Environment, Study and Run simulation are icon-only; existing render
settings and the honest unavailable solver state remain. Tooltips name the current
and next cycle state. Shared toolbar keyboard navigation and focus cues remain.
Gallery-only composition; no new shared package or artwork API.

## Transparent header utilities — 2026-10-17

The transparent header reference and Model Studio demo compose the existing
WorkspaceQuickControls and CAD account card, with compact28px controls/16px glyphs.
Settings → Header, the app tray and per-app pin order/visibility use the same CAD
preferences as the bordered header. The shared one-time launcher/share pin
migration respects later user choices. Account styling is loaded with its content,
so the standalone demo has the same dropdown; it shows the honest local identity.
Comments toggles the demo's existing panel. Share copies the preview URL and
explains that local edits are not included. The file menu remains in the part tray.
Gallery-only composition; no new shared package API or product session behavior.

## Version control — compact review variant, 2026-10-17

`VersionControl` is a new content-only view alongside the unchanged
`DocumentVersionPanel` and revision-tree references. It uses the Comments/Tasks
review density, shared controls, one top Create version split action, searchable
versions, Branches/Releases tabs, branch/sort/deprecated filters and an expanded
selected entry with preview, author/time, changes and capability-gated actions.
It has no bottom create callout. The host owns entries and callbacks; unsupported
restore/merge remain disabled. Host-supplied lanes, parents and primary parents
drive an actual branch/merge graph, reusing the standard filtered-ancestry helper.
Measured row positions keep connections aligned through selection/resize/sort.
Rows begin collapsed and clicking the selected row clears selection. The pinned
bottom version-type icon legend remains visible while the graph scrolls.

Model Studio's button/sidebar is named Version control. Its gallery adapter uses
window-local example milestones; creation/branch/release and metadata comparison
are interactive, while model geometry and stored document versions are unchanged.
The original Versions and history specimen remains beside the new variant under
Widgets → Revision trees + branches. Other references and production consumers
retain their existing widgets.

## Shared feature tree — 2026-10-17

`FeatureTree` is a content-only authoring widget built on `TreePanel` and
`TreePanelSplit`. A sidebar, floating panel or other host supplies its container.
Default geometry (Origin, Top, Front, Right), the ordered Features section and
Parts use the same row metrics, selection, keyboard handling and theme tokens.
`FeatureTypeIcon` maps feature types to shared artwork, including sketch, revolve,
extrude, fillet, chamfer, shell, sweep, loft, mirror and pattern.

`featureTreeActions` defines one menu order and action vocabulary. Use
`featureTreeMenuItems` to present its folder submenu. Hosts provide
`availableCommands`, `onCommand` and optional `canCommand`; unsupported actions
remain disabled with a reason. The contract includes rename/edit, sketch copy and
dimensions, folders, visibility, suppression, dynamic suppression, comments,
normal view, dependencies, rollback, ordering, appearance and deletion. The UI
never evaluates a feature, resolves dependencies or saves a product document.

Hidden, suppressed and rolled-back states are independent. Visibility is a hover
control; hidden rows retain their visibility control. Suppressed names are struck
through. The rollback line supports drag and arrow/Home/End keys. Rows reorder
before/after features or into folders; references and parts cannot enter history.
Text/type filtering disables ambiguous history edits. F2 renames, Delete deletes,
and Shift+F10 opens the common context menu. Reference names/deletion are protected.

The interactive CAD feature-history sample sits with every tree variant in
Widgets → Lists & trees. It demonstrates local presentation state, including
folders and rollback; services such as model editing/dependencies are explicitly
unconnected. Wheel/reference/enclosure browsers use `FeatureTree` with their real
existing callbacks. Generic imported-object trees remain item/scene browsers and
consume the same menu helpers. CAD consumes the versioned helpers through its
existing validated command adapter; CAD owns actual history order and rebuilds.

## Model Studio Comments and Tasks — 2026-10-17

The Model Studio panel uses shared tabs inside its existing floating DockPanel,
without a redundant document-name / close header. Comments uses the conversation
reference with avatars, sample images, a version card and the AI-style composer.
Tasks groups compact tickets into named component/work cards with progress rings.
Completed tasks have their own disclosure; fully completed cards hide by default
and are available through Show completed cards or the Completed status filter.
The matching bottom input selects a destination card and adds tickets directly;
users can create/rename cards and move tasks through the shared edit dialog.
Status/assignee/search filters and sorting remain available.
Tasks has no conversational messages or task-created chat receipts. Both tabs keep
the shared composer and independent drafts. The reference layout uses full-width
Comments/Tasks tabs and a separate filter row. Document-name and Close chrome
are omitted from the side widget; Workspace panels toggles control its visibility.
Status (All/Open/Resolved for comments, All/Open/In progress/Completed for tasks)
and editable tags filter the global review list across version references; there
is no Main, branch or part scope. Comment searches preserve whole discussions,
and tag chips filter both tabs. New items inherit the active tag; edit dialogs
accept comma-separated tags. Labels are window-local presentation metadata.
The44px text input has no resize grip; the demo-review caption is omitted.
Demo content stays local to the window.

Task lists use a single44px row at every sidebar width. Titles truncate instead
of wrapping; clicking a title opens its full text, reference and attachments.
Assignee, date, status and actions remain aligned. Compact status dots retain
text tooltips and labeled menus; wide content also displays the status label.
The shared dialog edits title, status, assignee and due date after task creation.
The task input supports attachments and model/version references. Other demo studies
keep their original review variant. Existing shared components own controls and
containers; the gallery adapter owns only local sample state.

## Showcase categories follow function — 2026-10-17

All controls are review specimens. Their source remains a caption, not a separate
reference category or collapsed subgroup. Six mixed studio-controls pages are
split across the existing functional showcases: five scene/feature trees join
Lists & trees; transforms/properties/dimensions join Inspectors; finishes/lighting
join Appearance; preview transport joins Timelines; comments and revisions join
their collaboration/history pages; viewport controls and Measure join Viewports
and Floating windows. All 30 controls remain interactive. Existing native/kit
specimens appear openly beside shared controls, including on Elements.

`gallery/showcase/studio-specimen-sections.ts` records the routing. Old page links
redirect to a relevant category; saved collections expand to every destination of
their former mixed page. Standalone demo apps and the approved overlay/component
standards remain unchanged. Grouping a specimen does not grant new app adoption.

## Model Studio standard tree host — 2026-10-17

Model Studio already uses the same TreePanel/TreePanelSplit as the approved Trees
+ hierarchies specimen: 24px rows, 13px text, standard indentation/icons, filtering,
state visibility and independently scrolling collections. The CAD floating host
now removes its extra horizontal inset and allows the specimen's 306px content
width, capped to leave clearance beside the centered modeling tray. Compact/mobile
containers retain their responsive widths. The app theme remains local; no shared
tree styling, data model or extra tree commands are introduced.

## Model Studio workspace controls — 2026-10-17

The CAD demo's top floating tray now owns workspace context, with a Design / Render /
Simulation selector and mode-specific controls. Design uses existing shaded/edges/
wireframe state and construction planes; Render opens existing materials and a
shared Popover for exposure/ground shadows, initialized/reset from the canonical
Model Studio environment preset. These settings drive the real viewport and remain
local view preferences. Simulation is an explicit preview with disabled Run and
no fabricated setup or results. Switching retains geometry, selection and document
state. Redundant app identity, file menu/filename and object-selection button were
removed from this tray; file operations remain in the document sidebar/header
search, and grid/zoom/section/measurement remain in the bottom view tray.

## Model Studio floating auxiliary card — 2026-10-17

The CAD demo's Comments/Tasks, AI and Revisions share the approved `aui-float`
frame around their existing DockPanel body. Its border, surface, corners and
shadow match the scene's other floating panels. The card is inset below the
transparent header and from the left/bottom window edges. Narrow windows leave
the bottom panel toggles exposed; all three widgets retain their existing state,
scrolling and close actions. The content widgets introduce no frame of their own.

## Model Studio transparent app header — 2026-10-17

The CAD Model Studio demo composes the approved transparent `DocumentBar` across
the full window, over the continuous viewport surface. App identity, live study
name and workspace selector move from the document sidebar into this header.
File controls remain in the sidebar and document toolbar. Search uses the shared
`CommandPalette` and existing modeling/document actions; workspace properties and
Help reuse existing dialogs. Account presentation is explicitly local; connected
sharing and notifications remain unavailable. The fixed 56px header follows the
standard app metric; panels clear it, narrow layouts retain core actions and the
bottom trays keep their approved dimensions. Other demo layouts are unchanged.

## Model Studio auxiliary tray cells — 2026-10-17

The bottom workspace/view trays in all four Model Studio demos use equal,
edge-to-edge action cells, matching the approved slim sidebar strip:40px buttons
inside a42px tray,6px corners, no cell gaps or outer padding. The existing shared
IconButton provides active/hover/focus behavior. Touch targets retain44px minimums
and narrow trays scroll if necessary. This is scoped gallery composition;
central modeling and top document toolbar metrics remain unchanged.

## Model Studio comments and tasks — 2026-10-17

The four Model Studio demos compose the existing `DocumentCollaborationPanel`
comments and action-item widgets inside their existing full-height `DockPanel`.
`SegmentedControl` provides Comments / Tasks tabs with the same presentation as
Display / Properties. Gallery-only `DemoReviewPanel` adds no frame; scoped styles
match the Model Studio inset fields, separators, typography and spacing.
The official CAD `panels/notes.tsx` concepts and shared document widgets are the
reference for comment filters/composer/replies and task search/type/status/
assignee/due controls. A window-local adapter enables those existing interactions;
it does not create Studio collaboration or saved product review data. Drafts,
filters and items survive tab and AI/history switches while the window is open.

## Standard demo document menu — 2026-10-17

Model Studio and the Sketch/Map/IO studies now follow the official CAD document
menu (`Aether-CAD/src/react/CADDocumentControls.tsx`): Save, Commit, Recover, Open,
Import, document details, Export, Rename, Move, deleted-workspace restore, Copy,
Update, units/properties, Print, document link and Close. Sample reset/About/Back
commands appear in a final Demo group. Every header/file trigger uses one menu.
Shared MenuButton/Menu and Dialog/FieldRow/TextField provide the presentation;
long menus scroll within short windows without a new container design.

Gallery-only `demo-document` supplies local `.aetherstudy.json` download/open,
validated per-app object adapters, delayed browser recovery, rename/descriptions,
workspace metadata, independent copy downloads, browser Print and unsaved-change
confirmation. Opening replaces model edit history; object counters resume safely.
This file format is separate from production files. Commit/Move/restore/link need
Studio; production imports, linked updates and unit conversion remain visibly
unavailable with explanations. No PDM API calls or fake production functionality.
Public package versions and official CAD source are unchanged.

## Model Studio app studies — 2026-10-16

Apps includes independent Aether Sketch Studio, Aether Map Studio and Aether IO
Studio demo windows (`?demo=sketch-studio`, `map-studio`, `io-studio`). They reuse
Model Studio's interface preset, floating toolbars, detached TabbedSidebar,
DockPanel, TreePanel/TreePanelSplit, document tabs, fields, menus and dialogs.
Approved wordmarks and app drawer artwork identify each application. The canvas
is full-window, with no enclosing presentation card. The existing CAD demo stays
separate.

Original gallery artwork shows a vector speaker drawing, a projection-mapping
pavilion and a controller PCB. Local interactions include selection, visibility,
position/color/opacity edits, pan/zoom/fit, comments, footer lists and SVG export.
Sketch adds circle/rectangle studies and stroke width. Map animates its projection
pattern; IO toggles a copper overlay. These are visual studies, not product
engines, document formats, fabrication outputs or connected hardware. The assistant
is visibly disconnected; Revisions uses the existing read-only standard fixture.
No new shared container design or public library/package changes.

## Widgets inherit their container — Jonathan, 2026-10-16

The slim sidebar tab strip is 42px high (40px shared button cell plus borders),
matching the document toolbars at the bottom of Model Studio. Its glyphs use the
same 20px size. The existing touch-size preference remains available.

Widgets supply controls, content, local headings and internal grouping. They do
not draw an outer window/card border, rounded frame, surface fill or shadow.
Overlays owns sidebar, toolbar, floating-panel, editing-window, dialog and popover
containers. Compose a widget inside one of those when a frame is needed; do not
bake a second frame into the widget or its showcase sizing wrapper.
Reference Panel and PanelCard anatomy examples are filed in Overlays → Floating
windows, alongside other container examples; they no longer appear as list widgets.

The approved TreePanel remains the reference. Lists/tables, inspectors, material
and assistant widgets, workflow forms, native Layer Stack and hardware specimens,
and gallery property/history/CAD-content wrappers now follow it. Controls, item
selection, internal fieldsets, cards presented as cards, canvas drawing surfaces,
and actual Overlay windows retain their own meaningful visuals. DashboardCard
and reference PanelCard expose `contentOnly` for reusing their heading/body layout
inside widgets; their default framed container presentation is unchanged.

## Model Studio approved scene tree — 2026-10-16

The scene browser uses the same `TreePanel` + `TreePanelSplit` composition as the
approved Trees + hierarchies specimen: standard typography, glyphs and row sizing,
a Scene hierarchy above and a real Parts collection below, separated by the
standard movable divider. Each list scrolls independently. Both project the same
model selection/visibility; hidden rows use the standard hidden glyph, and visibility
commands use the standard row menu. No count-only footer or reduced tree styling.
The CAD header stays above the tree. This applies to the left browser, Scene
inspector tab and independent Model browser specimen. Camera behavior is unchanged.

## Model Studio standard revision graph — 2026-10-16

Model Studio Revisions renders the complete shared `DocumentVersionPanel`, using
exactly the existing read-only history fixture from the document-services showcase.
The sidebar labels this as example history. Keep the widget's standard header,
actions, search, graph and legend; do not add undo/redo, snapshot restoration,
extra action footers, or reinterpret the scene undo stack as version history.
The same panel appears in Model studio controls. The earlier custom session-history
projection and restore controls were removed at Jonathan's correction.

Component audit: scene objects use TreePanel; toolbars use FloatingToolbar;
inspector framing uses TabbedSidebar; footer uses DocumentTabBar; chat uses
AssistantPanel; Measure uses FloatingPanel; dialogs, menus, icons, identity and
numeric/color/choice fields are shared. Model-specific inspector rows, material
tile wrappers, command-result arrangement and chat composer styling are local
compositions. The local comments list/composer remains custom, not the shared
DocumentCommentsView. The disabled Voice button is native markup; the hidden file
input is a browser input. The procedural 3D viewport is gallery-specific Three.js.
Do not describe this demo as using shared widgets exclusively.

## Model Studio navigation gestures — 2026-10-16

The viewport opens Model actions after releasing a stationary right click, not
on the browser's context-menu event. Right drags pan without opening a menu;
movement remains a drag even if the pointer returns to its starting point.
Cancellation and window blur discard the pending click. Left clicks retain
selection/measurement, and Control-click or the keyboard context-menu shortcut
remain available. This is gallery viewport behavior; shared menus are unchanged.

## Model Studio Measure popup — 2026-10-16

Measure opens its own shared FloatingPanel window above the workspace. The
modeless popup remains open while picking surface points or orbiting, can be
moved by its header (pointer or arrow keys), and stays inside the current workspace
when resized. Distance and Clear live in the popup; Close/Escape ends measurement,
clears its markers and returns focus to the Measure launcher. Section view remains
independent. The same popup is available in Model studio controls. Gallery-only;
no new shared frame/API or exact-CAD semantics.

## Model Studio workspace and view rows — 2026-10-16

Matching shared FloatingToolbar document rows anchor the bottom left and right.
Left: Comments, AI chat, Revisions, Part list. Right: Ground grid, Auto zoom,
Section view, Measure. Rows remain accessible when narrow panels collapse; the
optional part list reserves its own height above host chrome. Comments, AI and
Revisions share the independent full-height left sidebar without discarding their
local state. Comments support adding/resolving/removing session notes. Revisions
uses the standard shared read-only history example, independent of scene undo. Auto zoom fits all visible scene geometry. Section
view clips mesh/edge rendering by axis, offset and side, with a world-space plane
helper; it is an uncapped viewport cutaway. Measure ray-picks two visible surface
points and draws world-space markers/line with a straight-line cm readout. Editing
the scene or section clears stale measurement points. These are gallery controls,
not exact CAD tools. New panel contents are also available under Model studio
controls; existing shared containers, glyphs and package versions are retained.

## Model Studio independent chat sidebar — 2026-10-16

AI chat keeps New chat in its title row and omits the part-name/Main row and
Close action. Comments/Tasks and Version control also omit their sidebar Close
buttons. Workspace panels toggles control these trays; narrow layouts reserve
space above those buttons so they remain reachable. Drafts and filters survive
hiding/reopening.

AI chat now occupies its own full-height far-left DockPanel beside the entire
model workspace. The CAD header and scene browser remain visible and interactive
in their existing panel; the optional parts footer belongs to the workspace to
the right of chat. Opening/closing chat resizes the workspace and its live canvas.
Workspace controls respond to the available column width, while phone layouts
use a full-height collapsible chat drawer. Chat drafts/history and local-preview
semantics are retained. The reference-inspired composer has a single rounded
border, roomy text area and attachment/Tools/style/Voice/send controls. Shared menu
buttons choose draft tool intent and response style; attached file names remain
local and can be removed. Tools do not execute provider calls, and Voice stays
disabled with an explanation until a provider exists. Sending records the prompt
and its chosen draft metadata in the local conversation; files are not uploaded
or parsed. This supersedes the left scene-content replacement in the initial
workspace-toggle concept below. Gallery-only; no shared API change.

## Model Studio part tray controls — 2026-10-17

The bottom part tray now starts visible and owns document actions at its right
edge: Folder manager, Part manager and File menu. The header no longer repeats
the file hamburger. The file menu retains the same local document commands.
Folder manager organizes this window's part tabs, without changing CAD bodies or
file locations; groups survive hiding/showing the tray. Part manager reuses the
content-only FileManagerPanel to search/select the same scene bodies and folders.
Shared DocumentTabBar.trailing reserves measured action width before choosing its
visible tabs, keeping all three controls reachable as tabs move into overflow.
The existing Part list toggle, add, next, selection and file shortcuts remain.

## Model Studio workspace toggles — 2026-10-16

The Model Studio demo's lower-left toolbar replaces undo/redo with Parts footer
and AI chat toggles, retaining frame and grid. Undo/redo remain available through
keyboard shortcuts and command search. The optional full-width footer composes
shared `DocumentTabBar` (studio variant) in the app's graphite theme: actual scene
parts, add-primitive menu, selection, overflow/next and overview all project the
same scene state. Its height is reserved outside the viewport and inside the host
app area. The left-side chat keeps the CAD identity and uses shared
`AssistantPanel`; drafts and conversation survive hiding it, with New chat and
selection context. It is explicitly a local preview: sample questions inspect
scene data, arbitrary prompts are retained with a no-provider response, and no
AI service/modeling operation is invoked. Narrow windows expose the same toggles;
short chat panels scroll. No shared component/package or product semantics change.

## Standalone demo viewport sizing — 2026-10-16

Demo roots fill the available app area, including when Studio reserves its bottom
status row. Gallery-only DemoViewport rules replace viewport-sized/fixed roots
without adding a presentation frame. Short editors retain internal panel scrolling;
minimum-size and content-heavy demos can scroll within the root so lower controls
remain reachable. Component specimens and production app sizing are unchanged.

## Animation header alignment — 2026-10-16

The Aether Animation header specimen keeps its approved icon/wordmark at the
left, places its existing workspace switcher in DocumentBar's centered slot,
and retains the app, sharing and account controls at the right. Animate, Rig,
Show and Hardware remain menu choices. CAD and Map retain their existing layouts.

## Model Studio document header — 2026-10-16

The concept sidebar keeps the CAD wordmark, shows Scifirobot and its Main workspace
badge underneath, and uses the shared hamburger menu for file actions. Main is
context for the local study, not a connected version-history selector. The former
About chevron and MODEL STUDIO / LOCAL STUDY subtitle are removed; About remains
in the file menu. Both document menus use the same action definitions.

## Full-window Model Studio — 2026-10-16

The launchable Model Studio opens as the workspace itself: viewport to all four
content edges, with its floating document/modeling tools and sidebars overlaid.
There is no showcase caption, outer padding, maximum-width display board, rounded
window frame or external demo footer. Command feedback remains a small nonblocking
viewport overlay. The document title is Aether Model Studio for both direct and
workspace-window launches. On narrow screens the existing sidebar toggles remain;
the viewport follows the actual window size, including short windows.

## Application branding roles — 2026-10-16

Use `AppWordmark` for an app's combined mark and name in expanded navigation,
headers and home identity. `ApplicationSidebar` recognizes registered Aether names
(or an explicit `app`) and switches to the matching transparent `AppMark` in the
collapsed rail. `ApplicationIdentity` defaults to the wordmark and uses `AppMark`
when `showName={false}`. `AppNavigationBar` recognizes the same registered names.
Custom application branding remains caller-owned. Keep `AppIcon` square artwork
for app drawers, launchers and app cards. Text in document titles, metadata and
navigation rows is content, not a second app logo. Reuse the existing light/dark
wordmarks and unique A artwork; do not assemble new icon-plus-text lockups.

## Transparent app header — 2026-10-16

`DocumentBar variant="transparent"` removes the header fill, every outer border,
shadow and backdrop filter. It retains the shared dimensions, slots, drag region
and fully opaque controls. The parent workspace supplies the continuous surface
and suitable light/dark text tokens; do not lower the entire header's opacity.
Keyboard focus uses one inset edge. Existing standard headers remain the default.
The independent specimen is grouped under Overlays → Header bars → App header
bars, with light/dark workspace previews and working local workspace, search,
link, notification/help/account actions. It adds no app-only launcher. Review this
variant independently before product adoption.

## Studio navigation variant — 2026-10-16

`ApplicationSidebar variant="studio"` is the dark reference variant reviewed
beside the other navigation sidebars under Overlays → Navigation bars. It uses
a centered, stacked A/name brand, 232px expanded width, 72px icon rail, 44px rows
and 24px borderless glyphs. The current page uses a blue fill with one inset edge
and an attached left accent. The brand remains the single keyboard-accessible
collapse control; selection and per-device collapse preference survive toggles.
Navigation content scrolls above the pinned footer.

The optional `footer` slot accepts app-owned document/workspace/status widgets;
omitting it retains the existing tools/settings/account footer. The gallery
shows expanded and collapsed examples together, with local workspace and cloud
status previews. These cloud states demonstrate the control and do not connect
to a sync service. Standard and Captioned variants, and existing applications,
retain their current rendering. The shared `cloud` glyph is in Aether assets.

## Navigation workspace concept — 2026-10-16

**Aether Navigation Studio** on Apps is a separate layout study: one shared
`ApplicationSidebar` beside the full-height **Left / Center / Right** workspace.
Its A button toggles expanded navigation (224px) and an icon rail (80px); the
device preference persists and the live workspace remains mounted. This concept
has no outer Header or Footer. Modeling and command/view toolbars belong inside
Center only; document tabs/features/parts/parameters belong in Left, properties
in Right. The desktop composition has a 1140×600px minimum and scrolls as a whole
in a smaller host. Sidebar content scrolls independently.

It reuses the existing reference wheel, shared navigation, panel, ribbon and
element implementations. Live dimensions, materials, visibility, lighting,
orbit, turntable and PNG export work. Modeling modes and feature history remain
interface studies; edits stay in this session. No product app is migrated and
the Header/Footer standard below remains available. Launchers stay on Apps;
the reused controls remain independently reviewable in their existing galleries.

## Standard application layout — 2026-10-16

The standard app has five named regions: **Header, Left, Center, Right, Footer**.
Use shared `AppLayout`, composed from `WorkspaceShell` and its existing sidebars.
Apps supply widgets in each slot. This is the docked application standard; the
separate two-column general interface and optional floating/canvas presentations
remain available.

| Region | Owns | Size and span |
| --- | --- | --- |
| Header | App controls and identity, workspace selection, user, appearance, share | Full width; fixed 56px height |
| Left | Document navigation, files, structure, tabs, versions and history | Full body height; 280px default, resizable 220–360px |
| Center | Main canvas, viewport or editor | Remaining body width, with at least 360px reserved |
| Right | Properties for the active workspace, selection and tool | Same width limits as Left; full body height |
| Footer | Workspace-adjacent document tabs, status, transport, timeline or output | Full width; content height, at least 40px, capped at 30% of the app height; scroll excess content |
| Center → Top toolbar | Workspace tools | Center width only; 44px minimum, 96px maximum; overflow stays within its bar |
| Center → Bottom toolbar | View, selection and other workspace tools | Same center-only span and limits as Top toolbar |

Header and Footer sit outside the three-column body. Left and Right align with
its top and bottom, including Center's toolbars. Footer content can grow without
changing Header height or breaking sidebar alignment. Each region contains its
own overflow; the viewport must not push the outer bars out of view. Widgets use
12px padding and 8px gaps in the side regions. Canvas content may be edge to edge;
shared toolbars and Header/Footer widgets retain their own internal spacing.
`APP_LAYOUT_METRICS` exports these measurements. The desktop frame needs 960×480px;
a smaller host scrolls this frame rather than compressing its controls to zero.

`AppLayout` slots are `header`, `left`, `center`, `right`, `footer`, `topToolbar`
and `bottomToolbar`. Left/Right take existing `WorkspacePanel` arrays, retain
state through collapse and optionally persist layout through `storageKey`.
Omitting a bar removes its reserved space. Keep app launchers on Apps; review the
wireframe under Overlays → Window layouts. Its Footer content selector compares
Status, Documents and Timeline using the same outer frame.

## App header wordmarks — 2026-10-16

`AppWordmark` composes each of the nine existing transparent A marks with the
same outlined bold Aether and lighter product name. It supports 28/36/40px header
heights, automatic surface colors and explicit light/dark presentation. It is an
identity asset, with no frame, tile or action. `ApplicationIdentity` accepts
`identityStyle="wordmark"`; its home link and accessible name remain unchanged,
and `showName={false}` displays the matching A-only mark. Custom apps keep their
existing fallback. The existing icon style remains available.

Icons & Assets → Application header logos groups all nine variants and
light/dark surfaces for comparison, plus individual transparent SVG/PNG downloads
and a complete ZIP. App header specimens demonstrate the wordmark composition in
the standard DocumentBar. No production app package is implicitly repinned.

## Train wheel reference concept — 2026-10-16

Apps → Aether Reference Studio (`?demo=wheel-reference`) is a separate, closer
study of the latest Train Cart Wheel reference. It reuses DocumentBar, Rail,
DockPanel, Ribbon, TreePanel, Inspector, DocumentTabs, Popover and the existing
ViewportNavigationCube. Both sidebars span the body beside the center toolbar.
The 19-item feature tree, five workspace modes, full modeling ribbon and compact
property sheet retain the reference arrangement with Aether branding and artwork.
No new shared container or icon design is introduced.

Widgets → Color & appearance → Wheel reference controls exposes the compact
browser, property sheet and converted dimension fields. Existing shared fields,
switches, sliders, segmented controls, menus and dialogs supply their elements.
Launch links remain on Apps. The original Wheel Studio remains available.

A procedural deep-dish wheel, reinforcement ribs and mirrored wheelset provide
live orbit/zoom, dimensions/radius edits, materials, lighting, visibility, hidden
lines, uncapped cutaway, bounds, turntable and PNG export. Units convert editable
measurements. Custom properties and comments are local session data. The toolbar
and feature history are UI concepts, not evaluated CAD operations; Simulation is
labelled as a turntable preview, and Manufacture exposes dimensions/render export.

## Full-height three-column app wireframe — Jonathan, 2026-10-15

The main application body has three columns: left sidebar, flexible center
workspace and right sidebar. Both sidebars fill that body's height and align at
the top with the center toolbar. Top toolbars and bottom docks stay in the center
column; an optional app header and footer span the full window outside the body.
Sidebars scroll their own contents without shortening their columns.

Overlays → Window layouts includes the neutral **App wireframe · full-height
three columns** beside the existing two-column and populated application layouts.
Its header/footer checkboxes demonstrate each combination using the existing
WorkspaceShell and DocumentBar. The resizable/collapsible sidebars are shared
TabbedSidebar containers. Apps → Three-column app wireframe launches it full-size.
Launch links stay on Apps. Spotlight Studio now uses this same column anatomy,
with full-height side DockPanels and a toolbar spanning the center column. At
narrow widths its panels remain accessible through the header toggles.

## Spotlight Studio concept — 2026-10-15

Apps → Aether Spotlight Studio (`?demo=spotlight-studio`) composes DocumentBar,
Ribbon, DockPanel, TreePanel, DocumentTabs and ViewportNavigationCube with the
approved floating frame and borderless icon controls. Graphite colors, metallic
surface finishes and studio lighting are scoped to this gallery concept; shared
container implementations and product packages are unchanged.

Widgets → Color & appearance → Spotlight studio controls exposes the feature
browser, dimension/rounding inspector, physical surface controls and light rig
independently. Their elements use existing shared fields, sliders, checkboxes,
segmented controls and material swatches. Launch links remain on Apps.

The actual WebGL scene has editable enclosure geometry, separate visible parts,
physical metallic materials, environment reflections, a movable spotlight,
filtered shadows, an antialiased illuminated grid and turntable/orbit controls.
The shared cube controls and tracks the live camera. Three tabs retain independent
in-memory studies. PNG export captures the scene without UI. This is a procedural
render study, not an exact CAD kernel; reloading restores the sample documents.

## Model Studio concept — 2026-10-15

Apps → Aether Model Studio (`?demo=plasticity-studio`) composes the approved
FloatingToolbar, slim detached TabbedSidebar, DockPanel, TreePanel, numeric and
color fields, glyph locks, menus and material swatches into the Plasticity-inspired
three-column reference. No new shared container or icon variants are introduced.
Widgets → Color & appearance → Model studio controls presents its browser,
transform inspector and surface finishes independently. Existing elements remain
in their original Elements categories; demo launch links remain on Apps only.

The gallery owns an original procedural robot preview and ephemeral scene state:
orbit, part selection/visibility, numeric/gizmo transforms with locks, primitives,
materials, undo/redo, camera views, construction grids and JSON settings export.
The renderer redraws on changes; its shadows update only when scene objects change.
This is a visual concept, not a CAD kernel or production document format. Exact
booleans and CAD persistence remain product-owned and are not advertised as tools.

## Demo launch directory — Jonathan, 2026-10-15

Apps shows all concept applications and workspace windows together on one page.
Launch links belong there, not on Elements, Widgets or Overlays. Those tabs retain
independent specimens and container anatomy. Existing workspace bookmarks migrate
to Apps. Include standalone splash and Workbench windows in the directory too.

All demo cards use the same LinkCard grid and **Open workspace window** action.
No per-card new-tab fallback or component hyperlink lists are rendered. The shared
gallery launcher requests a resizable browser window, focuses an existing live
window without reloading its edits, and reports blocked popups in one retry dialog.
The browser ultimately controls whether a separate window is supported. Local demo
windows fill the viewport with their own app chrome; workspace examples add no
extra showcase header. Return-to-gallery actions close a launched window, leaving
the original Apps page intact. Direct demo bookmarks remain usable normally.

Product-owned CAD/IO destinations use the Studio host, not the standalone preview.
Installed Aether UI opens these with the same window action. Studio rejects
cross-origin launches; standalone previews retain a single Studio-address dialog
only when one of those cards is selected. No inline extra links or host policy
changes. Sign-in is required by Studio when no session exists.
`VITE_STUDIO_ORIGIN` can set that host for standalone development; installed `/ui/`
uses its own origin. Existing CAD URL overrides remain supported.

## Borderless breadcrumb focus — Jonathan, 2026-10-15

Breadcrumb focus has no outline, border or halo. Keyboard focus changes the link
color and underlines its text; separators and the current location remain quiet.
The collapsed-path menu trigger uses the same treatment. The gallery excludes
breadcrumb children from its generic focus-box rule and previews only one focused
link, matching real navigation instead of outlining every breadcrumb at once.

## Single-edge focus — Jonathan, 2026-10-15

Focus never creates a second outline outside a control's border. Buttons use one
inset keyboard-focus edge without an added halo; filled commands use a contrasting
edge. Pinned showcase focus samples use the same treatment as real controls.

Choice cards show their selected border once. Pointer selection does not add a
card-wide focus frame. Keyboard focus on the native radio is represented by one
edge on the card, with the radio's duplicate ring suppressed. Focus on interactive
content inside a selected card stays on that content, not its outer card.

## Borderless icon-button standard — Jonathan, 2026-10-15

All icon buttons rest as a glyph with no border or box. Three active treatments
are approved: Glyph changes the icon color, Rounded adds a rounded fill, and
Full cell fills the selection cell. Each is shown in Small (28px/20px glyph),
Medium (36px/20px) and Large (40px/24px). Rounded is the default. Keyboard-only
focus remains visible and touch targets remain at least44px.

Plain is retired as a design. Existing `appearance="plain"` and `"default"`
inputs resolve to Rounded for compatibility; no Plain surface or gallery option
remains. New callers use Rounded, Glyph or Full cell. The form example uses
Rounded. Legacy `.aui-icon-button` controls, including icon menu triggers and
window controls, share the default borderless surface. Comment composer icon
controls also use it instead of adding their own border.

This revision packages UI116 and installs the gallery. Older independently pinned
product packages retain their deployed version until qualified product adoption.

## Icon-button size standards — Jonathan, 2026-10-15

Elements → Icon buttons shows Small, Medium and Large together in glyph-color, rounded and
full-cell active treatments. These match the existing desktop container metrics:

| Size | Button | Glyph | Reference |
| --- | --- | --- | --- |
| Small | 28px | 20px | Compact floating document toolbar |
| Medium | 36px | 20px | Standard sidebar tabs |
| Large | 40px | 24px | Floating command toolbar |

`IconButton size="small" | "medium" | "large"` is independent of appearance.
Omitting size preserves existing host defaults. Shared IconButtonSizes CSS metrics
also drive FloatingToolbar and standard TabbedSidebar. Compact/slim/touch sidebar
variants retain their own sizes; touch icon-button targets remain at least44px.
All sample selection groups toggle independently, including deselect and disabled
states. The size is the button's cell, not the overall toolbar or sidebar width.

## Standard window layouts — Jonathan, 2026-10-15

Overlays → Window layouts shows both standard frameworks together, with live
containers. Full-window launch links are collected on Apps:

- General interface: **left navigation + main workspace**, using the existing
  `WorkbenchWindow` split container. The sidebar resizes/collapses; navigation and
  edited workspace content survive collapse.
- Application workspace: **left sidebar + wider center workspace + right sidebar**,
  using `WorkspaceShell`. Sidebars hold their own widgets; the toolbar and bottom
  dock belong to the center column (`toolbarSpan="center"`, full-width dock).

These are container anatomy specimens, separate from product concept apps.
The original `/ui/workbench-window.html` demo remains available. The Workspaces
launcher links both layouts back to their independent review page. Gallery-only
composition; no replacement shell or product adoption is introduced.

## Complete toolbar comparison — Jonathan, 2026-10-15

Overlays → Toolbars is one review page for floating command/document bars, the
bottom dock, workspace and kit ribbons, tinted floating/docked ribbons, the native
floating ribbon, command/selected/disabled button states, center trays and tool
rails. All four sections stay mounted; their labelled jump links scroll within
the page. The native toolbar states are intentionally visible together instead
of being hidden as mode duplicates. Sidebar navigation remains with Sidebars;
the command-only selection rail is filed with Tool rails. Reference status and
existing app adoption boundaries remain unchanged.

## Three-column container sizing — Jonathan, 2026-10-15

The application workspace layout has left and right side columns around a wider center
column. Sidebars hold widgets sized for their side column. Horizontal toolbars,
center trays and bottom docks belong to the center column and use its available
width, rather than inheriting a sidebar-sized fixed width. The center width is the
space remaining within the workspace, not the full browser width across sidebars.

The Bottom dock · collapsible tabs specimen lives under Overlays → Toolbars →
Floating toolbars. It uses the full center preview width and the same shared
WorkspaceBottomDock as its launchable workspace; the workspace links back here.
Its Timeline/Surfaces tabs and collapse behavior remain part of the container.
Keep the standalone specimen independent of a mock workspace. Product-specific
contents remain independently reviewable under Elements/Widgets.

## Collapsible navigation header reference — 2026-10-15

Overlays → Header bars includes a horizontal variant of the captioned reference
sidebar. It reuses the exact Dashboard/Editor/Reports item data, SidebarNavigation,
SidebarRow, AppMark and Avatar; captions and glyphs remain upright. The specimen
starts expanded. Its A mark hides all navigation, Settings and profile, leaving
only the A button, then restores the strip and current selection on the next click.
Hidden controls leave keyboard navigation and the accessibility tree; any open
profile overlay closes on collapse. Narrow layouts scroll the contents while the
A stays reachable. The original vertical sidebar is unchanged.

This is a gallery review variant, not a new app default. Container approval and
product adoption remain separate, as for the other concept header specimens.

## Reviewing related designs together — 2026-10-15

Header bars, Navigation bars, Sidebars and Toolbars each open one category review
page under Overlays. Every related subsection mounts once, in catalogue order,
with visible design headings and jump links. Reference designs are visible for
comparison alongside the existing standards; showing them does not approve a
new production standard. The header page includes the actual CAD/Animation/Map
headers, the concept header, top app navigation and header chrome references.

Use `reviewTogether` on a showcase category when its sections are variants of
one design family. Keep unrelated or expensive editor collections separate.
Preserve section identities so older links, source ownership and saved collections
remain valid. Previous/Next moves between review pages; Save as collection starts
with all sections on the current review page. Explicit saved collection members
remain focused, and none of the underlying specimens are copied.

## Material Studio concept — 2026-10-15

The launchable **Material Studio** app (`?demo=material-studio`) composes the
shared DocumentBar, FloatingToolbar, Rail, FloatingPanel, DockPanel, Tree and
Timeline containers. Its surface controls, object transforms, scene hierarchy,
lighting, material shelf and preview transport are independently available under
**Widgets → Color & appearance → Material studio controls**. The reusable
`MaterialSwatch` element is under **Elements → Selection → Material swatches**;
it displays an illustrative surface sample, while the app owns actual rendering.

The gallery owns its Three.js renderer and temporary scene state; no product
engine, CAD feature meaning or production animation document is imported. A
10-second turntable preview, primitive visibility/selection, material assignment,
transform handles/fields, undo/redo and JSON settings export work locally.
Floating panels can be moved, closed and reopened; narrower windows keep the
transform inspector docked. The bundled Infinite head scan by Lee Perry-Smith is
CC BY 3.0, credited in Help and `core/assets/models/lee-perry-smith/README.md`.

## Overlay container standard — Jonathan, 2026-10-14

The showcase tab is **Overlays**. An overlay is the reusable container, not the
particular widget currently displayed inside it. Sidebars, toolbars, navigation
bars, floating panels, editing popups, settings windows, dialogs and popovers are
container families. Apps reuse the approved family and its approved variants.
They do not invent a new frame for each tool, tab or content type.

The container owns its header/action placement, spacing, border/selection treatment,
size/anchor/collapse/movement rules, focus and dismissal where those apply.
Themes determine supported appearance variations through shared tokens. The app
supplies widgets, elements, data, labels and actions through the container's slots.
A sidebar remains the same sidebar when its tab changes from a tree to an inspector.
A CAD feature is content hosted by the shared editing popup; settings or information
can use a shared floating window without creating another container design.

Review containers independently on Overlays; review their content independently
on Elements or Widgets. Demonstrate their assembly only in launchable Workspaces.
New container families and visual variants need explicit design approval and a
shared implementation before app adoption. Concept/reference specimens remain
separate from standards; listing a reference does not approve it. Do not copy a
container's markup, icons or CSS into an app to customize its contents.

**Floating + detached windows** includes the modeless `FloatingPanel` and both
approved `FeatureWindow` variants: Standard (icon/title and accept/discard in the
compact header) and Compact (icon/title header with bottom Cancel/Apply). They
are standard containers, outside the concept-reference disclosure. The Standard
specimen opens with Mate and Compact with Sketch; each content selector offers
all nine existing feature bodies, a property form and information. Feature
validation, Help, movement and commit/discard use the shared implementation.
Feature-specific content remains independently reviewable under Widgets.

**Dialogs & popovers** is one comparison page with Dialog, alert, Popover and
ProgressOverlay windows visible immediately at their natural sizes. There are no
launch buttons for the standard specimens. Their sample controls report local
feedback while leaving the windows available for review. Existing section links
and saved collection members are retained; collection views can still focus on a
single family. `Dialog inline` and `Popover inline` use the same shared surface
markup and styling in document flow, with no scrim, portal, anchor positioning,
automatic focus, focus trap or global dismissal listeners. Normal app overlays
retain their existing modal/anchored behavior. ProgressOverlay uses its existing
inline mode. These are presentation specimens, not new window frame designs.

Current shared entry points: ApplicationSidebar/CollapsibleSidebar, TabbedSidebar,
WorkspaceBottomDock, WorkspaceRibbon/FloatingToolbar, FloatingPanel,
openFeatureWindow (editing popup), SettingsWindow, Dialog, Popover and the shared
application/status bars. The gallery demonstrates different content in the same
FloatingPanel and openFeatureWindow instances. This documentation does not claim
that every legacy product surface has already completed migration.

## Showcase presentation standard — 2026-10-14

Show each widget directly at its natural size, with variants beside each other.
Throughout Overlays, imported/reference specimens sit openly beside the standard
examples in their existing sections. Do not put them in reference dropdowns or
separate hidden groups. Keep source captions and existing family boundaries;
visibility does not change which containers are approved for product adoption.
Do not wrap specimens in mock workspaces, fake windows or clipped canvas frames.
A sidebar may contain its own working panels; it must not require a whole workspace
around it. Keep standalone inspectors and trees on their own widget pages.

Full compositions launch from Apps → Demo apps & windows. Their LinkCards open
separate, resizable browser windows with the actual interactive concept filling the
window. If the browser blocks popups, offer an explicit new-tab fallback. Keep
sample state separate from product data and reuse the same widgets in both views.

**Composition only (Jonathan):** Workspaces introduce no new UI assets, widget
variants or special styling. Every element, widget and overlay they demonstrate
must already be shown independently in Elements, Widgets or Overlays.
Add a missing standalone specimen there first; then reuse the shared component
and its demonstrated variant in the workspace. Sample data, canvas content and
layout placement belong to the composition, not a separate widget design.
Workspace cards link to their constituent assets' existing showcase pages.
Use this rule when adding or reviewing any new workspace; inclusion in a demo
is not approval of a new design.


# Widget conformance

The strong default this file promotes: **a reusable core widget is finished
once in `aether-ui`, to its full spec, and apps reuse it instead of growing
near-duplicates.** When an app genuinely needs different interaction semantics,
performance, or accessibility behavior, it may use a specialized component.
That exception is documented, reuses shared primitives/tokens where practical,
and receives its own gallery scenario and behavior tests. A missing generally
useful behavior should still be added here rather than patched independently in
each product.

**Showcase ownership (2026-09-23):** all demo UI Dev/UI Kit collections now
live in the central gallery's six tabs, flat, in the section of their kind
(a demo toolbar beside the ribbons, a demo dialog beside the dialogs), with a
caption per asset naming its source. The 36-template / 26-variant native
library and all 108 demo-kit specimens are preserved under `gallery/showcase/`,
each rendered once; the native UI Dev browser stays whole at `?demo=ui-dev`. Demo apps retain authoring workspaces;
the gallery owns widget review. Earlier UI Dev references below name the
source library, not a separate app workspace. No widget variants were merged
away. `OverlayScope` is an optional theme boundary for menus and popovers when
multiple source palettes are displayed on the same page.

**Window controls together (2026-10-14, Jonathan):** Navigation bars, sidebars
and toolbars are separate categories under **Overlays**. Workspace
layouts, viewports and status bars live there too; there is no separate Workspace
Chrome tab. **Toolbars → Floating toolbars** shows the command/search toolbar and
compact document toolbar as independent variants.

**Standalone widget review (2026-10-14, Jonathan):** Widgets pages display each
widget independently. Do not wrap inspectors or other specimens in sidebar tabs,
trees, or workspace chrome just because an app may host them there. Sidebar
widgets have their own showcase; compositions belong in Overlays → Workspaces
and app demos.

Definition of done for a core widget:
1. **Spec** — its behavior checklist below is complete.
2. **Gallery** — every checklist behavior is demonstrable in
   `npm run gallery`, including at least two instances side by side
   proving identical behavior from different data.
3. **Pins** — RTL tests cover each behavior (`npm test`).
4. **Consumers stay thin** — apps normally pass data + handlers; intentional
   specialized behavior follows the documented exception practice above.

## Application context commands — 2026-10-05

`ApplicationSettings` installs the shared context-menu fallback for application
chrome, empty work areas and editable fields. Native context-menu events are
intercepted in capture phase, including canvas renderers that stop bubbling.
Existing shared `Menu` object actions retain their own section; applicable
application and work-area commands follow with headings and separators.
Shift+F10 opens the same menu from the focused control. Escape/outside click and
arrow-key navigation use the standard Menu behavior.

Products register actual commands with `useContextCommands(commands, areaRef?)`.
Each command supplies a stable `id`, `label`, `run`, and current `disabled` state;
`heading`, `separatorBefore`, `order`, and `shortcut` are optional. With no ref,
commands belong to the app; with a ref they apply only inside that DOM area.
A deeper scope replaces a broader command with the same ID. Use this for
canvas/timeline zoom without changing browser page scale. `Mod+Z` shortcut labels
are presented for the current platform; registration does not install shortcuts.

Text fields receive Cut/Copy/Paste/Select all against the captured field selection
instead of scene commands. Clipboard failures surface an error and keyboard
fallback. Product clip/object clipboard semantics remain product-owned. Register
only supported actions; never show decorative commands without working handlers.
Products must not recreate the common menu styling or global event handling.

## Electronics presentation — initial draft

- [x] `CircuitSymbol`: six shared SVG drawings, inherited color, optional LED highlight.
- [x] `SignalMonitor`: caller-owned normalized samples, legend, caption and duration.
- [x] Empty inputs render without inventing measurement data; multiple instances
  use independent grid IDs (unit-tested).
- [x] Shared gallery: all symbol kinds, live highlight toggle, populated/empty
  monitors and the IO app identity. Browser-checked in light mode.
- [ ] Instrument-grade axes, units, cursors and time-window controls are future
  extensions. Current traces are a compact presentation widget, not a scope.

## Tree — spec v3 (flagship)

- [x] Hierarchical rows: disclosure, icon, label, badge, trailing actions
- [x] Selection: single click; ⌘/ctrl toggles; ⇧ selects a range over the
      visible (flattened, expanded) order
- [x] Disclosure click expands/collapses WITHOUT selecting
- [x] Expansion: uncontrolled by default; controlled via
      `expandedIDs` + `onToggle`
- [x] Keyboard: ↑/↓ move focus, → expands or enters children, ← collapses
      or moves to parent, Enter/Space selects, Home/End jump; roving
      tabindex
- [x] `filter` prop: hides non-matching rows, keeps ancestors of matches,
      auto-reveals matches inside collapsed branches
- [x] Trailing per-row actions (hover-revealed) that never change selection
- [x] `onActivate` (double-click) and `onContextMenu(id, x, y)` events
- [x] Disabled rows (skip focus/selection) and `dimmed` rows (styling only)
- [x] Empty state slot
- [x] Controlled inline rename via `renamingID`, `onRename`, and cancel
- [x] Drag re-order / re-parent signals with before/inside/after intent;
      applications retain graph mutation and validity policy
- [x] Expanded child loading and recoverable error/retry rows
- [x] Fixed-row virtualization for large visible hierarchies

## SearchField — spec v1

- [x] Controlled or uncontrolled query with immediate `onQueryChange`
- [x] Optional delayed `onSearch` intent with configurable delay
- [x] Enter flushes pending search; Escape and the named clear button reset it
- [x] Optional native scope selector and accessible singular/plural result count
- [x] Disabled, placeholder, autofocus, and external input-ref behavior

## Breadcrumbs — spec v1

- [x] Ordered stable-ID path with the final location marked `aria-current=page`
- [x] Native button navigation and disabled intermediate locations
- [x] Configurable long-path collapse through the definitive shared Menu
- [x] Named navigation landmark, quiet separators, truncation, and borderless text focus

## RadioGroup — spec v1

- [x] Native fieldset/radio semantics with controlled or uncontrolled selection
- [x] Horizontal/vertical layouts, labels, descriptions, disabled options, and group errors
- [x] Arrow wrapping plus Home/End navigation while skipping disabled options

## SegmentedControl — spec v1

- [x] Controlled or uncontrolled single-choice radiogroup semantics
- [x] Selected, hover, focus, option-disabled, and group-disabled states
- [x] Roving focus with wrapping arrows and Home/End while skipping disabled segments

## Slider — spec v1

- [x] Native range input with controlled or uncontrolled numeric state
- [x] Explicit min/max/step/unit and accessible value text
- [x] Optional output, disabled state, and token-driven filled-track presentation
- [x] Rounded filled track and elevated thumb in light/dark themes; WebKit and Firefox styles
- [x] Optional read-only assignment range marks, separate from the editable base value

## ParameterRow — spec v1

- [x] Product-free icon, label, exact numeric editor, optional slider, unit and help
- [x] Suggested slider interval expands to include authored values without clipping saved data
- [x] Real modulation label/action and optional range marks; no product semantics or fake activity
- [x] Keyboard/native slider behavior, expression entry, disabled and focus/invalid states
- [x] Theme tokens and narrow-panel wrapping; reusable in every app through `@aether/ui`
- [x] Two independent interactive examples in the form-controls gallery (ParameterRowDemo)

Map uses this row for surface/output opacity and shader numeric parameters.
Products supply limits and modulation actions; they must not restyle its internals.

## ColorField — spec v1

- [x] Synchronized native picker and six-digit hex editor
- [x] Controlled or uncontrolled value with normalized commit on Enter/blur
- [x] Validation diagnostics, Escape cancel, disabled state, and named inputs

## GradientControls — spec v1

- [x] Controlled linear angle and radial stop editing; no engine dependencies
- [x] Ordered color/position/opacity stops, 2–16 stop bounds, add/remove
- [x] Shared validated color/numeric fields, keyboard commit/cancel, disabled group
- [x] Two independent linear/radial examples in the picker showcase
- [x] Sketch vector appearance and Map colour sources consume the same widget

## FileField — spec v1

- [x] Native browse and drag/drop selection with accept and single/multiple bounds
- [x] Controlled or uncontrolled file list, size display, and clear action
- [x] Label, help, error, disabled, focus, and drop-target states

## CommandPalette — spec v1

- [x] Controlled modal accepts product-supplied commands and emits stable IDs only
- [x] Ranked exact/prefix/substring/subsequence search across labels, descriptions, categories, and keywords
- [x] Recent ordering, category groups, icons, descriptions, shortcuts, disabled reasons, and no-results state
- [x] Input-retained arrow navigation with wrap, Home/End, Enter execution, Escape close, focus trap, and opener focus return
- [x] Optional typed argument follow-up with required validation, Enter submit, Back, and Escape return to search

## DocumentTabs — spec v1

- [x] Controlled tab strip with active, dirty, pinned, preview, and disabled states
- [x] Active close control with explicit pinned-close policy and pin/unpin intent
- [x] Pointer drag reorder emits stable source/target IDs without owning document order
- [x] Bounded visible tabs keep the active document present and route hidden tabs through shared Menu overflow
- [x] Arrow wrapping plus Home/End navigation skip disabled tabs and follow selection
- [x] Shared Menu emits horizontal/vertical split intent while applications own pane layout

## Toast / NotificationCenter — spec v1

- [x] Shared product-free model covers success, warning, error, and progress with title/message/timestamp
- [x] Toast stack uses polite status or assertive error announcements, determinate progress, optional action, dismiss, and persistent state
- [x] NotificationCenter presents persistent read/unread history with mark-read, action, remove, clear-all, and named empty state
- [x] Every action emits a stable notification ID; applications own history storage and side effects
- [x] Compact stacking, keyboard focus, token styling, and progress accessibility are shared

## Status matrix (core widgets)

| Widget | Spec | Gallery | Pins | Notes |
|---|---|---|---|---|
| Tree | **v3** | full | full | flagship — see above |
| Button / IconButton | **v2** | yes | basic | shared keyboard-only focus ring (all interactive widgets) |
| Ribbon (+Group/Tool) | **v2** | yes | full | ←/→ across groups skipping disabled, wrap; overflow-x scroll |
| Tabs | **v2** | yes | full | ←/→ wrap + Home/End, roving tabindex, selection follows focus |
| Rail | v1 | yes | full | label/pressed/disabled/click and standard button/container attributes pinned |
| DockPanel / PanelHeading | v1 | yes | none | needs: collapse spec (rail chevron) |
| TextField | **v2** | yes | full | `invalid` (aria-invalid + error border), `unit` suffix (mm/deg/s) |
| SearchField | **v1** | full | full | controlled/uncontrolled query, delayed search intent, Enter flush, Escape/clear, optional scope, accessible result count, focus ref |
| Breadcrumbs | **v1** | full | full | stable current-page path, disabled locations, shared-Menu overflow, native keyboard navigation |
| RadioGroup | **v1** | full | full | native form semantics, descriptions/errors, controlled/uncontrolled selection, arrow/Home/End navigation |
| SegmentedControl | **v1** | full | full | single-choice radiogroup, controlled/uncontrolled selection, roving focus, disabled states |
| Slider | **v1** | full | full | native range semantics, min/max/step/unit/output, disabled state, token-driven fill |
| ColorField | **v1** | full | full | native picker plus validated hex commit/cancel, controlled/uncontrolled state |
| FileField | **v1** | full | full | browse/drop, accept, single/multiple, controlled list, clear/help/error/disabled states |
| CommandPalette | **v1** | full | full | fuzzy discovery, recents/categories, disabled reasons/shortcuts, keyboard traversal, argument follow-up, focus return |
| DocumentTabs | **v1** | full | full | active/dirty/pinned/preview states, close/pin/reorder/overflow/split intent, accessible keyboard selection |
| Toast / NotificationCenter | **v1** | full | full | status/error announcements, success/warning/error/progress, actions/dismiss, persistent read/unread history |
| NumberField | **v1** | full | full | arithmetic expressions, explicit display unit, min/max validation, mixed value, Enter/blur commit, Escape cancel, fine/coarse keyboard step, optional pointer scrub |
| SelectField | **v1** | full | full | native select semantics, data-driven options, placeholder, disabled options, invalid state |
| Checkbox | **v1** | full | full | native form behavior, label/description, disabled and indeterminate multi-selection state |
| FieldRow | **v1** | full | full | consistent label/editor/help/error/modified/reset composition; application retains transaction ownership |
| Dialog | **v2** | yes | full | document-level Escape, focus trap + wrap, focus returns to opener |
| Menu / ContextMenu | **v1** | full | full | controlled command model for dropdown, overflow, and point-anchored context surfaces; submenus, check/radio state, shortcuts, danger, disabled reasons, keyboard traversal, outside/Escape dismissal, focus return, viewport-aware placement |
| PanelPlacementMenu | **v1** | full | full | product-free Dock/Float/Hide radio menu; emits placement only while applications own stable panel IDs and persistence |
| Popover | **v1** | yes | full | controlled anchored surface; optional first-control focus and outside dismissal, Escape dismissal, focus return, viewport-aware placement |
| Tooltip | **v1** | full | full | delayed pointer and immediate focus help, shortcut/disabled explanation, accessible description, Escape dismissal, shared viewport-aware placement |
| EmptyState / ErrorState | **v1** | full | full | compact/full guidance, diagnostics, accessible error announcement, primary/secondary recovery actions |
| ProgressOverlay | **v1** | full | full | determinate/indeterminate phases, cancel/background actions, modal focus containment/return and Escape cancel, reduced-motion fallback |
| ListBox | **v1** | full | full | controlled single/multiple or semantic nonselectable collections, groups, range/toggle selection, type-ahead, disabled/dimmed rows, activation/context/row actions, empty/loading/error states, fixed-row virtualization |
| DataTable | **v1** | full | full | typed/resizable/reorderable columns, controlled sort/filter, single/multiple/range and keyboard row selection, inline edit, pinned columns, row commands, empty/loading/error states, fixed-row virtualization |
| PropertyGrid / PropertySection | **v1** | full | full | schema-driven editors, controlled/uncontrolled collapsible sections, filtering, modified-only projection, mixed/read-only state, shared help/error/reset composition |
| SplitPane / BottomPanel | **v1** | full | full | horizontal/vertical pointer and keyboard resizing, min/max, controlled persistence, collapse/restore; tabbed Problems/History/Console/BOM/Tasks surface with badges, actions, keyboard tabs, collapse/restore |
| ApplicationStatusBar | v1 | yes | presentation only; caller supplies connection/company | shared DOM/React tests |
| StatusBar / StatusDot | v1 | yes | none | trivial |
| ViewportCanvas | v1 | yes | full | mount-once/teardown pinned |
| ViewportNavigationCube | **v1** | full | full | controlled product-free camera chrome; quaternion display plus accessible face, fit, 15-degree nudge, and quarter-turn roll intent; renderer behavior remains app-owned |
| WorkspaceShell | **v1** | full | full | app-window chrome ported from Swift `StudioWorkspaceScaffold`: docked / floating / canvas presets around one persistent center/viewport subtree; controlled or uncontrolled stable-ID panel placement/coordinates; rail-toggled panel stacks, tear-off drag/clamp/restack, canvas edge reveal. outer-edge panel placement; default panel-state retention and automatic toolbar frame recognition. Deferred: drag-reorder of stacked panels, chrome shape presets |
| RibbonWorkspaceShell | **v1** | full | full | second shell using the current CAD layout: document header, left workspace selector and tabbed ribbon; composes WorkspaceShell and retains its panels/viewport across layout and workspace changes; browser-checked bounded height and narrow layout. Gallery: CAD workspace shell. |
| WorkspaceRibbon | **v1** | full | full | controlled workspace menu, keyboard-navigable tabs, grouped tools with caption menus and disabled reasons; bounded tool-strip height and horizontal overflow; commands remain product-owned.; `appearance="glass"` (2026-09-23, Jonathan's concept render): floating translucent slab, boxed workspace column with the workspace's icon, softly shaded tabs, title-case group captions, softly filled active tools, all sized in em from the render's measurements (`--wr-font-size`, default 10px shared with the showcase and products, scales the chrome) — the default, together with the workspace column; `appearance="panel"` and `workspaceLayout="strip"` remain explicit variants; `moreItems` adds the trailing "•••" menu at the end of the tool row; the "•••" menu also carries the three densities the kit tool sidebar has (`density` / `defaultDensity` / `onDensityChange`: Compact = one icon per group opening its tools, Standard = grouped with captions, Expanded = plus the workspace column); every dropdown (group captions, workspace, dots) opens as a tool menu — theme-aware rounded panel, title-case caption, icon-and-label rows (`aui-tool-menu`, via `ToolMenuButton` / `WorkspaceSwitcher.menuClassName`) |
| FloatingPanel | v1 | yes | via shell | draggable by header; also standalone for short-lived tools |
| FeatureWindow | v2 | yes | gallery | suite-standard feature editor: ✓/✕ header, valid field Enter commits, Entities box, parameter rows, final accessory row with Help; imperative DOM (openFeatureWindow) |
| SettingsWindow | v1 | yes | gallery | suite-standard per-app settings: macOS anatomy (traffic-light close, grouped sidebar, cards, rows); products supply sections/panes |
| DocumentBar | v1 | yes | none | 48px top row: leading/trailing clusters + window-centered tabs. Deferred: responsive breakpoint collapse (1320/1060/880) |
| LayoutPresetButton | v1 | yes | yes | the studio button — cycles floating → docked → canvas. Deferred: dropdown menu listing all modes |
| Timeline / DopeSheet | **v1** | yes | full | labeled tracks, keyframe diamonds, adaptive ruler, scrub/playhead, transport, keyframe select. Deferred until engine clip-CRUD: keyframe drag/add/delete, curves view |
| SpecimenBoard | **v1** | full | full | data-driven sections and specimen cards with shared icon, detail, ideal-size, preview-height, bounded adaptive width, board metrics/status, and content slots; drives the exact 36-template UI Dev living-standard matrix |
| AssistantPanel | **v1** | full | full | dockable assistant surface with modes, transcript, suggestion-to-draft behavior, and submitted message intent |
| MaterialEditor / MaterialBrowser | **v1** | full | full | material identity, color and channel editing; searchable categorized cards and used materials; separate environment catalog/control slot; rendering and assignment remain app-owned |
| ImportWorkflow | **v1** | full | full | staged destination, source-file summary, options, progress steps, and back/import intents |
| AnnouncementCard | **v1** | full | full | dismissible release/notification surface with optional badge and supporting status rows |

The planned CAD-system widget expansion in
`dev/docs/roadmap/Aether_CAD_UI_System.md` is now represented in the shipped
matrix above. Remaining roadmap work is product adoption and Core-backed screen
behavior, not another parallel primitive set.

The reuse-first rule is the normal architecture: hierarchical product lists use
Tree; flat selectable lists use ListBox; tabular data uses DataTable; popup
commands use Menu; property editors use the shared field family and
PropertyGrid. Product applications usually supply schemas, rows, commands, and
event handlers only. Purpose-built exceptions are allowed when documented and
tested as described above.

The launchable Anima concept composes `Ribbon`, `RibbonGroup`, `RibbonTool`,
`IconButton`, and `Popover` into the archived adjustable toolbar presentation.
Its density, group-overflow, shape, and persisted preference behavior are an
application-shell composition because they depend on the Anima workspace
catalog; the underlying controls remain shared widgets.

Work the matrix top to bottom; a row is done when all three columns are
full. Contributions (either agent) follow the same definition of done.


### Studio convergence — 2026-09-08

`WorkspaceShell.controllerRef` exposes `showPanel(id)` for selection and context-menu commands. It reveals the requested panel without toggling it closed, preserves existing placement and drafts, and follows the same per-side selection rules as the rail.

WorkspaceShell retains panel content by default (`preservePanelContent={false}` opts out),
validated per-preset device-local layouts (`storageKey` for uncontrolled state),
keyboard movement on floating headers, resize clamping, and compact rail-revealed
side panels. CAD and Animation both consume the shell and ViewportNavigationCube.
Native StudioDesignProfile is the structural theme baseline. Product CSS should
compose layout, not override shared control typography/colors or ViewCube skins.

### Launchable concept apps — 2026-09-22

The Aether UI app now has a **Concept apps** directory rather than treating
whole-workspace demos as anonymous sections. Aether Animation Studio and the CAD workspace
launch into full-window canvases and expose the shared `AppLauncher` in their
headers. Aether Animation Studio is the integration specimen for `WorkspaceShell`,
`DocumentBar`, `Ribbon`, `DataTable`, `Tree`, `PropertyGrid`,
`Timeline`, `StatusBar`, panel placement, and appearance. Demo-specific
catalogs and sample state stay in `gallery/`; reusable controls remain
product-free in `src/`.

The Anima specimen now preserves the archived primary stage strip and its two
toolbar presentations. Assets renders Create, Import, Manage, and Prepare as one
complete grouped row. Modeling, Animate, Show, Hardware, and UI Dev render the
native category strip over the selected command row; Modeling's Build category
is split into Create and Structure groups. Floating mode is a centered unified
panel with a pill active category, while docked mode is an integrated strip with
an underline active category. Reviewers can switch 3D/2D/VR authoring and inspect
every archived ribbon family. Animate's Transport commands update the shared
timeline; native planned commands remain disabled, with explicit local-demo
interactions for supported commands. The product engine remains outside the gallery.

The complete workspace menu exposes the archived nine-workspace product model
even though the centered strip intentionally remains compact. 2D and VR are
distinct authoring surfaces selected through the character-type control; Nodes
and Design retain direct routes and their own ribbon catalogs. UI Dev is
development chrome outside that product count.

`SettingsWindow` supports `presentation="floating"` for the native modeless
utility-window form and `size="standard"` for the archived compact geometry.
`WorkspaceShell` reports `data-panel-relationship="overlay|push"` and accepts
`panelsOnOuterEdge` so settings can demonstrate the exact spatial consequence.
Modal/large remain the defaults for existing consumers.

`Timeline` now has an opt-in `editor` presentation based on the archived Anima
Animate workspace. It adds the complete transport/timecode row, detailed track
headers, play range, frame ruler, colored keyframes, empty audio/event lanes,
and dope-sheet/curve canvases while preserving the existing compact API. The
Anima concept combines it with the shared `SegmentedControl` for its working
3D / Dope Sheet / Curves bottom switcher.

Show defaults to the detailed archived Node Graph rather than a placeholder
preview. The gallery-local authoring surface exercises searchable grouped
libraries, draggable/selectable connected cards, Select/Hand/Connect modes,
zoom/grid/frame/validate/delete/reset actions, a live node inspector, and the
shared show playhead in its Performance strip. `SegmentedControl` switches the
same Show stage among Node Graph, scene-action Table, and 3D preview. This is a
concept-app consumer; no scene-graph runtime contract was added to `src/`.

UI Dev's All Templates view is pinned to the archived inventory: 36 cards in
Windows & Workspaces, Timelines & Editors, Inspectors, Panels & Tools, Dialogs,
Buttons & Inputs, and Status & Empty States. Gallery-local specimens reproduce
source control groups and meaningful states inside the cards; exact visual parity remains under review; the shared
`SpecimenBoard` owns card anatomy, ideal-size labels, exact preview heights,
bounded adaptive layout, board counts, and live-standard status.
All cards use the native adaptive column layout. `designSize` enables an
interactive scaled preview for the native mate, import, layout, template and theme
labs. Ideal width alone does not change column span.


### Additional concept-widget exports

Import from `@aether/ui/concept-widgets`:

- `CompactActionPanel`: primary/settings commands with shortcuts and isolated light/dark theme preview.
- `AppearanceInspector`: controlled or local palette/mixer, validated hex/RGB, opacity and tessellation.
- `ConfigurationInspector`: owner-supplied kinds, connectors and units; offset/limit fields and apply/cancel checkpoint. No product solver or constraint evaluation.
- `SequenceEditor`: local editable track/key specimen with dope-sheet, curves, waypoint lanes, transport and markers. Products retain canonical timeline evaluation.

The Aether UI Dev **Variants** route is a distinct 26-entry board with family/search/size controls. `AnimaNativeRibbon.ts` preserves the archived descriptor availability so planned tools do not appear operational. The demo's source-derived light/dark palette is page-scoped and removed when leaving the app. See `dev/docs/reality/Animation_Studio_Web_Migration.md` for verification limits; inventory coverage is not visual sign-off.

### WorkbenchWindow — split-window template

From `@aether/ui/concept-widgets`; live specimen at
`/ui/workbench-window.html` (host) or `/workbench-window.html` (gallery server).

A renderer-independent composition of shared `SplitPane`, icons and theme
tokens, adapted from the retired Codex Bench native window. Slots: sidebar,
sidebar title/actions/footer, detail toolbar, center canvas, top-right overlay,
bottom-left canvas footer, status strip. `sidebarCollapsed` and `sidebarWidth`
are optional controlled values with change callbacks; defaults retain local
state. Collapsing hides rather than unmounts the sidebar. The divider supports
dragging, arrow-key resizing, Enter/double-click collapse and Home/End.

The specimen's documents are deliberately local UI sample state, with no CAD
importer, fake performance readings, or renderer-selection menu.

## Dashboard template and analytics — 2026-09-30

| Export | Presentation contract | Showcase |
|---|---|---|
| `DashboardShell` | Grouped navigation using CollapsibleSidebar, brand/search/profile slots, responsive page header and content canvas | Apps → Commerce Dashboard |
| `DashboardCard` | Named, labelled section with optional heading action | Dashboards + analytics |
| `MetricCard` | Formatted value, icon, labelled change direction and supporting text | Dashboards + analytics |
| `GoalProgress` | Native labelled progress, clamped 0–100%, formatted current/target values | Dashboards + analytics |
| `ActivityList` | Time-labelled, tone-coded items with optional selection callback | Dashboards + analytics |
| `DashboardLineChart` | Smooth data-driven curve, unique gradient IDs, focus/hover tooltip and keyboard selection | Dashboards + analytics |
| `DashboardBarChart` | Selectable categories, formatted labels, rounded axis bounds and overflow on narrow screens | Dashboards + analytics |
| `DashboardTable` | Spacious row-divided presentation of shared DataTable; existing sorting/selection retained | Commerce Dashboard recent orders/catalog |

Components consume theme tokens and accept display data/callbacks. Fictional
commerce data and mutations stay in `gallery/dashboard-demo/`. The Aether Commerce
manifest owns both palettes. No backend, financial processing or external service
integration is implied by the demo. Default shared component appearances remain
unchanged; the dashboard presentation is opt-in.

### StylePropertiesPanel — flat mint / blue reference variant

Controlled selection inspector with layout, linked or independent corner radii,
fill, border style/width, shadow offsets/blur/spread, color and opacity. Sections
collapse independently; disabling a paint preserves its values. Built from the
shared ColorField, NumberField, Slider, SelectField, Checkbox and IconButton.
Uses shared theme tokens and icons; props/types are exported from `@aether/ui`.
The standalone specimen is in **Widgets → Forms & inspectors → Inspectors + property panels**,
and **Apps → Properties Studio** opens a full-height preview with light/dark
modes, quick looks, selection guides and reset. Existing inspector variants remain.

### WorkspaceShell: standard motion and automatic safe areas

Panel motion is enabled by default (`animatePanels={false}` opts out). It retains closing editor hosts through a 240ms directional fade,
marks closing controls inert, handles reopening and respects reduced motion.
The shell always fills the available workspace. Docked bars occupy layout space; floating bars overlay the full-size canvas. `contentPresentation="canvas"` is the default. Tables/forms choose `contentPresentation="framed"`, placing content in an inner safe rectangle while keeping the background full size. The shell measures actual toolbar/rail/panel bounds: 10px margin, 22px clearance from floating chrome. Detached
panels and Canvas mode's revealed edges are included. Canvas HUDs use `data-workspace-overlay="top right"` (any combination of top/right/bottom/left) to follow those measurements without resizing the renderer. Framed children must not apply these insets again. The legacy `measureContentInsets` prop is deprecated
and no longer controls this behavior. Protection is always active; **Aether Studio → Workspace spacing** configures the margin and floating-control clearance (0–64 px), with **Restore Aether UI defaults** returning to 10/22 px. Preferences persist and sync across applications in this browser.
Map, CAD, Animation, Sketch and gallery workspaces inherit the same standard.

### Standard document rail

All authoring applications use `standardWorkspacePanels` for the left sidebar.
The shared catalog owns the order, labels and icon-pack glyphs: Features and
parts, Version control, Create version, Comments, Document notes, Reminders,
AI advisor, Action items, then Part manager (after a divider). App-specific
panels appear before Part manager. Pass the returned panels to the existing
`WorkspaceShell.leftPanels`; the same TabbedSidebar handles docking, floating,
manual sizing, exclusive selection and retained content.

Bind existing IDs rather than changing saved layout keys, for example
`standardWorkspacePanels(panels, { features: "layers", advisor: "agent" })`.
Products supply their actual panel content and service adapters. Missing
adapters render an explicit “not connected” state; this helper does not add
version storage, collaboration or AI services. CAD keeps its existing version,
reminder and advisor integrations. Map and IO move their existing advisor onto
this rail. Part manager uses `DocumentFileManager` and `FileManagerPanel` in every
editor; Map retains Assets and IO retains Components as additional tools. Sketch puts its drawing hierarchy on the left and properties on the
right. Animation retains its rig/clip panels. The CAD and migrated Anima Studio
showcase demos use this catalog too. Studio's home/admin navigation and the UI
component catalog remain navigation surfaces, not document rails.

Horizontal open cards retain the preferred editor width and scroll overflowing
icons, so a longer rail cannot squeeze the center canvas away. Collapsed
floating cards still fit their icons within the available frame.

### Bottom-centered workspace dock

`WorkspaceBottomDock` shares the same `TabbedSidebar` card, icons and motion as
the sidebars. Pass it through `WorkspaceShell.centerBottom`; it reads the shared
layout context automatically. In Docked mode it spans the center column edge to
edge, reserves canvas space, and retains full width when collapsed. In Floating
and Canvas modes it stays centered on the full workspace, using symmetric outer
margins rather than the changing sidebar safe insets. Opening or closing a
sidebar does not move or resize it. The floating open default is 60% of that
width (at least 480px when space permits); it never exceeds the workspace frame. Click the active icon to collapse to the
icon strip; click another icon to open its panel. The last panel remains mounted
and becomes inert/hidden from accessibility while collapsed.

Pass `tabs`, controlled `activeTab`/`onTabChange`, and content. `height` and
`onHeightChange` support a draggable/keyboard top separator; `defaultHeight`
sets its reset value. In floating mode a right-edge width handle stretches both sides evenly. Docked
width follows the middle column; switching back restores the floating width.
Double-click the edge or press Home to restore defaults. `storageKey` optionally
remembers the manual width. `widthFraction` configures the standard open width
(0.6–1). Bottom-anchored canvas HUDs clear the dock automatically.

Map uses this for Surfaces/Export and the Visualization timeline/audio panels,
remembering selected tab, collapsed state and heights per room/panel. Audio is
still an unimplemented placeholder; this change only supplies its dock.
Compare it in **Aether UI → Widgets → Menus → Sidebars → Bottom-centered workspace
dock**. The demo includes editable retained content and layout switching.

### Manual sidebar resizing

Standard `WorkspaceShell` sidebars expose a narrow draggable inner edge in both
docked and floating layouts. Floating cards also expose their free top/bottom
edge for height. Sizes remain automatic until changed; collapsed trays still
fit icons. Overrides persist per shell `storageKey` and survive switching tabs,
collapsing/reopening and reloading. Width is bounded to preserve workspace room;
height is bounded by the available frame. Double-click an edge or focus it and
press Home to restore that dimension's automatic default. Arrow keys change by
10px, Shift+Arrow by 50px. The same behavior applies to combined and detached
sidebar designs; docked height always fills the available space.

Standalone `TabbedSidebar` callers can supply its optional `resize` callbacks;
the shell supplies them automatically. The bottom dock uses the same pointer-
capture and keyboard resizing control. No product-specific resize implementation
is needed for standard sidebars.

### Tabbed sidebar sizing

`WorkspaceShell sidebarVariant="tabs-top"` or `"tabs-bottom"` adds the
reference-style rounded floating sidebar, with a horizontal icon strip above or
below an independently scrolling panel. Docked cards fill the available height.
Floating combined cards collapse to the icon strip’s intrinsic length: vertical
rails fit their icons in height, horizontal trays fit their icons in width. The
left expanded card fills available height; the right fits its content, with enough
room for all icons and scrolling when space is limited. `WorkspacePanel.floatingHeight`
overrides the expanded policy with `"fill"`, `"content"`, or a pixel height.
Horizontal cards stay anchored at the bottom corners during width/height motion.
The existing `"rail"` remains
the default; this is an additive presentation, not a new global default.

The variant supports both sides, Floating/Docked/Canvas presets, retained panel
editors, and close/reopen motion. Combined attachment joins tabs and content in
one frame at every viewport, including touch devices. Legacy automatic settings
resolve to combined. Detached remains an explicit secondary design. Shell title bars, detach/close buttons,
and collection window commands are omitted. Previously detached panels return
to the sidebar when this variant is selected. It always
selects one panel per side (including when migrating an old stacked state).
Clicking the active tab closes its panel; the strip remains available. Arrow
Left/Right and Home/End move tab focus, Enter/Space activates, and overflowing
strips scroll to the focused icon. Touch controls use 44px targets; colors and
motion follow the shared theme/reduced-motion settings.

`TabbedSidebar`, `TabbedSidebarProps`, and `SidebarTab` are also exported for
standalone containers. Provide `tabs`, controlled `activeTab`, `onTabChange`,
`ariaLabel`, `tabPosition="top" | "bottom" | "left" | "right"`, and optional
`attachment="auto" | "attached" | "detached"`; give its parent a definite
height. Use `floating` and `heightPolicy="fill" | "content" | number` for intrinsic
floating sizing; detached cards retain their existing behavior.
`activeTab={null}` collapses the content. The shell owns editor retention;
standalone callers own their content's lifecycle.

Live examples: **Aether UI → Widgets → Menus → Sidebars**, with both positions,
layout/side controls, floating height policies (standard, full, content, fixed
360px), editable transform fields, locks and construction planes.
The safe-area measurement is scoped to the owning shell, so nested previews do
not consume the outer application's usable workspace.

`SidebarDesignMenu` is the shared controlled header picker (`value`, `onChange`)
for **Side rail / Top tabs / Bottom tabs**. `sidebarDesignOptions` exposes the
same choices for settings fields. The gallery, workspace-shell specimen, CAD
workspace demo and migrated Animation Studio demo expose the picker; Animation
Studio also includes it in **Settings → Layout → Sidebar design**. Demo choices
persist per demo while the shared placement preference is App default. An
explicit suite placement override takes priority; the picker then updates that
shared choice. The older Animation
Mockup/Atlas reference shells and dashboard/navigation layouts remain separate.

### Shared appearance settings

Every `SettingsWindow` includes **Aether Studio → Appearance & icons**. The
shared `ThemeMenu` also opens this settings pane, including in apps without
product-specific settings. Color mode (System/Light/Dark), interface theme,
viewport theme and illustrated tool icon pack persist in this browser and sync
between open applications. Tool icons default to this preference; explicitly
scoped `ToolIconTheme` specimens retain their declared pack. Available application
tool packs are Aether Classic and Graphite Ribbon; missing glyphs use the existing
fallback artwork rather than disappearing. Product-specific settings remain in
their owning application sections.


## Native migration additions — 2026-09-30

- **LayoutStyleControls**: controlled/local layout and style values, live preview,
  shared fields, reduced-motion support; central Layout & Style Controls specimen.
- **RelationEditor**: externally supplied kinds/DOFs/units, finite positive ratio,
  reverse, offset, busy/error state, create/edit/remove actions. Demo and production
  Animation consume the same presentation; it owns no animation semantics.
- **WorkspaceShell**: center stacking isolation keeps viewport HUDs behind panels;
  floating stacks constrain individual panel bodies so long forms scroll with
  their headings retained. Existing open/close and reduced-motion behavior remains.

`NativeMigration.test.tsx` exercises these widgets and their demo flows. Native
control inventory and browser results: `gallery/NATIVE_PARITY.md`.

- `WorkspaceAgent`: shared account-provider/model composer, streaming and cancellation; supplied Studio transport and product-owned context. `AssistantPanel` also accepts busy/disabled/stop props.

## Turnkey workspace defaults — 2026-09-30

`WorkspaceRibbon` defaults to the shared glass appearance, workspace column and
expanded density. It follows its enclosing `WorkspaceShell` layout automatically:
docked fills the toolbar slot, floating owns its frame. Explicit panel/strip
variants and `docked` overrides remain available for intentional specimens.

`WorkspaceShell` preserves panel content through hide/dock/float by default.
`frameToolbar="auto"` is the default: shared WorkspaceRibbon and kit ToolSidebar
retain their own material; a plain command row receives the shell frame. Floating
side stacks start below the measured toolbar footprint, including revealed Canvas
mode controls. Tall inspectors scroll without covering toolbar commands.
`StatusBar` exposes the shared Workspace status live region.

Aether Sketch now supplies its ribbon through the shell toolbar slot and uses
StatusBar. App authors supply commands, content and domain data; common chrome,
settings and motion stay in this library. Remaining product styling cleanup is
tracked in `dev/docs/reality/UI_Adoption_Audit_2026-09-30.md`; this is not a claim
that every historical product override has been removed.

### Smaller ribbon proportions — 2026-09-30

The shared glass WorkspaceRibbon now uses 24px icons and 62×40px desktop tool
tiles, matching CAD's label width with less height. Group side padding is 8px;
labels remain 10px. Expanded/Standard docked height measures about 76px. Compact
group buttons are 34px, with the same tab height. Coarse pointers retain at least
44px tool targets. Map, CAD, Sketch, Animation and the gallery consume this CSS;
there is no Map-only size override. The separately selectable native kit toolbar
keeps its own established design.

### Single-panel sidebar default — 2026-09-30

`WorkspaceShell.panelSelection` defaults to `"single"`: each side has one active
panel, including detached panels. Selecting another rail icon replaces the
current panel on that side; selecting the active icon closes it. The other side
is independent. Panel DOM/drafts remain retained by default. Old persisted
multi-panel layouts and controlled external opens are normalized to this rule.
`panelSelection="multiple"` explicitly restores stacking for specialized layouts.
The kit `panelStack` constructor likewise defaults to exclusive selection; pass
its fourth argument `false` only when stacking is intended.


### Shared toolbar and tab preferences

Every `SettingsWindow` includes **Toolbars & tabs** via `SharedChromeSettings`.
`useWorkspaceChrome` / `setWorkspaceChrome` expose validated browser preferences
for attachment, tab placement/size/labels, toolbar density, ribbon appearance,
workspace selector, popup list/grid and panel motion. `DEFAULT_WORKSPACE_CHROME`
keeps existing app choices unless overridden, with combined attachment and automatic motion.
Changes synchronize in the same document and other same-origin windows; corrupt
stored values fall back per field. Reset does not erase product layout settings.

`WorkspaceShell` and `TabbedSidebar` render the attached frame with no nested
borders or panel float/close buttons. The frame opens/closes with shared home-nav
motion tokens (180ms by default), retaining the tab tray and editor drafts.
Reduced motion disables the transition. Both toolbar families inherit density;
WorkspaceRibbon also inherits appearance and selector, KitShell/ToolSidebar
inherits popup layout. The sidebar showcase compares both container designs,
with top/bottom/side, floating/docked and left/right controls.

## Harness drawing presentation (2026-10-01)

The **Widgets → Panels → Electronics + instruments** specimen adds
`HarnessConnectorCard`, `ConnectorFace`, `ConnectorPreview`,
`HarnessConnectionTable` and `HarnessDrawingScope`. These are reusable SVG
presentation components: pin activation/selection callbacks, connector housing
and cavity views, live connection rows, and a scoped dark drafting palette.
The original housing illustration lives in `core/assets/electronics/`.

The linked CAD harness demo supplies document identity, electrical connections,
physical routing, selection, table positions and edits. Those behaviors are
CAD-owned and do not enter `core/ui`. Current faces are generic illustrations;
manufacturer pinout geometry and table column configuration remain future work.
The IO circuit/signal specimens remain alongside the new harness specimens.

### Unified sidebar frames and opening direction (2026-10-01)

Standard single-selection rails, top tabs and bottom tabs all render
`TabbedSidebar`; icon button dimensions, selected colors, spacing and focus
behavior are shared. Attached children have transparent backgrounds, no inner
outline or shadow. A thin internal divider separates the tray from its content.
Floating cards own one outer frame; docked sidebars sit flush at the window edge,
with square corners, no shadow and a workspace-facing border. Side trays
use Up/Down navigation; horizontal trays use Left/Right. Group separators survive.
Explicit `panelSelection="multiple"` keeps the specialized tear-off stack.

`sidebarOpening` in shared chrome preferences is `app | inside | outside`.
App inherits `WorkspaceShell.panelsOnOuterEdge`; explicit choices override it.
The requested edge and content direction are tracked separately on shell chrome.
Inside anchors the tray at the edge and opens inward; Outside reserves the editor
extent between that edge and the tray, opening outward without moving the tray.
Combined horizontal cards always shrink toward the bottom of the workspace,
regardless of top/bottom tray placement or opening direction. A top tray moves
down with its collapsing card; a bottom tray stays at the bottom. Side trays
retain their left/right anchor behavior, and detached trays keep their existing
placement. This avoids extending content beyond the window. Width/height reveal
uses shared home-navigation easing;
retained editor portals and reduced-motion behavior remain intact.

### Primary and secondary sidebar specimens

**Widgets → Menus → Sidebars** includes two separately captioned live specimens:
**Combined Card — Primary** and **Detached Tray — Secondary**. Both use the same
four tab icons and editable transform/appearance/structure/display content, with
identical side/top/bottom and floating/docked selectors. Neither changes the
other specimen or global preferences. The full orientation/anchor comparison
lab is preserved below them. Combined is the default at all viewport sizes;
old saved `auto` settings resolve to combined, while explicit detached settings
remain available.

Docked sidebars have zero inset and fill the workspace area's height. The tray
divider follows its side/top/bottom orientation and disappears when collapsed;
it does not add spacing or move the anchor. Floating cards retain their 9px
radius, shadow and safe clearance. Center-workspace safety padding is preserved.

### Application library chrome

`ApplicationHomeFrame` and `ApplicationHomeHeader` share the product-library grid, app launcher, identity, search slot, appearance controls and account slot. Studio CAD/Animation/Map libraries and the IO local library consume the same header. The Electronics + instruments showcase includes an interactive specimen. Storage and navigation remain app-owned.

### Standard application headers (2026-10-01)

`ApplicationHomeHeader` and `DocumentBar.application` share launcher → app icon →
app name on the left, and settings → account on the right. `DocumentBar` keeps
product document controls in `leading`, product actions in `trailing`, and
layout/docking/window buttons in `viewControls` immediately before Settings.
Application identity accepts a catalog from its caller and makes no host request;
embedded DocumentBar previews can omit `application`.

The shared gear offers System/Light/Dark and Settings. Settings opens the
product callback when supplied, otherwise the shared settings window with
appearance, viewport theme, icon packs, safe spacing and toolbar/sidebar options.
Palette and appearance buttons are no longer duplicated in application headers.
The gear is React-owned and works without the host account widget; the host
continues to own identity/sign-out. Map, CAD, IO, Sketch, Animation and the UI
showcase consume this standard. Theme and color-mode persistence are unchanged.


## Resizable authoring collections — 2026-10-03

`TreePanelSplit` is the shared two-section sidebar presentation. It hosts two
existing collections without adding another card, keeps their scroll areas
independent, and provides a horizontal pointer/keyboard divider. The default
upper share is 65%; resizing is bounded to 20–80%, persists synchronously with
an optional storage key, and double-click/Home restores the default. A saved
ratio scales with the available sidebar height, including docked/floating modes.
It owns no product data or commands. `TreePanel.headerControls` promotes existing
commands beside the title; `showFilter` and `showFooter` support compact sections.

CAD uses Features above Bodies, with New folder and Edit feature beside the
Features heading. Map uses Layers above Outputs; its former Outputs rail entry
is migrated into the combined collection. The gallery reference collection
(`TreePanelDemo`) demonstrates Features/Parts using the same component. Shared
unit tests exercise bounds, reset, retained state and command delegation; browser
checks exercise CAD/Map dragging, reload, saved-layout migration and exclusive
sidebar selection.

The gallery's attached/detached sidebar Layers tabs and popup workspace now reuse
that exact `TreePanelDemo` Features/Parts composition through `useReferenceTreePanel`.
It includes the two STEP groups, three bodies, two sketches, nested folders and
two parts, with the same filter, visibility actions and adjustable divider.
Selection connects sample body/sketch/part appearance and property edits across
tabs; folders receive selection guidance. This is gallery data, not CAD geometry
or a second production tree implementation.

## Connected document panels — 2026-10-03

`DocumentVersionPanel` and `DocumentCollaborationPanel` are transport-independent
presentations over `DocumentConnection`. `standardWorkspacePanels` supplies them
for the common version, comments, notes, task and reminder entries when an app
provides a connection. Studio's library dialog reuses those same panels.
`DocumentServicesDemo` supplies an explicitly local showcase adapter; production
connections and authenticated autosave live in the server/session tiers.

Version actions flush the owning editor first; a connection identifies the
current file and branch. Notes and item edits retain drafts through polling,
compare their original revision, and surface conflicts instead of silently
replacing another user's edits. Reminder due dates/status are in-app records;
there is no external notification delivery. Merge presents a whole-document
conflict choice, not automatic geometry or semantic merging.


### Comments reference layout — 2026-10-03

`DocumentCollaborationPanel` delegates comments to `DocumentCommentsView` while
retaining the common transport, access and conflict controller. The view supplies
workspace/status filters, a compact composer, flat author/reply threads, resolution
checkboxes and icon-labeled edit/remove actions. Saved-state tags and raster
attachments use optional `CollaborationItem` metadata validated by the host.
`comment-images` normalizes uploaded images and handles explicit browser screen
capture with track cleanup. `filter` and `screenshot` are shared icon-pack assets.

The bell is a persisted local live-update preference, not an email/push
subscription. Capture opens the browser chooser only after clicking its button.
The shared document-services showcase exposes the same comments surface; no
product-specific comment markup or icon copies are required.


### Document notes reading view — 2026-10-03

`DocumentCollaborationPanel` delegates notes presentation to `DocumentNotesView`.
The default view is plain text under a compact Refresh/Edit icon header. Pencil
opens the inline textarea; Save, Cancel and Escape return to reading, restoring
focus. The controller retains the edit-start baseline through polling and refresh
and keeps existing conflict review and owner-only mutation permissions. There is
no form or audit list in the reading view. Product adapters need no special code;
the document-services showcase uses this same view.


## Collection header actions — 2026-10-03

This supersedes the fixed collection-footer command convention. `CollectionView`
now gives `TreePanel` and `ListBox` one command location beside the title through
`CollectionActions`: up to two primary actions and a More (…) dropdown for the
remaining commands. Explicit primary preferences are capped at two; command IDs
are deduplicated so promoted actions never repeat in More. Automatic defaults
prefer folder creation, settings and the collection's creation command, when
supported. Missing folder support does not create a disabled placeholder.

More uses the shared portal-positioned `Menu`, opens below the header, preserves
disabled commands and keyboard navigation, and closes with Escape or selection.
Shell-supplied commands remain in the same overflow menu. Context actions and
Delete/F2 tree shortcuts remain unchanged. No collection action footer is added;
the split divider only resizes. Custom non-command footer content is still an
explicit `CollectionView` slot. The existing reference collection showcase and
all consuming trees/lists inherit this standard.


## Versions graph, not a save log — 2026-10-03 correction

`DocumentVersionPanel` restores the compact Onshape-inspired history presentation
from the earlier CAD panel as a shared, product-independent component: icon
commands, search, Name/Modified columns, graph, selection/context menu and bottom
legend. Version, branch, compare and merge forms appear only after choosing the
relevant command. The default view has no form stack or autosave cards.

`documentHistoryGraph` projects a node per workspace head, explicit named version
and document Start. Saves never create version nodes. Labels sharing a snapshot
remain distinct, including multiple workspaces at one head; edges follow actual
parent/merge links through hidden save snapshots, not timestamp adjacency.
Automatic saves live in a separate recovery view reached via More, labeled by
time/author/workspace with no user-facing revision counter. Start is creation,
not an automatic version. Named version creation still flushes current editing
before capturing the intended branch head. Restore, compare, rename/remove labels,
branching, guarded merge, sharing, copying and snapshot downloads remain available.

The server's existing `revision` fields remain internal snapshot/concurrency IDs
for compatibility and stale-write protection; they are not user-created versions
or commit counts. No saved history is deleted by this presentation correction.
The showcase opens on the graph, at sidebar height, using its read-only fixture.


## Version/branch popup and rail commands — 2026-10-03

`DocumentCreateDialog` is the shared creation popup: Name, Description, Create
version, Create branch and Cancel. Both creation actions flush the editor and
use the refreshed head for concurrency checks. The optional branch description
is persisted by Studio. The dialog portals into the overlay host, so sidebar
clipping/sizing never contains it. Success notifies mounted history views by
connection key; cancel leaves selection and scroll untouched. The document
services showcase includes a read-only modal preview.

`WorkspacePanel.command(onClose)` defines a rail command instead of a selectable
panel. `standardWorkspacePanels` uses it for Create version in every application.
It does not change panel placement or the selected tab; older persisted creation
panels migrate back to Features. `SidebarTab.command` carries the dialog affordance
without toggle selection. If a connection is missing, the command explains that
an open saved document is required. The history header uses the same dialog.
Refresh/copy commands are removed from version UI; history refreshes automatically,
and copying remains a file-management action. Compare/merge and branching from a
selected historical entry keep their existing focused operations.


## History controls and complete legend — 2026-10-03

`DocumentVersionPanel` now delegates display filtering, disclosure rows and
legend rendering to `DocumentHistoryGraph`. `document-history-view` follows
first-parent ancestry for branch filters and saved changes; the graph projection
retains merge and primary parents separately so visibility toggles reconnect
correctly. Search crosses branches and includes saved-change descriptions.
The header contains Create version, Create branch, More. Compare is in More;
branching also remains available in row context menus. All commands have icons.

Below Search: Filter branches (all / with workspaces / current / with parents),
Show/Hide automatic versions and Show/Hide merge lines. Show changes expands
saved states between milestones, never named versions per autosave. Selecting
an expanded change enables the existing snapshot actions. The legend, in order:
Workspace; Version; Change; Release candidate; Release; Contains obsoletion;
Automatic version. Responsive columns retain that reading order.

Shared artwork is reused for all markers/actions except the new `branch-filter`
glyph in `core/assets/icons`; the pack's directory inventory shows it automatically.
The document-service showcase includes branch, candidate, release, obsolete and
automatic-checkpoint fixtures, plus the modal preview.

`DocumentHistory.versions` adds optional branch, origin, status, status_updated,
status_note. `version_status` accepts name, branch, expected_revision,
expected_status, expected_status_updated, status and note. Owner-only transitions:
version → candidate; candidate → version (withdraw) or released; released →
obsolete (reason required). Changed state/timestamp or head returns conflict.
These are document-level milestone states, not CAD part release packages.
Successful explicit merges create automatic checkpoints; routine saves never do.

Interaction reference: https://cad.onshape.com/help/Content/Document/versions_and_history.htm
The application UI contains no external product branding.


## AI advisor welcome and conversation — 2026-10-03

The agent layout of `AssistantPanel` adds a compact heading, optional welcome,
sample-question cards, pinned labeled prompt and response rating controls.
`heading` leaves the existing accessible panel/composer names stable. `welcome`
can supply app-specific presentation; `onRate(id, rating)` stores optional
`AssistantMessage.rating` in the owning conversation. The default rating fallback
is local component state. Ratings are never included in provider prompt text.
The original card layout remains available.

`headerActions` places host actions in the agent title row. The separate detail/
toolbar row only renders when `detail` or `toolbar` is supplied.

`WorkspaceAgent` supplies `AdvisorWelcome`, app presentation questions and the
rating callback without replacing its provider/model/cancellation behavior.
IO keeps its existing preview adapter; Map keeps its product-owned context,
local handoff, creative-brief export and session lifecycle. Welcome copy lists
only shared context/conversation/provider inputs, not an invented documentation
search service. The UI showcase includes a separate local advisor specimen.


## Action items reference presentation — 2026-10-03

`ActionItemsView` presents the existing `tasks` and `reminders` collections through
one searchable/filterable list. Shared SearchField, MenuButton, Dialog and icons
provide search, sorting, Type/Status/Assignee/Due filters, creation, editing and
status changes. Default scope is assigned to me; Clear resets all filters.
The new `action-items-empty` icon is in the shared pack and its automatic showcase.
Creation/editing is modal, leaving the sidebar geometry stable. Narrow filter rows
wrap; long lists scroll independently. DocumentCollaborationPanel keeps mutation
collection, permissions, original edit baseline and conflict-review behavior.
The document-services showcase includes this same full-height presentation.


### Universal Part manager

`FileManagerPanel` owns document groups, library folders/breadcrumbs, shared search,
type filtering, document/name/type sorting, compact rows and the pinned selected
item preview. All header/menu actions use the icon pack. Previews use a supplied
thumbnail or the real item type icon; no generated geometry preview is implied.
`DocumentFileManager` connects this presentation to `DocumentConnection.call("list")`
and `openDocument`, with personal/workspace libraries and error feedback. The session
adapter saves pending edits before file navigation; browsing does not save drafts.
CAD supplies project parts/assemblies, Map scenes, Sketch layers, Animation rig parts,
and IO circuit components. Their existing editing/placement tools stay in their own
panels. Future standard rails with a connection inherit the same library manager.
Named-version chips continue to count explicit versions, never automatic saves.


### Shared file identities and type filters (2026-10-03)

`fileTypeFor({name, kind?, mime?, app?})` is the presentation registry for file rows,
cards, details and embedded file libraries. Its result supplies `id`, singular
`label`, plural `plural`, and the shared `icon` name. `fileTypeDefinition(id)` and
`FILE_TYPES` expose the same identities for known types and creation/filter menus.
The pure registry is also exported as `@aether/ui/file-types`, without the UI barrel.
Use `AetherIcon` with the returned name; don't substitute a product logo or a generic
tool glyph for a document. Folders take precedence, then known extensions, then MIME;
product fallback is limited to extensionless files and legacy CAD `.aether` assemblies.
Recognition only affects presentation: it never changes storage ownership or editor
routing. Unknown uploads keep a neutral file icon.

`FileTypeFilters` presents All, Parts, Assemblies, Shows and PDFs with matching
colored artwork, plus a bounded scrollable More menu for other types. It reports
stable type IDs to its controlled consumer and retains the shared Menu keyboard and
focus handling. Drive combines it with the existing name/person filter.

Native file tiles retain their established Core artwork. New tiles for common
external documents/media, sketches, circuits and folders live in `core/assets/icons`
with the existing `file-*` naming. Lists, card views, preview summaries and embedded
file-manager type menus consume those same SVGs. Toolbars and app launchers retain
their separate action and application icons.

### Application file table

`ApplicationFileTable` supplies shared file rows, selection, keyboard open and
action isolation. Default columns remain Name/Opened/Owner for app homes.
Callers may supply `columns`, `compact`, `sort` and `onSort` for a denser browser;
column renderers contain product metadata and the caller owns sorting. Secondary
columns hide on narrow screens, leaving Name/date and per-file actions available.
Drive My files/workspaces consume this variant; storage and access rules stay in
the host.


### FileIcon — application-branded documents

`FileIcon` accepts a file identity, registered type or existing icon key and a
size. CAD Part, Assembly and Project use folded-page artwork with a gold cube,
interlocking cubes and stacked project sheets. Silver/light and charcoal/dark
palettes follow the inherited color scheme. Their corner badge uses the official
CAD AppIcon source. Every other native type uses its own illustrated object
and official AppIcon badge at the same proportion. Imported documents and media
use the same folded-page family with distinct content objects and no Aether app
badge; folders keep a shaded gold folder silhouette. Toolbar-only icon keys
remain plain AetherIcon glyphs. This keeps file presentation consistent without
drawing new app logos.
`ApplicationFileTable` reserves selection-control space while hiding unselected
controls; keyboard focus reveals them. Its double-click invokes open once and
does not repeat the row-selection callback.

The Icons & Assets gallery includes every registered type in both palettes at 144px
and 18/24/40px list/preview sizes. `AetherIcon` scopes SVG resource IDs per
instance so gradients cannot accidentally reference another row or theme. The
source drawings stay in `core/assets/icons/file-*.svg`; each app mark remains
the canonical `branding/apps/` identity served by Studio.

### NewFileDialog — create first, open separately

A shared naming dialog for app libraries and Drive. It displays the destination,
waits for the caller's asynchronous `onCreate`, prevents duplicate submissions,
and keeps the entered name with an error when saving fails. Closing/cancelling
is disabled during creation. The widget contains no document schema, transport
or editor navigation. Library callers select the created file and stay in its
directory; Open, double-click or Enter opens it afterward.

Native browser factories are product-owned `create-document.js` build entries
exporting `createDocument(name): File | Promise<File>`. CAD Part, Map, Sketch and
IO use their existing constructors/serializers; Animation delegates serialization
to its canonical engine. Studio's creation adapter persists their bytes with the
requested folder/workspace, and retains the existing CAD Assembly/Project service.


### Compact property inspectors (2026-10-04)

`Inspector` supplies the shared compact property-sheet presentation used by every
Aether Map right-rail panel. Wrap a product's fields once; nested `FieldRow`s
inherit a label/control row, and `ParameterRow`s use the same typography and
spacing with a slider and numeric entry. Standalone forms retain their existing
stacked labels. Use `FieldRow layout="stacked"` only for controls needing a full
line, such as a three-way device selector or alignment matrix.

`InspectorSection` groups related settings with a quiet heading/divider; supply
`defaultOpen` for a collapsible section. `InspectorActions` keeps related actions
in a wrapping row. Field help opens from an accessible information button; errors
stay visible. All surfaces, fields and focus colors use shared theme tokens.
Products own selection, settings and transactions. They should compose these
components, not restyle `.aui-*` controls in product CSS.


### Suite inspector standard (2026-10-04)

All application property sheets use `Inspector`, `InspectorSection`, `FieldRow`,
`ParameterRow` and `InspectorActions`. `WorkspaceShell` applies this presentation
by default to right-side panels in docked, floating and tabbed layouts.
`PropertyGrid`, appearance/configuration editors and style properties use the
same standard when rendered independently. Nested inspectors retain context and
product classes without doubling padding.

Use one setting per row: label on the left, control on the right, quiet section
separators, grouped actions, shared theme/typography/field tokens. Additional help
is available from the row's information button; validation stays visible. Use
`layout="stacked"` only for content that needs full width (e.g. a multiline editor).
Do not recreate legacy title-above-control sheets or product-specific field CSS.
CAD transaction dialogs retain their Accept/Discard behavior.

A non-property canvas/editor can explicitly set `contentLayout="custom"` on its
workspace panel. Collection panels keep their collection layout. Left-side
property panels explicitly use `Inspector` or `contentLayout="inspector"`.
File detail panels in Drive and app home pages follow the same property-sheet
standard. Ordinary login, setup and long-form dialogs remain forms, not inspectors.

### ComingSoonHome — sidebar navigation

`navigation="sidebar"` opts a product into a full-height application rail with
identity and collapse toggle at the top, navigation in its body, and the host
account/settings slot pinned to the bottom. Main content scrolls independently.
Collapse state persists per product; links retain accessible names in the icon
rail. The default `header` layout is unchanged. Gallery includes Vector and
Sketch examples; Vector is the first production consumer. The account slot uses
`data-aether-account-layout="sidebar"`; session owns identity and upward menus.

### ApplicationSidebar

Shared global app rail extracted from the Vector pilot and used by Vector and
Map. `id` controls persistent collapse independently of workspace; identity and
home link sit above scrollable product navigation, with optional `footerTools`
and the host's bottom account slot. Product controls use `SidebarLabel` for text
that hides in the icon rail, keeping accessible names on the links/buttons.
`aui-application-sidebar-caption` groups navigation; `aria-current` links and
`aria-pressed` buttons share the selected treatment. All glyphs/tokens come from
the shared system. Account identity stays in the session runtime, not UI state.
The gallery's two sidebar home examples exercise the same component.

**Captioned reference variant (2026-10-14).** `variant="captioned"` uses static
uppercase group captions in both widths, never disclosure chevrons. It is 224px
expanded / 80px collapsed with 32px rows and uniform 18px navigation glyphs;
supply a 40px standalone AppMark for the larger brand role. The entire icon/name
area is one collapse/expand button, usable by pointer, Enter or Space. It does not
navigate; provide Overview/Home in the navigation rows. No separate collapse icon
is shown. It retains the shared
collapse preference, navigation callbacks and host account slot. The gallery
reference configurations isolate their white, near-white and dark-navy palettes,
with Settings initially selected and independent working navigation state.
The default app sidebar keeps its existing workspace/disclosure behavior.

**Standard Aether sidebar (2026-10-10, UI alpha.8).** Each section is its own
navigation landmark named by its caption (untitled sections use the sidebar name). The one sidebar every app
uses. Pass data, not markup: `sections` (`{ id, title?, items }`; items carry
`label`, `icon` as a shared glyph name or custom tile, optional `badge`,
`current`, `href` or `onSelect`, `disabled`), an `action` slot above navigation
(e.g. "Create or upload"), and `settings` for the pinned Settings row (it
dispatches `aether-open-settings` unless given `onSelect`, and replaces the
account control's own gear in this footer). `apps` + `currentApp` add the suite
app launcher as an "Apps" row below Settings. The account (avatar, name, email)
stays at the bottom. Captions are uppercase section labels that become dividers
in the icon rail; badges hide in the rail; every row has a tooltip and an
accessible name. Selection is a soft accent tint. `brand={false}` leaves identity
to a page header. Library homes use `ApplicationHomeFrame layout="sidebar"` with
`ApplicationHomeHeader identity={false}`: the sidebar runs full height with the
app icon and name, and the header keeps only centred search. Aether CAD's
home is the first adopter; `SidebarNavigation` is exported for app-owned layouts.

`WorkspaceShell toolbarSpan="center"` places the docked toolbar above the
central canvas, between full-height sidebars, matching `centerBottom`'s width.
The default remains `window`; floating/canvas toolbars retain their existing
placement. Map opts into the center span.


### DocumentTabBar (2026-10-11)

A thin wrapper around the existing `DocumentTabs`, not a second tab widget.
`placement="bottom"` puts + at the far left with rounded lower tab corners;
`placement="header"` retains the header variant. The bottom row has a stronger
neutral fill than inactive tabs; the active tab uses the workspace background,
bold text and a thin accent underline. Apps provide type artwork through `icon`;
CAD uses Part/Assembly `ToolIcon` artwork without a file wrapper or app badge.

**Studio reference variant (2026-10-16):** `variant="studio"` is an opt-in
50px full-width bottom row with a dark surface, 174px thumbnail tabs and two-line
name/kind labels. `DocumentElementTab.detail` is the subtitle; it is not save
status. Apps supply the artwork and document actions. Add stays at the leading
edge, Next document cycles enabled tabs, and optional `onOverview` pins a grid
action at the trailing edge. Width changes collect extra tabs into the shared
More documents menu while keeping the selected tab visible. Keyboard arrows and
Home/End retain the shared behavior. Active and keyboard focus each use one
inset edge, with no outer ring. Existing standard/header/tray variants remain.
Review independently under Overlays → Navigation bars → Document tabs before
adopting in an app. The gallery has local add/select/reset/overview interactions;
it does not open a demo app or persist documents.

Jonathan approved the shared macOS-style ribbon on 2026-10-11: title-case
labels, soft selected-tab shading, neutral hairlines and softer buttons. Glass
and panel layouts remain supported; command behavior and icon artwork are unchanged.

Onshape-style bottom bar for a document's elements or open files: a "+"
(either `addItems` for a menu or `onAddClick` for an app's own dialog), then one
tab per entry with icon, label, `current`, `onSelect` and optional `onClose`.
Presentational; the app decides what tabs mean. Aether CAD: in a Project
document the tabs are its Part Studios and Assemblies; in a standalone
document they are the open files (per browser). "+" opens the shared
"What do you want to design?" dialog (`CAD_DESIGN_KINDS` in
`@aether/session/library/design-kinds`, shared with the Studio home).

### WorkspaceShell layout additions (2026-10-11)

- **Three-column body.** The docked toolbar can span the centre column
  (`toolbarSpan="center"`). In the floating layout the side columns run the full
  height, level with the toolbar, and the floating toolbar centres between
  them (measured side insets).
- **`pinnedPanels`** (docked only): a pinned panel keeps its own column beside
  the canvas and is exempt from one-panel-per-side; the rail's other panels
  open in a column between the rail and it (Onshape's feature list).
- **`sideTop` / `sideBottom`**: widgets that belong to a side's column. Floating:
  stacked above and below that sidebar. Docked and canvas: at that edge of the
  canvas. Aether CAD: view cube on top, selection filter at the bottom.

### Inspector design authority — 2026-10-11

2026-10-13 refinement: Inspector tabs are separate choices on a transparent strip,
with one solid accent selection. Do not wrap them in a second filled or outlined
capsule. Inspector actions and inputs use soft flat fills with no idle outlines
or inset shadows; borders remain available for focus, invalid values and actual
selection. `Button appearance="flat"` shares this action treatment outside the
inspector (for example Map's visualization header and layer actions). Keep the
existing property-sheet labels, field geometry and section separators. This is
the approved direction from the visual reference and StylePropertiesPanel.

Map adopts this standard in its regular application through UI85/session142.
The official local Map release `map-flat-controls-20261013-r1` includes it;
Simple and Advanced inspectors consume the shared controls. Product source and
the installed application must be qualified together when updating Map UI.

Jonathan selected the Appearance, StylePropertiesPanel and transform inspector
examples as the suite's macOS-inspired property language. All product property
trays should compose Inspector, InspectorSection, FieldRow, NumberField, SelectField,
Slider and SegmentedControl; do not create a competing product-specific form skin.
Use flat sections with subtle separators, title-case headings, 12px labels, soft
30px fields, 6px corners and blue selected segments/tabs with selected-text contrast.
The shared Inspector now owns these defaults. Labels occupy 36% of an inline row;
trays with less than 220px of content width stack the label above the control. Explicit stacked rows
remain available for genuinely complex editors. Focus and invalid states remain
visible. WorkspaceShell's default right tray is 320px and remains resizable.

CAD's appearance, rendering, camera and performance sections now use this same
composition, including disclosures. Assembly groups use InspectorSection instead
of all-caps custom headers; inspection availability rows are flat rather than
nested cards. This styling does not add unimplemented CAD material/configuration
semantics. UI alpha.27 / session alpha.31 are adopted by Studio, CAD and Map;
other pinned consumers adopt the shared change with their next package update.

AppearanceInspector accepts `showTessellation={false}` when a consumer has no
working tessellation command. Palette, mixer, hex/RGB and opacity remain the same
shared editor. CAD now consumes this editor directly (UI alpha.28/session alpha.32),
with product-owned preview finish/roughness/metallic controls.

### Manual interface colors

SharedAppearanceSettings includes InterfaceColorSettings: browser-local, separate light/dark overrides for page/workspace/panel/bar/input surfaces, borders, accent and text. Neutral gray applies a coherent surface/text palette; Reset colors removes only the current mode’s overrides. ColorField validates six-digit hex. StudioChrome applies settings at startup and on cross-tab/OS mode changes. ApplicationHomeHeader accepts optional onSettings for product settings windows; all SettingsWindow instances retain shared UI controls.


### Standard application home — UI alpha30

Use `ApplicationHomeFrame layout="sidebar"`, `ApplicationSidebar`, a search-only `ApplicationHomeHeader`, and `ApplicationUpdates`. The latter supplies the approved horizontal What's new cards: welcome/hero artwork first, then independently colored feature cards with explicit Available/Preview/Planned labels. Products supply content; the widget never fetches a catalog or claims features itself. `ApplicationWelcome` now delegates to this feed and accepts optional product updates. Keep unavailable tools disabled or explicitly planned; do not fill missing app functionality with CAD actions. File creation stays on the current home; explicit Open enters the editor.

Studio's `library-apps.ts` supplies per-app native formats and starting actions to one hosted library page for CAD, Map, Animation, IO and Sketch. Drive retains its service-specific navigation/actions in the common frame; Vector uses the same frame with a planned-tools empty state.


### WorkspaceFileBar (2026-10-11)

Shared editor-bottom composition of DocumentTabs, the existing bottom tab styling,
a contents-first file manager Dialog, and a create button. The manager sits left
of +. Products supply tabs, selection/close/reorder callbacks and
DocumentFileManagerProps; save/navigation/create semantics stay in the product.
Open from library mounts the existing DocumentFileManager only when requested.
FileManagerPanel.showLibrary defaults true; the contents-only view sets false.
Map, IO, Sketch and Animation use this adapter; CAD retains its richer project
and pointer-detach adapter around the same DocumentTabs. UI31/session46.

### Collapsed floating tray alignment (UI32)

Collapsed side trays center vertically in remaining column space, respecting
sideTop/sideBottom accessories. Expanded panels retain their prior sizing.

### ApplicationSplash (UI33)

Controlled startup surface. Required appName/headline; optional tagline, version,
artworkUrl, detail, progress (fraction0–1 or omit), state (loading/ready/offline/error),
stages (id/title/detail/phase), footnote and product-owned actions. App lifecycle
owns readiness, retries, offline availability and dismissal. Never fake progress.
Use an image from assets5 branding/splash-backgrounds or product artwork. Choose
once per startup; do not rotate imagery behind loading text. The gallery's
?demo=application-splash uses sample states and selectable backgrounds.


ApplicationUpdates (UI38): free horizontal wheel/trackpad scrolling without card
snapping. Regular wheel over overflowing cards scrolls horizontally and releases
page scroll at either boundary; Shift gestures and browser zoom remain native.

Button (UI39): inline-flex centers label and decorative icons with a6px gap.
Direct SVG icons use16px dimensions and do not shrink; images retain their size.

UI40: selected SettingsWindow items and primary/active Buttons retain their
accent background and selected text color during hover.

UI41 Menu: one expanded submenu branch,160ms pointer-leave grace period,
re-entry cancellation; clicking an already-hovered opener keeps it open.

UI42 compact menus:24px command rows,4px outer padding/separators,14px icons,
check gutter only for checkable menus; illustrated tool rows remain28px.

UI43 ApplicationSidebar:34px rows,20px icons,2px navigation gaps and14px section
spacing. Expanded and collapsed modes retain the same row height.

UI44: `ListSpacing.css` is the shared list-density contract imported by widgets.css.
Navigation uses 34px rows/20px glyphs/2px gaps, content gaps are 8px and section
gaps 14px. File cells use 8px vertical/12px horizontal padding; listbox options
have 28px minimum height. Settings cards use 12px/14px padding and 8px gaps.
Coarse pointers receive 44px navigation/options and 12px file-cell padding.
Tree virtualization heights remain explicitly owned by Tree/TreePanel.

## Approved context-menu standard — Jonathan, 2026-10-12

The Drive file context menu approved in this session is the visual reference for
all Aether application context menus. Use the shared Menu component and its
widgets.css rules; products supply commands, icons, availability and grouping,
not their own spacing, menu surfaces or icon geometry.

Preserve compact 24px command rows, 16px glyphs, a 5px content gap,
2px/6px row padding and 5px outer padding. Separators are 1px with 4px/5px
margins. Labels, shortcuts and submenu arrows use aligned columns. Menu width
fits content with a viewport-clamped 240px minimum and 360px maximum. The
shared surface uses 13px corners, 96% theme panel color, 20px backdrop blur and
a soft 0/5px/16px shadow at 22% theme shadow color. Text is body size plus 1px;
command icons inherit text color, while check indicators retain accent color.
Root menus and submenus use identical styling. Illustrated tool commands retain
the existing 28px exception. Every menu reserves the same check gutter, including menus without checked items.

Keep keyboard focus, disabled states, outside-click/Escape dismissal and the
single-branch submenu behavior with pointer-leave grace. Future menu adjustments
belong in shared Aether UI and must preserve this approved visual rhythm.

Text context menus: preserve the native browser menu for selected text and editable fields, including keyboard invocation. ApplicationContextMenu intercepts propagation without canceling the native default so product file/canvas menus cannot replace Copy/Paste. Non-text targets keep shared Aether menus.

Creation pickers: use MenuButton density="comfortable" and placement="bottom-start". Shared comfortable density provides 250px minimum width, 36px rows, 20px icons and 9px gaps. Right-click menus retain the default compact density.

ApplicationSidebar toggleInContent omits the brand toggle so products can place SidebarToggle in a user row. Keep brand/user/action heights and icon columns stable across collapsed and expanded modes. Drive uses a persistent workspace disclosure and initials when no explicit workspace icon is assigned.

ApplicationUpdates labels Planned items as Coming soon within each card; do not add a redundant planned-features footer. Distinguish available features from roadmap cards without implying an implementation or release date.

UI50 menu alignment: always reserve check16px + icon16px + label + shortcut + arrow8px, with5px gaps. Do not conditionally remove the check gutter. Checked items use the shared check glyph; every Drive background command and submenu choice has an icon.

UI51 submenu placement:4px between parent and child menu borders. Include parent padding and border in offsets from the containing row. Never use negative horizontal inset to overlap surfaces; retain pointer-leave grace across the gap.

SidebarRow is exported for product-provided navigation. Use it for standard icon-and-label rows, including workspace monograms; do not recreate its markup or spacing with aui-sidebar-row. SidebarItem supports onContextMenu for item-specific actions.

SidebarRow current pages use a solid accent background with on-selected icon/text colors, retained during hover and in the collapsed rail (UI53).


## Suite list and navigation standard (2026-10-12)

Use `ApplicationListHeading`, then breadcrumbs where location matters, then
`ApplicationListControls`, then `ApplicationFileTable` or the matching empty state.
Do not add page item totals or replace filters with a selection toolbar. Put file
actions in item menus; selection counts and clear-selection belong in controls.
Tables begin Name, Type, date, Owner. Date labels reflect the view; extra metadata
follows those columns. `onSelectedIdsChange` enables shared checkbox, Shift range,
and Cmd/Ctrl toggle selection; products own operations and permission checks.

Use `SidebarRow` within `ApplicationSidebar` for all navigation rows, including
workspace entries. Use `SidebarGroup` for disclosure (`storageKey` optional),
`WorkspaceIcon` for initials and `userLabel` for account context. The sidebar owns
34px rows, 20px icons, 12px label gaps, solid current-state colors and stable rail
geometry. Do not recreate these with product CSS. DashboardShell also uses rows.

Use `Menu`/`MenuButton` for context menus and `ListToolMenu` for Sort/View. They
share the compact surface, icon/check columns, nested-menu spacing and dismissal.
Use comfortable density for Create pickers only. Keep native text/editable context
menus intact through ApplicationContextMenu. The session LibraryToolMenu export
is a compatibility adapter to ListToolMenu, not a separate dropdown implementation.

Shared changes require a versioned UI release and adoption by every consuming
frontend. Run `npm run check:ui` at the Studio root to detect stale manifest,
installed UI or session peer versions before declaring suite-wide adoption.


ApplicationHome owns the home-page height contract: when no Studio status tray is
mounted, no legacy body status-bar padding may leave a strip under the sidebar.
The sidebar reaches the frame bottom in both expanded and collapsed modes (UI58).

Menu commands use catalog-backed icons: Rename uses pencil, application settings uses settings. Do not use the nonexistent edit icon. UI59 supplies the settings icon through ApplicationContextMenu.

DocumentTab.status/statusTitle carry document-specific save state inside the tab. Do not place the active document save label in the global WorkspaceFileBar trailing area. Only report statuses actually known for each document.

Save-status adoption: CAD, Map, Animation, Sketch and IO render persistence state in the owning document tab. Operation notices may remain in the surrounding strip; they must not substitute for per-document save state. Vector has no editor yet.


Floating workspace sidebars remain vertically centered in both open and collapsed
states. Content-sized and resized inspectors grow around their center; fill-height
sidebars occupy their available column. Keep this rule in WorkspaceSafeArea.css.


Workspace user bars use WorkspaceQuickControls through DocumentBar. The shared
Settings → Header pane selects and orders available icons per application; there
is no ellipsis customization menu or header drag-to-pin interaction. Defaults are
appearance, Share and App tray, or the caller's `defaultHeaderPins`. A fixed Settings
button and account stay reachable when every optional icon is hidden. Registered
metadata exposes only available controls; choosing a pin never runs its command.
Actual product callbacks (mode, windows/tabs, layout, comments and app controls)
remain in the header. Browser-local ordered IDs sync across mounted bars/tabs for
the same app. Unavailable controls are retained but hidden; existing global pin
preferences remain the fallback until that app's preferences are saved. Settings
uses the app callback/event or the standard SettingsWindow in the overlay host.
Application onShare overrides the default copy-link popover; copying grants no
access. This is shared editor chrome, not a home-sidebar settings replacement.


Context-command contributions use the shared compact Menu rows, icon gutter and
separators. Group headings are metadata for separators, not a second visual
section-heading system; do not prepend Selection/Application banners or leading
dividers. Commands provide their icons; standard shared command IDs resolve to
shared icon assets when omitted. Header pin choices use shared SettingsRow and Checkbox controls in Settings.


Bottom editor trays use aui-document-tray from DocumentTabBar.css: 19px heading
rail plus38px divided tab row, split create/dropdown, per-tab action chevron and
accessible6px save-status dot. The surrounding strip keeps the prior gray mix
and active tab uses the light shell surface; selected accent remains on top.
WorkspaceFileBar supplies the standard layout/actions, while product adapters
retain their own document lifecycle and grouping. CAD consumes the same styles
instead of a separate tray design. Header tab placement remains unchanged.

### Workspace support shortcuts
WorkspaceShell registers presentation capabilities for the visible editor.
WorkspaceQuickControls projects existing Comments/Reminders panels and a shared
Workspace layout popover; product-supplied controls take precedence. Panel state
remains owned by WorkspaceShell. Common shortcut pin IDs survive app switches.
Connected applications use the Studio plugin manager dialog. File trays retain
the common light/gray styling and per-document status.


### Application footer standard — 2026-10-13

`ApplicationStatusBar` is the approved bottom window strip for all Aether apps.
The left edge shows a connection indicator followed immediately by the product
name. The configured company/Studio name sits at the right edge. Keep the middle
quiet for transient messages; connection failures show their explanation there.
Do not put the normal connection label on the right or substitute document save
state for server connection. The document tab continues to own its save state.

Use the shared token height,11px text,12px edge insets and7px indicator; narrow
windows use8px insets. Long identities truncate without overlapping. Company
identity comes from the host/application, never a hardcoded demo company. Unknown
company stays empty. Connection details are accessible and available on hover;
connecting, confirmed connected, unavailable and standalone-local states remain
truthful. The component performs no requests or storage operations.

React apps use `ApplicationStatusBar`. Framework-neutral bootstraps use
`createApplicationStatusBar`/`updateApplicationStatusBar` from
`@aether/ui/application-status` with `@aether/ui/application-status.css`.
Both call the same renderer. The session adapter supplies status API data and
window placement, and bundles this UI86 presenter into the two shared `/suite/`
assets loaded by every hosted application. Do not recreate footer markup/styles
inside products. Existing generic `StatusBar`/`StatusDot` remain available for
workspace metrics and embedded tools; they do not replace application identity.

The gallery's Overlays → Status bars → Status bar includes connected, unavailable and
standalone examples. Installed generation `application-status-standard-20261013-r1`
updates the shared hosted bootstrap without rebuilding individual product bundles.


## Application marks — 2026-10-13

`AppMark` displays each app’s standalone transparent A. `AppIcon` displays its
existing square identity. They are separate assets, never a CSS crop or mask.
Marks retain their native proportions with no added tile, border or corner radius.
Use meaningful alt text when the artwork supplies the app name; omit it beside
an equivalent text label. Asset URLs are resolved by the app bundler, including
standalone/offline builds. Only displayed image resources are fetched.

Import `AppMark` from `@aether/ui/AppMark`; props are `app` (Studio by default),
`size` (32 by default) and normal image attributes. All nine app ids are supported:
`studio`, `cad`, `animation`, `ui`, `map`, `sketch`, `vector`, `io`, `drive`.
Review all marks on light/dark/alpha surfaces at the gallery’s `/app-marks.html`.
Canonical assets and provenance: `core/assets/branding/marks/README.md`.

### Feature editor accessory row

The collection offers **Standard** and **Compact** feature editors. Jonathan
removed the Spacious showcase design on 2026-10-15; it is no longer offered in
the gallery. Its legacy shared API/styles remain for existing callers.
Keep the retained variants as bare widgets in the wrapping side-by-side layout;
do not frame one in an extra demo card. Gallery specimens grow to their contents,
while live floating editors keep their viewport height limit and scrollable body.

The Standard header uses the same tinted icon/title language as Compact while
retaining its original **37px height**. Use a **22px shared feature icon**, a
16px semibold sentence-case title and the existing green Apply/red Cancel
controls at the right. Titles truncate before the actions and retain a tooltip.
The 300px window, body rows/fields, spacing and accessory footer are unchanged.
Gallery editors supply each feature's existing ToolIcon through `headerIcon`.

`openFeatureWindow({variant: "compact", headerIcon, ...})` uses the rounded
compact frame, icon/title header, full-width pill tabs and bottom Cancel/Apply.
Its 300px width, 12px body text, 26px fields and 8px body gaps match Standard;
labels and selected values retain the same single-line room.
The optional `headerIcon` is an artwork node supplied by the caller. Every variant
uses the same body API, validation, picker and fixed accessory row; only container
presentation and action placement differ. Call `close()` when replacing a window
to release its outside-click listeners as well as its DOM.

All nine compact gallery specimens reuse `CAD_FEATURE_EDITORS` body builders
from the standard set, including each feature's selection lists, fields, nested
options and validation. Do not maintain separate generic compact forms. Sketch,
Extrude, Revolve, Sweep, Loft, Thicken, Enclose, Plane and Mate are shown side by
side and wrap. Apply records sample feedback in place; Cancel resets the specimen.
Do not add popup launchers, reopen buttons or duplicate header actions. CAD still
owns engine execution and saved feature state; this is a presentation reference.

Every `openFeatureWindow` ends with the same accessory row (at least 36px high), separated from
its scrollable parameter body by one subtle rule. Small flat icon buttons align
to the right; Help (`?`) is always last. Do not add a surrounding button frame or
repeat Apply/Cancel here. `win.actionIcon(svg, label, onToggle, active?)` inserts a
feature-specific toggle before Help. Supply shared asset SVGs and descriptive
labels. Each button exposes `aria-pressed` and calls `onToggle(active)` with its
new state. In the default theme, off icons are gray and active icons are blue;
only the icon color changes. Do not insert help text, open content, resize the
editor or change its layout when these controls toggle.

Help follows the same rule. `helpActive` sets its initial state, `onHelpToggle`
receives user changes, and `setHelpActive(active)` synchronizes app-owned state
without firing the callback. Legacy `help` metadata is accepted for compatibility
but is never rendered. Enter and Space activate accessories without committing
the feature. Escape turns Help off without moving focus or discarding the draft.

React wrappers can mount `createFeatureWindowAccessories({title, helpActive, onHelpToggle})` and
remove its returned `element` on unmount. This is the same renderer used by the
standard and compact specimens (and legacy spacious callers). Product code owns the toggled state;
the shared component owns the fixed row, icon colors and keyboard behavior.

### Toolbar category tab shape — 2026-10-15

WorkspaceRibbon and ToolSidebar text category tabs keep their rounded reference
shape using the theme row radius. ToolSidebar retains the original 5px/8px/3px
strip padding and 2px tab gap. These are text navigation tabs, separate from
icon tool cells: changing selection-cell radius or inset must not square off or
reposition the category strip. Tool order, toolbar placement and full-cell icon
selection remain owned by their existing controls.

### Floating toolbar spacing and selected buttons — 2026-10-15

FloatingToolbar's tools variant spreads fixed-size tool buttons across its tray
and keeps the compact evaluation capsule at the trailing edge. Buttons use
rounded inset highlights with the theme accent and selected-text colors, as
requested for this reference variant. Document selection buttons use the same
state colors at their smaller size. This is scoped to FloatingToolbar; the
full-cell treatment in other overlay containers is unchanged. Narrow trays
scroll horizontally and search filtering never stretches the button shapes.

### Icon button reference appearances — 2026-10-15

Elements → Icon buttons independently shows glyph-color, rounded and full-cell buttons with
working controlled selection and disabled examples. Shared IconButton owns both
appearances: rounded uses a 36px square, 18px glyph and 10px corners; cell uses a
44px square, 26px glyph and the theme selection-cell radius. Both use the shared
accent/selected-text state. Containers supply spacing, not private selection
colors. FloatingToolbar consumes rounded with its existing sizes/capsule shape.
Default and retired Plain callers now resolve to Rounded; sidebar container behavior remains unchanged.

### Reference inspector proportions — 2026-10-15

Jonathan's latest reference adjustment supersedes the larger automatic sidebar
tray: Automatic is now 36px cells/20px icons, Compact 30px/18px and Touch 44px/26px.
Attached/detached and edge-anchored layouts share those dimensions. SidebarProperties
uses a taller 36px Display/Properties selector with 12px text, compact 28px fields
and lighter section headings. Axis locks consume shared IconButton's glyph
appearance: 28px target, no border/fill, muted off/accent on, open/closed shared
lock glyphs and retained keyboard/disabled-field semantics. Glyph is independently
shown on Elements → Icon buttons; its host does not invent a private button style.

## Reference workflow standards — 2026-10-15

Widgets → Forms & inspectors → Workflow widgets contains eleven independent
specimens from Jonathan's supplied light/dark reference: sequences/messages,
login/signup, team membership/credit limits, personalization sources, batch action
review, framework import, structure review, profile settings, subscription plans,
file/field mapping and text variants. No specimen needs a mock workspace.

The shared exports are `SequenceBrowser`, `AuthenticationForm`,
`TeamMembersPanel`, `PersonalizationForm`, `BatchActionReview`, `TemplateEditor`,
`AccountProfile`, `SubscriptionPicker`, `FieldMappingForm` and `TextVariants`.
They compose existing controls inside `DashboardCard density="compact"` and use
the standard Menu, Popover and Dialog for transient content. Compact is an
approved density of the existing card, not another overlay family. Card titles,
fields, selections and actions have accessible names; controls preserve native
form, radio and keyboard behavior. Team credit edits enforce the supplied
available credit total; required field mappings gate Continue.

New building blocks are independently showcased under Elements: Avatar,
PasswordField (reveal/hide), ChoiceCard (native radio plus optional selected
content), SettingsLink (shown as Settings rows), StructureStep and Button's
`appearance="link"` text action. Existing TextField, SelectField, Checkbox,
SegmentedControl, Slider, IconButton and FileField remain their canonical atoms.
ChoiceCard interactive details sit outside its radio label. Give PasswordField an
explicit aria-label or aria-labelledby when its external label wraps its reveal
button. Avatar uses initials when its image is absent or fails.

Aether Slate is the standard reference theme, with soft white and neutral
charcoal modes, compact rounded controls and cobalt primary actions. It appears
in the global theme menu, theme pack and theme collections. The workflow page's
Slate light/dark switch is scoped and does not write global preferences; menus
and popovers inherit that scope. `color-bg-segment-selected` and
`color-text-segment-selected` allow quiet gray tab selections independently from
primary actions. Existing themes inherit aliases to their previous colors.

All data and external actions belong to callers. Gallery examples only modify
local sample state; they do not authenticate, send email, purchase subscriptions,
charge credits or delete real accounts. Local CSV selection reads a header for
mapping demonstration; framework extraction uses paragraphs, not AI. Production
adapters own authentication, pricing, authorization, generation and persistence.

## Analytics dashboard standards — 2026-10-15

- `ComparisonChart` accepts caller-owned `ComparisonPoint[]` / `ChartSeries[]`,
  line or grouped-bar presentation, nonnegative finite values, selection callback
  and value formatter. Its shared ChartLegend toggles visible series. Points are
  inspectable by mouse/focus/Enter/Space, including an all-series-hidden state.
- `GaugeChart` shows a bounded fraction as a semicircle and exposes meter semantics.
  The caller supplies the headline value and target detail; this component does
  not infer conversion rates or customer/revenue meaning.
- `RankedList` displays ordered, labelled metrics with optional icons and controlled
  selection. Callbacks carry IDs; the component never opens a page itself.
- `ChartLegend` and `StatusBadge` are independent Elements. Existing Avatar,
  buttons, fields, menus and Dialog remain shared.
- `DashboardCard` adds an optional caption; existing compact density is retained.
  `DashboardTable` adds compact density; standard density stays unchanged.
- `DashboardNavigation` is a shared rail configuration of CollapsibleSidebar and
  SidebarRow, using the existing tint selection variant. Brand toggles the rail;
  sidebar state persists per ID. It is independently shown under Overlays.
- The Aether Analytics app composes these assets; it introduces no embedded fake
  browser or separate popup design. Page/date/filter state, illustrative data,
  CSV adapters and layout belong to its gallery module. Import validates a whole
  CSV before replacing that period's sample users; export preserves quoting and
  escapes spreadsheet-formula prefixes. No remote analytics/account service.
- Artwork stays in `@aether/assets`; four small original country flag illustrations
  supplement the existing dashboard flag assets. Theme values belong to the
  Aether Analytics manifest, with light/dark variants and existing shared tokens.

## Top app navigation — 2026-10-15

`AppNavigationBar` composes the approved `DocumentBar` with shared Button page
controls and caller-supplied utility actions. It is independently catalogued in
Overlays → Navigation bars. The page selector sits immediately after app identity on the left, inside one
subtle rounded group. The current page uses a rounded accent fill and
`aria-current`; unavailable pages use native disabled buttons. The right side is
reserved for caller-supplied pinned utilities, Share and account actions. At narrow container
widths the page row moves below the identity/actions and scrolls horizontally.
The caller owns page state and the brand/home action. Existing IconButton, Avatar,
Menu and Dialog elements supply actions; no new element or popup frame is needed.
Aether Analytics defaults to this header and offers its existing sidebar in
Settings → Navigation layout. Switching presentation preserves page/report state.

## Avatar studio demo — 2026-10-15

`MediaPreview` is an aspect-correct image composition widget: caller-owned
background and foreground artwork, framing, mirror/filter presentation, optional
local preview animation and children for annotations. It does not own tracking,
recording or device output. `ThumbnailPicker` is a controlled visual collection
using shared Button pressed/disabled states. Both are exported by `@aether/ui`.

The Aether Avatar Studio demo uses the existing `DocumentBar`, `TabbedSidebar`
and `FloatingToolbar` unchanged. Scene, avatar-look, framing, output and annotation
controls are also shown independently under Widgets → Color & appearance.
All controls use existing Elements; no new popup or container design is introduced.
The demo owns normalized drawing points, illustrative scene state and PNG export.
Four backdrops are configurations of the original forest artwork and a studio
background; four avatar looks are finishes of one original illustrated presenter.
Motion preview is a local idle animation, not webcam capture or facial tracking.
Artwork and generation prompts live in `core/assets/illustrations/avatar-studio/`.


## App header bars — 2026-10-15

Overlays → Header bars now shows the actual `DocumentBar.application` used by
CAD, Animation and Map, independently of workspace demos. The same category
contains Top app navigation and the individual header chrome controls.
Workspace choices are sample app content; `WorkspaceSwitcher`, identity, layout,
appearance, sharing, launcher and Settings remain shared components.
The bordered CAD example follows the transparent header’s left-hand document
hierarchy: identity, document, Main version pill, document link and local state.
Its right side uses compact search, Settings, appearance, notifications, comments,
app launcher, Share and an avatar. The Design workspace selector is removed from
this variant. `DocumentBar.compactControls` uses 28px utilities with 16px glyphs
and places Settings before pins in both reading and keyboard order.
Animation and Map retain their workspace selectors, expanded search and named
account. All retain their surface/border; Settings → Header configures each app
independently. Existing CAD pin choices/order survive; launcher and Share are
introduced once, and later user changes remain authoritative.
Search/workspace changes and local preview dialogs are interactive; no connected
account, notification feed or document authority is implied.
`DocumentBar.account` optionally supplies account presentation for standalone
apps and specimens; omitting it preserves the Studio host account mount.
The CAD gallery account uses the existing Studio/CAD card hierarchy: suite name,
Sign out, large avatar, name/email, View account and Aether Agent. The standalone
sample does not sign out a real session or claim a connected agent. Other examples
retain their sample Avatar/Menu. Live application account behavior is unchanged.


## Concept app header — 2026-10-15

Overlays → Header bars → Concept app header is a gallery-only reference concept
composed from DocumentBar, Button/IconButton, Avatar, Menu, Popover, TextField
and Checkbox. It uses neutral dark styling, a white selected navigation pill,
dropdown pages and compact utilities. Search, page selection, compact density,
local appearance, notification acknowledgement and profile navigation work with
local sample state. Narrow containers use two rows with scrollable page navigation.
This concept does not replace approved application headers or alter app themes.

### Slim tabbed sidebar review variant — 2026-10-15

`TabbedSidebar variant="slim"` is an opt-in 216px side-column container with
equal-width icon cells spanning its tray. Only top/bottom placement and anchoring
are supported; legacy side-edge inputs normalize to top. Collapsing keeps the tray
at the same width and anchor. Accessible labels, arrow navigation and touch-size
preferences remain available. The detached reference specimen appears beside the
existing attached/detached designs under Overlays → Sidebars, with compact widget
contents and a Top/Bottom selector. This is a review variant, not an app adoption.

### Wheel Studio concept (2026-10-15)

Apps → **Aether Wheel Studio** (`?demo=wheel-studio`) composes the existing
DocumentBar, Rail/RailButton, DockPanel, Ribbon, TreePanel, Inspector, fields,
DocumentTabs and ViewportNavigationCube in the standard three-column arrangement.
The left and right panels fill the body height and align with the center toolbar;
the header/footer span all columns. Narrow windows use explicit panel toggles.

Widgets → **Wheel studio controls** presents the feature browser, revolved-profile
fields, part properties and material controls independently. Launch links stay on
Apps. The concept uses shared graphite tool artwork and borderless resting icons.

The live Three.js wheel has editable tread diameter, width, axle bore, flange and
edge radius. Part and wheelset assembly views share parameters. Material/color,
opacity, lighting, edge/grid display, open cutaway, bounds, orbit/pan/zoom, picking
and PNG export are functional. Notes and edits are session-only. This is procedural
render geometry, not exact CAD evaluation or a production document format.

## Lists and trees review — Jonathan, 2026-10-16

Widgets → Lists & trees is one comparison page with all flat list/collection and
hierarchical tree specimens. Use one sidebar entry; keep both existing section
IDs as in-page destinations so saved links and focused collection members remain
valid. Reuse the grouped-review configuration; do not duplicate the specimens.


## Model Studio reusable presentation — 2026-10-16

`TransformFields` is an unframed XYZ editor with caller-owned units, limits, commit
and optional lock callbacks. `SurfacePresetPicker` is an unframed swatch selector.
Model Studio uses these public widgets; neither owns geometry, transactions,
persistence or a panel frame. `bindViewportPointerActions` exports the existing
click/drag/context-menu arbitration for canvas hosts.

`modelStudioEnvironment` and `modelStudioSurfaces` are exported from
`@aether/ui/model-studio-presets` and the UI index. Their canonical data is in
`@aether/assets/themes/rendering/model-studio`. Model Studio interface and viewport
themes appear in the normal theme catalogs. The demo renderer and artwork consume
that same recipe. Scifirobot's canonical mesh generator, seven-part GLB and provenance
live in `core/assets/models/scifirobot/`. Widgets → Model studio controls includes
a GLB download. `@aether/ui/model-studio-assets` is an explicit browser asset entry;
it is excluded from the UI root so ordinary UI imports do not eagerly import the
model or require asset URL handling. Like other asset URL entries, exclude this
optional entry from dependency prebundling when a consumer uses Vite.

CAD adds Model Studio to Environment and Lighting and all six finishes to its
existing material browser. Custom environment capture/save/reload retains the
recipe. CAD uses its own reflection map/ground renderer; camera/fog metadata is
preserved in the shared recipe, not forced onto CAD navigation. Its validated
transforms, topology measurements, sections, file operations, agent access and
Studio history remain the product implementations. Demo mesh history, sample chat
and local comments are not substitutes for them. CAD keeps UI alpha.88 compatibility;
its `@aether/model-studio-assets` dependency is an alias to the same assets alpha.24
archive. This is not a new shared package or a sibling source import.

Qualification and the feature-by-feature adoption audit:
`.verification/model-studio-adoption-2026-10-16/`.
## Model Studio position readout — 2026-10-17

The CAD demo's optional XYZ readout belongs beside the center modeling tray, in
its spare left gap. It shows the selected part's live position and units without
another container. Actual available width and readout width determine visibility;
it disappears when the window, auxiliary sidebar or longer coordinate values
leave insufficient room. It never shifts or overlaps the modeling/auxiliary tools.
The document sidebar uses the released space. Exact editable values remain in
the existing Properties inspector. Other demo layouts are unchanged.


## Model Studio native feature sample — 2026-10-17

The standalone Model Studio demo now uses the public `FeatureTree` itself. Its
upper collection contains Default geometry plus120 authored sketch/revolve/extrude/
pocket/fillet/chamfer operations; its lower collection contains39 individual solids.
The generated presentation assets come from Aether CAD's native `.acpart` and
FreeCAD rebuild. Rollback selects one of66 verified intermediate native body tips.
Feature selection resolves to its output body; Parts visibility/rename and existing
preview transforms/materials retain the local study's undo/save behavior.

The File menu now sits next to the document name in the transparent header.
There is no Document header or duplicated scene list in the feature card. The
card defaults to216px (206px in the compact layout), matching the right inspector,
with the shared keyboard/pointer `PanelResizeHandle` and Home/double-click reset.

`modelStudioFeatureSample` in the existing `model-studio-assets` subpath exposes
native `.acpart` and STEP downloads; Icons & Assets/appearance specimens retain
the earlier GLB and offer the new native source. The original artwork is preserved.
The demo previews construction history, but does not evaluate CAD edits, suppression
or reordered dependencies. Those menu capabilities remain unavailable and editable
source belongs to Aether CAD. Preview placement/material edits are saved separately
from the authored CAD source; rollback is a preview, not a saved feature mutation.
