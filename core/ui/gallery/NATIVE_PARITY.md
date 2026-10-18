# Former Swift-based Anima Studio: UI verification

2026-09-30. Launch **Aether Animation Studio** (`?demo=animation-studio`).
The separate Animation Mockup is a different reference app.

The native source was removed from the working tree on 2026-09-23. Its last
archived tree is available with `git show fb1cc1c3^:<path>`. This work deletes
nothing and does **not** certify full native UI or engine parity.

## Source-backed layout corrections

Reference paths below are relative to
`aether-animation/archive/swift-app/Sources/AnimaStudioUI/` in that tree:

- `AppShell/WorkspaceLayout.swift`: StudioVisibleZoneLayout reserves the
  toolbar/rail/open-panel footprints, a 22px gap, 10px docked inset, and 76px
  for a center switcher. Detached panel footprints also affect the visible zone.
- `AppShell/WorkspaceShell.swift`: StudioSidebarMotion combines directional
  movement and opacity, retaining the rail above the moving stack.
- `Workspaces/StudioCenterContentViews.swift`: framed content follows the live
  visible-zone insets with a 0.24-second transition.

The shared web WorkspaceShell now animates panels by default (`animatePanels={false}` opts out) and offers
`measureContentInsets` for framed content. The Anima port enables the measurements. It measures actual toolbar,
rails, stacks and detached panels using ResizeObserver, rather than assuming a
fixed ribbon height. Closing panels remain inert during a 240ms exit; preserved
editor hosts survive closing/reopening and rapid reversal. Reduced-motion users
skip the animation. Map, CAD and Animation inherit the same motion. Switching editors on a side
replaces the old editor immediately, avoiding a temporary two-panel stack.

Assets, rig tables, Animate, Show, standalone Nodes and Hardware follow the
measured frame; 2D and VR cards use the same surrounding spacing. Spatial
modeling keeps an overlay canvas. Standalone Nodes previously covered its own
graph tools with the ribbon and rails; it now has a bounded frame. The neutral
workspace backdrop is distinct from the white cards in the light theme.

## Verification in this pass

- 315 UI tests / 74 files pass; Map479 and CAD21 shell + 10 routing tests pass; typecheck and
  UI, Map, CAD and Animation production builds pass (existing bundle warnings).
- Local Chrome opens all nine product workspaces: Assets, 3D Modeling, Animate,
  2D, VR, Show, Nodes, Hardware and Design.
- Browser bounds confirm 22px toolbar clearance / at least 22px beside floating
  chrome, including both open panels; 10px top inset for docked frames.
- Floating/docked/canvas layouts, edge reveal, compact toolbar density,
  outer-edge panel setting, detach/restack, 1100px window and reduced-motion
  closure pass. Screenshots inspected for Assets, Nodes and light/dark sidebars.
- Existing tests exercise the separate 36-template UI Dev showcase, now in the
  main Aether UI library, and its distinct variant board. That inventory count
  is not a pixel-parity assertion for every specimen.

Artifacts: `/tmp/anima-browser.log`, `/tmp/anima-{assets,modeling,animate,canvas2d,
vr,show,nodes,hardware,design,docked,both-panels,dark-panels}.png`.

## Remaining parity limits

The demo is a local concept, not the full native application. Imported CAD is
represented by sample geometry; native engine evaluation, hardware services,
desktop file-location actions and renderer-specific effects are not reproduced
by this demo. Some settings retain device-local values without a matching
renderer effect. Commands without web/native action bindings are explicitly
unavailable. Some UI Dev labs remain abbreviated and still require individual
state-by-state comparison against the native implementation.

Therefore the correct verdict is **reported sidebar-motion and framed-layout
gaps fixed; exhaustive 1:1 migration remains unverified**. Retain the git reference
and the broader inventory in `dev/docs/reality/Animation_Studio_Web_Migration.md`.


## UI-only migration and separate production adoption — 2026-09-30

Jonathan clarified that this launchable demo preserves the UI, pages and local
interactions. A live backend is intentionally outside its scope. Backend absence
is therefore not a failed UI migration gate. Native-planned/disabled actions stay
disabled; the demo never presents simulated hardware as connected.

### Source-to-web additions

Source paths are relative to archived `Sources/AnimaStudioUI/`; the relevant
files were read from `fb1cc1c3^`, not reconstructed only from screenshots.

