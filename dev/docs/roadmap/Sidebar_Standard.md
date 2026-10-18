# Workspace shell standard — three sidebars + Studio modes

Reference implementation (working, in the demo app — read these before coding):

- `dev/AnimaStudio Demo/Sources/AnimationStudioDemo/WorkspaceShell.swift`
  — `WorkspaceScaffold`, `ToolSidebar`, `ToolDensity`, `ToolGroup`,
  `ToolCategory`, `PromptBar`.
- `dev/AnimaStudio Demo/Sources/AnimationStudioDemo/Sidebars.swift`
  — `WorkspaceSidebar`, `SidebarRail`, `SidebarTab`, `ViewSidebar`, `ViewPanel`,
  `ViewRail`, `ViewSidebarState`, `SidebarChrome`.
- `dev/AnimaStudio Demo/Sources/AnimationStudioDemo/Layout.swift`
  — `LayoutState`, `LayoutPreset` (`floating`/`docked`/`canvas`),
  `apply(_:)`, `detectedPreset`.
- `dev/AnimaStudio Demo/Sources/AnimationStudioDemo/Workspaces/DesignWorkspace.swift`
  — the canonical adoption. Copy this shape.

---

## The model: one center, three sidebars, each with exactly one job

Every workspace is a full-bleed **center** (the viewport / graph / timeline) with
three sidebars floating over or docked around it. The whole point is a strict
separation so a control's *location* tells you what it acts on:

| Sidebar | Position | Acts on | Holds |
|---|---|---|---|
| **Tool sidebar** | top, centered | the **objects/model** | tools that create or modify (Extrude, Sketch, Mate, Key…). Arms one tool at a time. |
| **Workspace sidebar** | left | **what you're working on** | a rail of tabs → a browser panel (Documents, Features, Bodies, Mates, Parts…). |
| **View sidebar** | right | **how it's presented** | a rail of tabs → View · Environment · Appearance · Inspector. Never mutates the model. |

Hard rule: **the right sidebar and the tool sidebar are mutually exclusive
domains.** "Move the camera" lives on the right; "move the object" is a tool on
top. Arming a tool cancels a camera nav mode and vice-versa. This is the single
most important invariant — users constantly confuse camera-move with
object-move, and the layout is what prevents it.

---

## Studio modes (the "Studio layout" button cycles these)

One control cycles `floating → docked → canvas → floating`. It drives a shared
`LayoutState`; every workspace reads it and renders accordingly. `LayoutState`
must be app-global so the mode persists across workspace switches.

### 1. Floating (default)
- Center spans the full window.
- All three sidebars **float over** the canvas as translucent, rounded, shadowed
  pills/cards (material background, hairline stroke).
- Side sidebars are **vertically centered** on their edge (not pinned to the top).
- Tool sidebar centered along the top; view cube top-right.

### 2. Docked
- Sidebars become **flat, full-height panels in-flow**, meeting their neighbors
  edge-to-edge with divider lines (no shadows, no rounding). Classic IDE chrome.
- Layout is a `VStack { toolbar; HStack { leftPanel | center | rightPanel } }`.
- The tool sidebar is forced to its **Expanded** density here regardless of the
  user's floating-mode density preference (docked = the full ribbon).

### 3. Canvas
- Same floating *look*, but all three sidebars start **hidden**; the center gets
  the entire window.
- Each hidden sidebar is reachable by a **thin edge hot-zone** (~16pt). Hovering
  the zone slides the sidebar in; moving the pointer off it slides it away.
- While hidden, a **plain capsule "grab handle"** (no icon, ~34×4pt) hugs the
  edge to mark the hover target. It fades out when the sidebar is revealed.
- The reveal must keep the sidebar shown while the pointer is over *either* the
  hot-zone or the revealed sidebar itself (track hover on both), or it flickers.

Implementation notes:
- One chrome modifier (`SidebarChrome(docked:)`) carries both the floating-pill
  and the flat-docked looks, so every sidebar renders correctly in all 3 modes
  from one code path.
- `LayoutState` should expose `apply(preset)`, `detectedPreset`, and a
  `cyclePreset()`. `canvas` = both sides hidden + ribbon floating; `docked` =
  everything docked; `floating` = everything floating.

---

## Rail interaction (both side sidebars, identical)

A sidebar = a vertical **rail** of icon tabs + a **panel** whose content follows
the selected tab. One rule, shared by left and right:

- Click a **different** tab → switch to it and open the panel.
- Click the **active** tab → collapse the panel (rail stays).
(Notion/Xcode idiom.)

