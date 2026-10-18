# Aether UI adoption — 2026-10-12

The suite uses Aether UI 0.2.0-alpha.57. Reusable visual standards live in
core/ui; app code supplies its data, permissions and available commands.

| Consumer | Shared presentation | Session variant | Verification |
| --- | --- | --- | --- |
| Drive | Shared list controls, sidebar, selection, menus | 85 | Build/tests/browser |
| Studio | Personal/admin sidebar and common product library | 86 | Build/tests/browser |
| CAD | Common hosted library; shared editor widgets | 86 | Build; home browser |
| Map | Common hosted library; shared editor widgets | 87 | Build; home browser |
| Animation | Common hosted library; shared editor widgets | 87 | Build; home browser |
| Sketch | Common hosted library; shared editor widgets | 87 | Build; disabled on current host |
| IO | Common hosted library plus local home | 87 | Build; hosted home browser |
| Vector | Available sidebar/carousel home shell | 87 | Build/browser; editor remains planned |

Run `npm run check:ui` from Studio to detect package adoption drift. An app's
own capability availability is not inferred from a successful UI upgrade.

Use ApplicationListHeading → location breadcrumbs → ApplicationListControls →
ApplicationFileTable/empty state. Omit page totals. Keep selection counts useful
for clearing selections. Shared table selection supports Shift/Cmd/Ctrl and
checkboxes; operations remain product-owned. The first columns are Name, Type,
date, Owner, followed by relevant additional metadata.

Use SidebarRow for main/workspace navigation, SidebarGroup for collapsible
groups, WorkspaceIcon for initials and ApplicationSidebar userLabel for account
context. Current blue/white styling survives hover; compact rows and icon
positions are shared between expanded/collapsed modes.

Use Menu/MenuButton for all custom popups, ListToolMenu for Sort/View, and
comfortable density only for Create pickers. Shared native text context behavior
preserves browser Copy/Paste. The old LibraryToolMenu entry forwards to UI.

No file-storage hierarchy or permissions were migrated. Accessible organization
workspaces are projected as folder entries; personal files remain private.
Native icon-metadata support/server activation is still separate outstanding work.


### Full-height home sidebars — 2026-10-12

Fixed the shared ApplicationHome frame's legacy status-tray compatibility: body
bottom padding is zero for home frames without a mounted Studio tray. This removes
the unused 27px strip below the sidebar while retaining spacing for an actual tray.
Aether UI58 adopted by all8 frontends. Session88/89/90 differ from85/86/87 only in
package metadata; existing runtime variants are preserved. Source session peer/dev
UI dependency and lock updated, no runtime changes.

Verification: all8 frontend builds and check:ui pass; shared UI516 tests/111 files,
typecheck and gallery build pass. Browser Drive sidebar bottom now720/720px in both
expanded and collapsed modes (previously693/720); Map720/720. No restart or cutover.
