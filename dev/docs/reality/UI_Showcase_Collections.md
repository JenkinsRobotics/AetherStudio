# Aether UI showcase collections

Implemented 2026-10-13 at Jonathan's request. This supersedes the earlier
continuous gallery page: the left tray organizes the catalog and the content
area mounts one selected section. Existing specimens keep their components,
functionality, captions and canonical section ownership.

## Navigation standard

The existing WorkspaceShell supplies five left rail entries and separators:

- **Categories**: the current top-level catalog, with searchable categories and
  one expanded category at a time. Search expands matching categories.
- **Collections**: focused reference sets, including PDM, Flow & signals and Workspace
  patterns, separated from saved personal collections.
- **App collections**: CAD, Animation, Map, IO and Studio/Drive component sets.
  These include shared specimens relevant to the application; membership does
  not imply an exclusive app implementation or completed product capability.
- **Theme collections**: each registered interface theme, with the same controls
  available in a locally scoped Light/Dark preview. Browsing these collections
  does not write a global appearance preference.
- **Concept apps**: retained standalone demo links, opening in separate tabs,
  including the native UI Dev browser.

The six top tabs remain the canonical broad catalog. Choosing a top tab returns
to Categories and its most recently visited section during the session. A page
header shows the current collection/category, title, description and Previous/
Next controls restricted to that collection's membership. Section changes reset
content scroll to the top. There is no concatenated all-widget page.

URLs include tab, stable section ID, optional collection ID and preview mode.
Reload and back/forward restore the selection; invalid or stale destinations
fall back to an available section. Existing layout hash parameters are preserved.

## Personal collections

Choose **New collection** in a tray or **Save as collection** on the page. Name
it, choose Collections/App collections/Theme collections, optionally select a
preview theme, and check existing sections across the catalog. Membership search
retains selections outside the current search. Saving requires a unique nonempty
name and at least one section. **Edit collection** changes name/group/theme or
membership. **Remove collection** removes only the saved grouping; **Undo
collection removal** restores it. Built-in collections remain in the registry.

Personal collections save under `aether-ui-showcase-collections-v1` in this
browser, independently of the flow-diagram draft. Up to 50 collections are
supported; import of the saved browser value validates IDs, labels, kinds, theme
references and section membership. Storage failure reports session-only changes
while leaving the catalog usable. This is browser-local organization, not account
or server synchronization.

## Extending the catalog

`gallery/showcase.ts` owns section titles, stable derived IDs and categories.
`gallery/showcase/collections.ts` holds built-in memberships and derives theme
collections from the existing theme registry. Collections reference section
titles rather than copying JSX. Add a new section once to the catalog and gallery;
it becomes available in the personal collection editor automatically.

`ShowcaseBrowser.tsx` owns navigation/history and collection persistence;
`ShowcaseCollections.tsx` owns collection browsing/editing; `ShowcaseLayout.tsx`
owns category browsing and focused section mounting. Product document meaning
and persistent editor state stay with the individual specimen/owning app.

## Verification and delivery

Focused checks cover canonical inventory and collection references, scoped
section rendering, category search/disclosure, personal create/edit/remove/undo,
saved membership/remount, cross-tab navigation, history restoration, theme
isolation, invalid saved data and unavailable storage. Actual browser checks
verify personal creation/reload/edit/remove/undo, app collection navigation,
single-section DOM, category search, restored deep links, two rail separators and
scoped Orange dark preview with unchanged root accent. All 579 tests across 123
files pass, including 20 focused catalog/collection/navigation checks. TypeScript,
production gallery and library/declaration builds pass. Existing gallery chunk-size
warning remains. Browser QA collections were removed after verification.

Delivered in the development gallery at 127.0.0.1:5198. Shared sidebar primitives
are reused. No installed generation or consumer package pin was changed.

PDM groups Revision trees + branches with Document history + collaboration.
Both also appear in Studio & Drive. See [UI_PDM_Revision_Tree.md](UI_PDM_Revision_Tree.md)
for the shared presentation standard and local interaction example.

Aether CAD includes the thumbnail document list and dimensioned sketch reference,
alongside feature editors and workspace controls. See
[UI_CAD_Document_List.md](UI_CAD_Document_List.md) and
[UI_Dimensioned_Sketch.md](UI_Dimensioned_Sketch.md).
