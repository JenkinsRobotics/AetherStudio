# Aether UI adoption audit — 2026-09-30

Jonathan requires shared UI standards to be inherited by default, including Map,
CAD, Animation, Sketch and the Studio host. Common presentation belongs in
`core/ui`; products supply their commands, documents, domain data and workspace
content. This does not move product engines or sketch semantics into the UI.

## Defaults now supplied by the library

| Standard | Shared implementation | Adoption |
|---|---|---|
| Safe content area | WorkspaceShell, WorkspaceShellMotion, WorkspaceSafeArea | Always measured; 10px margin / 22px floating clearance by default; settings persist across apps. Zero extra padding still reserves the chrome footprint. |
| Panel lifecycle | WorkspaceShell | Entrance/exit motion and reduced-motion behavior; content retention is now the default, preserving local drafts through hide/dock/float. |
| Toolbar appearance | WorkspaceRibbon | Glass, workspace column, expanded density and the shared 10px scale by default. Explicit panel/strip/density variants remain supported. |
| Toolbar placement | WorkspaceLayoutContext + WorkspaceShell | Ribbon follows host docking automatically. Automatic frame recognition avoids a second frame around WorkspaceRibbon or kit ToolSidebar; simple toolbar rows retain the shell frame. |
| Floating sidebar clearance | WorkspaceSafeArea | Side stacks use the region below the measured toolbar; tall inspectors scroll without covering commands. Also applies to Canvas reveals. |
| Common settings | SettingsWindow + ThemeMenu | Suite Appearance & icons and Workspace spacing sections are present by default; app-specific settings can be added. |
| Theme and icons | shared theme hooks + ToolIconTheme | Browser-local preferences sync between open products; explicit gallery icon specimens remain scoped. |
| Status strip | StatusBar | Shared regions, theme and Workspace status live region; Sketch now consumes it. |

Sketch previously positioned its ribbon outside WorkspaceShell and painted its
own status footer. It now uses the shell toolbar slot, shared defaults and
StatusBar. CAD receives automatic frame recognition without another product
flag. Map and Animation continue to use WorkspaceRibbon and WorkspaceShell.
Studio's library/administration pages use their own page composition, with shared
settings, theme and status components; they are not forced into a drawing shell.

## Remaining override inventory — not complete standardization

The existing `dev/check-shared-widget-overrides.mjs` reports **58 product rules**
in CAD and Studio. It scans CAD, Studio and Animation, but does **not** currently
scan Map or Sketch. It reports findings without failing a build. The count is a
heuristic: composition/sizing rules need review, not blind deletion.

The guard and major affected files remain covered by Claude's active
**Shared-widget override cleanup** / **Feature tree panel fixes** claims. A
request is recorded in the active briefing; these files were not overwritten.

| Area | Remaining work |
|---|---|
| CAD `react/shapr-shell.css` | Ribbon/tool/tab restyling, panel/field/table/button and status sizing, floating-panel/header styles. Automatic toolbar framing fixes the duplicate visible frame, but does not erase these rules. |
| CAD `sketch-workspace.css` | Feature-window shared-widget override. |
| Studio `library.css` | Sidebar labels, toggle and collapsed item rules. |
| Studio `setup.css`, `studio.css` | Button, sidebar and document-bar presentation overrides. |
| Map `map.css` | Segmented-control sizing, shader numeric-field/menu-trigger composition, SplitPane height/overflow, schedule button sizing; also stale `.map-stage .aui-shell-*` descendant rules where the shell is actually an ancestor. Review through shared component options before removing. |
| Map `panels/MapDocumentHeader.css` | DocumentBar leading/trailing sizing and small-screen chrome hiding. Promote any common responsive behavior to DocumentBar. |
| Sketch | No `.aui-*` CSS overrides found; old private toolbar wrapper/status-footer rules removed. Canvas, vector inspector content and drawing styles are product-owned. |

Next cleanup should add Map/Sketch to the existing guard, separate legitimate
composition from control restyling, promote required component options and
remove the corresponding product overrides under their current owner. A zero-
override claim is **not** supported by this audit.

## Verification

- UI: **341 tests / 78 files**, typecheck, production build; focused shell/ribbon
  checks **32 passed**. Sketch: **12 unit tests / 4 files**.
- All six builds pass: UI gallery, Map, CAD, Animation, Sketch and Studio.
- Production Chrome run **8955: 8 passed**. Tests cover shared settings/defaults,
  reload and cross-window updates, Map sidebar placement, safe areas across all
  shell modes and products, twelve Map/gallery ribbon comparisons, automatic CAD
  frame recognition, and Sketch toolbar/side-panel clearance. CAD and Sketch
  screenshots reviewed; the initial tall-Sketch-inspector overlap was fixed in
  shared CSS and the corrected image rechecked.
- Sketch Chrome: **15 passed**, covering paint, Bezier handles, trim, undo,
  layers/groups, text, SVG import/export and account-isolated recovery. Pointer
  helpers now wait for shared shell/sibling panel animations to settle before
  reading SVG coordinates; geometry assertions were not loosened. Status checks
  use the shared accessible status region instead of the removed private footer.
- Theme-literal/motion guard and `git diff --check` pass. The shared-widget
  override guard still reports the **58 findings** described above.

Logs: `/tmp/adoption-*.log`. Browser evidence:
`aether-map/test-results/8955/` and `/tmp/aether-sketch-browser-results/`.
No backend, document format, geometry or feature semantics changed in this pass.
