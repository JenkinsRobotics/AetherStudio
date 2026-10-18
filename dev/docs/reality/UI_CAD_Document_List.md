# CAD document list standard

2026-10-13 — Aether UI development gallery and reusable DocumentList.

The supplied thumbnail list reference is filed under Widgets → Aether CAD → CAD
document list and App collections → Aether CAD. Its deep link is
`http://127.0.0.1:5198/#tab=widgets&section=showcase-cad-document-list&collection=app-cad`.

## Presentation and spacing

The list uses 40px model thumbnails, part numbers above document names, monospaced
text and distinct version, revision, draft and branch labels. Revision letters are
host-supplied display metadata; their fill does not invent a release policy.

Every row has a 58px stride and identical 9px thumbnail insets. Transparent 3px top
and bottom borders leave a 6px visible gap between selection/hover surfaces without
changing row geometry or virtualization. Hover retains the same clipping. Fixed
32px version and 34px revision/status columns align draft and revision-bearing
rows; branch labels span a dedicated 140px metadata area. This addresses Jonathan's
spacing feedback: previously selected surfaces touched and draft labels shifted
their version badges 10px left. Browser measurements confirm equal 58px rows and
identical version-column positions.

## Functional example

The showcase includes 14 illustrated parts and assemblies. Search matches all
entered terms across names, part numbers, versions, revision letters and branch
labels. Filters show Parts, Assemblies or Drafts; sorting supports library order,
name, part number and numeric-aware versions in either direction.

Shared list behavior supplies single, range and modifier-key selection, arrow-key
navigation, activation and windowing for long lists. `/` focuses search while the
list is focused; ArrowDown returns from search to the focused row. Text entry is
not intercepted. Search/filter changes preserve selection, with hidden-selection
counts and an explicit Clear command.

Selection shows a larger thumbnail and metadata inspector. Double-click, Enter on
a selected row, the inspector or the context menu opens details. Name, unique part
number, material and notes can be edited locally. Cancel leaves data unchanged;
Save updates the row, inspector and search immediately. Version/revision labels
remain unchanged. A confirmed reset restores the fixture. Changes last only while
the showcase is mounted.

## Shared boundaries

`core/ui/src/DocumentList.tsx` is controlled presentation and filtering. It reuses
`ListBoxRows` for selection, keyboard behavior, disabled rows and virtualization.
ListBox adds only a noninteractive accessory slot and exports its existing row
primitive for this specialized presentation. Hosts supply thumbnails, metadata,
selection, query and open/context callbacks; optional toolbar, loading/error and
empty states are supported. No product engine or server transport is imported.

The CAD-specific fixture and metadata editor live in the gallery. Fourteen
original SVG thumbnails and their reproducible generator live under
`core/assets/showcase/cad-documents/`. These are illustrative artwork, not editable
CAD geometry. Production CAD supplies actual document thumbnails and validated
commands; Studio retains PDM, permissions and durable revisions.

## Verification and adoption

Ten new tests cover metadata search, selection/ranges/toggles, keyboard shortcuts,
disabled rows, loading/errors, 500-item windowing, filtering/sorting, duplicate part
numbers, local editing/cancel/reset and hidden selection. All 598 UI tests across
125 files, typecheck and gallery/library builds pass. Browser verifies search,
editing, sort/filter, range/toggle, context menu, keyboard shortcuts, light/dark,
and a 472px content panel without outer overflow. Spacing correction is verified
by actual row and badge measurements and adjacent selected-row screenshots.

Development gallery only. No production adoption, package version bump, installed
asset/pin change, native server restart or live document mutation.