Panel header shows the tab name + optional search/filter affordances. Content is
supplied per tab by the workspace.

---

## Tool sidebar densities

Tool count per workspace can grow a lot, so density is a user lever (a `···`
settings menu on the sidebar, plus overflow tools):

- **Compact** — icons only.
- **Standard** — icon + label (default).
- **Expanded** — grouped with headings; if the workspace supplies **categories**,
  this becomes a Fusion-style ribbon (see below).

Model the catalog as `[ToolGroup]` (a named run of tools) and, optionally,
`[ToolCategory]` (a named group-of-groups). A workspace with many tools (e.g.
Design) supplies categories; a small one supplies flat groups.

### Expanded category ribbon (Fusion layout)
- A **thin** top strip of category tabs (DESIGN · SKETCH · SURFACE · MESH · SHEET
  METAL · ASSEMBLE …). Active tab = small accent pill; the strip must stay
  minimal-height — it is a label strip, not a second toolbar.
- **No divider line** between the tab strip and the tools.
- Below it, one continuous tool row; within it each group's tools sit together
  with the **group name captioned underneath** (CREATE, MODIFY, CONSTRUCT…),
  separated by spacing, not vertical rules.
- Compact/Standard densities show only the **active category's** tools inline.
- Selected category persists in the shared tool settings.

---

## Tool lifecycle (shared `ToolState`, one armed tool app-wide)

`arm → prompt → commit → repeat / cancel`:
1. Tap a tool → it **arms** (highlights; a `PromptBar` appears under the toolbar:
   "<Tool> — click in the viewport. Esc to cancel").
2. Click the canvas → **commit**.
3. If "stay armed" (repeat) is on, it stays armed for another placement; else it
   disarms. **Esc** always disarms.
4. Selecting a camera/nav mode disarms the tool (exclusivity rule above).

`ToolState` is app-global so the toolbar, prompt bar, and viewport all agree.

---

## State ownership (do this or float/dock/canvas flips lose state)

- **Never** keep sidebar/tool state in view-local `@State`. Flipping modes swaps
  view branches and would reset it.
- Left-sidebar state (selected tab, panel open) → the workspace's existing
  `@Observable` model (one `sidebarTab: String`, `sidebarOpen: Bool` per model).
- Right-sidebar (presentation) state → a **single app-wide** `ViewSidebarState`
  (view preset, display mode, environment toggles, appearance, nav mode). This is
  why a wireframe view stays wireframe when you switch workspaces.
- Tool density + active category → shared tool-settings singleton.
- `LayoutState` (the mode) → app-global.

---

## Suggested component API (from the demo, adapt to the app's types)

```
WorkspaceScaffold(
  toolGroups:      [ToolGroup],          // or…
  toolCategories:  [ToolCategory],       // supply one; categories → ribbon
  toolOverflow:    [RibbonTool],
  toolArmGroup:    <group carrying tint/name for the prompt bar>,
  leftTabs:        [SidebarTab],
  leftSelection:   Binding<String>,      // model-backed
  leftOpen:        Binding<Bool>,        // model-backed
  showViewCube:    Bool = true           // false for graph/non-3D workspaces
) {
  center            // the viewport / graph / timeline ONLY
} left: { tab in
  <per-tab browser content>
} inspector: {
  <what the View sidebar's Inspector tab shows for this workspace>
}
```

The scaffold owns: the float/dock/canvas body, the top `ToolSidebar`, the
`PromptBar`, the canvas-mode edge reveal + handles, and the left `WorkspaceSidebar`
+ right `ViewSidebar`. A workspace supplies **only** its catalog + content — the
frame is identical everywhere, which is the goal: change the shell once, it
applies to every workspace.

---

## Acceptance checklist

- [ ] Studio button cycles floating → docked → canvas, persisted globally.
- [ ] Left & right rails: click-different-switches, click-active-collapses.
- [ ] Canvas mode: edge hot-zones + capsule handles reveal/hide each sidebar
      without flicker; center is full-bleed.
- [ ] Docked forces the tool sidebar to Expanded; floating respects the density
      preference.
- [ ] Expanded-with-categories renders the thin tab strip + captioned tool row,
      no divider between them.
- [ ] Arming a tool shows the prompt bar; Esc/commit/repeat behave; a camera nav
      mode disarms the tool.
- [ ] All sidebar/tool/mode state survives a float↔dock↔canvas flip (i.e. no
      view-local `@State`).
- [ ] Right sidebar never mutates the model; the tool sidebar is the only path
      that does.
```