| Native source surface | Web implementation in this pass | Scope |
|---|---|---|
| `ViewportSidebarPanel.swift` | `StudioViewPanel`, `StudioModelPreview` | Camera projection/FOV, named/previous views, frame selection, edge styles, grid, clip plane and navigation controls. Camera snapshots survive workspace switching. |
| `ViewportEnvironmentSettingsView.swift`, `ViewportVisualizationPanel.swift`, `CADAppearancePanel.swift` | `StudioEnvironmentPanel`, shared `MaterialBrowser` | Eleven native materials, five environments, distinct Material/Environment views, search/used materials and sample color/opacity/roughness/metallic/lighting/gradient/section preview. |
| Native viewport performance panel | `StudioPerformancePanel` | HUD switches and honest disconnected engine/hardware state. |
| `HardwareWorkspaceView.swift` | `StudioHardwareWorkspace` | Driver Connection, Safety, Output Mapping cards, editable normalized mapping table, endpoint reversal, remove confirmation and Driver Log empty state. Local fixtures only. |
| `RelationEditorView.swift`, `EngineRelationInspectorView.swift` | shared `RelationEditor`, `StudioRelationPreview` | Gear/rack/screw/linear forms, driver/driven choices, magnitude, reverse and offset. Demo acceptance remains local. |
| `DesignSandboxWorkspace.swift` | `StudioDesignWorkspace`, browser and inspector | Documents/Features/Bodies/Mates sidebar choices; feature name/material/appearance/opacity/visibility/rotation/delete. Native placeholder geometry is preserved as placeholder cards. |
| Native collection sidebars | `StudioCollectionPanel` | Local assemblies/scripts/animation collections with create, select, rename and delete; script and clip drafts are stored per item. |
| `UIDevProductionChromeSpecimens.swift`, `UIDevIconThemeSelectorView.swift` | central `UIDevSpecimens` and `UIDevWorkspace` | Actual ribbon controls, live layout/style preview, degree/radian conversion, icon pin/customization and distinct theme token colors; material library uses the same complete panel. |

`LayoutStyleControls` and `RelationEditor` are reusable `@aether/ui` exports.
The material/environment browser is also shared. Product-specific source catalogs
and demonstration fixtures stay in the gallery. The central showcase retains its
36 native templates and separate 26 state variants.

Browser review also found and fixed shared shell issues: viewport children now
stay inside their center stacking context, and long stacked floating inspectors
scroll internally without clipping their headings or drawing over neighbors.
The demo's camera HUD follows the measured panel clearance. These extend the
shared panel motion and measured frame work documented above.

### Production adoption (separate from the demo)

`aether-animation/web` now exposes the canonical engine's relation schema,
create/update/remove RPCs, Relations tree and inspector, and the shared editor.
Display-only conversion mirrors the native draft: degrees ↔ radians,
mm ↔ meters, mm/revolution ↔ meters/radian. Existing display metadata and
suppression survive edits. The Python engine retains dependency validation,
evaluation and serialization; no Swift evaluator was copied into TypeScript.
Existing rig, mate, timeline, scene and output semantics already reside in
`aether_animation/`. This pass fills the missing relation authoring front end,
not a second backend or a hardware service inside the demo.

### Verified

- Final shared-checkout UI run: **324 tests / 76 files pass** (includes another
  contributor's three motion tests); UI typecheck passes.
- **214 existing Python bridge/rig tests** and **3 new display-conversion tests**
  pass. UI, Animation, Map and CAD production builds pass, with existing bundle
  size warnings.
- Chrome: all nine workspaces, 22px floating frame clearance, docked/canvas
  layouts, compact ribbon, panel detach/restack and reduced motion pass.
- Chrome: mapping add/reverse/edit, relation preview, orthographic/FOV state,
  named-view save/restore, material/environment changes and Design properties
  surviving workspace switching pass. Light/dark and 1000px screenshots reviewed.
- Production Chrome against an isolated real Python bridge: create, reverse,
  edit offset, **save/reload**, select and remove a relation pass. Captured RPCs
  confirm signed ratio and SI offset. A separate attempt on the original animated
  fixture correctly showed the engine's driven-track conflict in the editor.
  The success fixture removed clips only in a temporary copy; no user document
  or repository example was changed.

Evidence: `/tmp/migration-{browser,product-browser,ui-tests,typecheck,engine-tests}.log`,
`/tmp/migration-{hardware-light,hardware-dark,hardware-narrow,camera,material,design,
relation,product-relations}.png`, and `/tmp/anima-browser.log`.

### Limits of this verification

This is a source-backed migration of the listed surfaces and a browser check of
all workspace routes. It is not exhaustive pixel/state parity certification for
every native lab. Native desktop file-location actions and renderer-specific
settings still have local or unavailable counterparts. Some renderer controls
retain preferences without reproducing the corresponding native rendering effect.
Keep the archived git reference and this inventory; no legacy source was deleted
in this pass.
