# Aether Drive first-iteration quality review — 2026-10-12

## Verdict and scope

Drive implements the expected small-library directory foundation: browse personal
and workspace locations, breadcrumbs, create folders, upload/download, rename,
copy/move, selection, search/filter/sort, favorites and recycle/restore. It does not
need cloud providers or network-mounted storage to validate that first iteration.
It is suitable for continued internal use, but this review does not certify it as
fully hardened or scalable. The maintainability and reliability items below remain.

Reviewed Drive frontend, its versioned session API boundary, shared file table,
legacy listing/storage paths and native listing implementation. Ran the existing
legacy backend tests and Drive tests/build. Native PostgreSQL integration suites,
large-library benchmarks and provider integrations were not run in this review.
Existing native qualification evidence is not a substitute for a new capacity test.

## Findings, in priority order

1. **High — native listing has a capacity cliff.**
   `crates/server/src/documents/drive_listing.rs:25,135–138` scans up to2,048
   resources across the requested organization/authorized memberships before
   folder-level filtering; exceeding that returns Unsupported. This is not a
  2,048-files-per-folder limit. A small folder can become inaccessible as its
   organization grows. Add permission-aware server pagination, scope filters in
   SQL, a stable cursor and matching client incremental loading before broader
   deployment. Do not simply remove the bound. Legacy `core/host/drive.py:list`
   scans organization rows with repeated metadata/access queries; it needs its
   own capacity characterization while it remains served.

2. **High — batch recovery is not explicit.**
   `drive/src/DriveMove.tsx` sends copy/move one file at a time, calls onDone only
   after all succeed, and leaves the dialog open on an intermediate error. Earlier
   changes may have succeeded; a generic retry replays them. Copy can produce
   duplicates depending on the operation receipt behavior. Add per-item outcome
   tracking, stable retry identities and an explicit retry-failed-items action.
   Reconcile the listing after partial completion. Folder upload similarly creates
   directories before transfer, with only an in-memory path map for that batch;
   resumable single-file upload does not imply resumable directory upload.

3. **Medium — DriveHome remains a god component.**
   `drive/src/DriveHome.tsx` is1,304 lines and owns navigation, list requests,
   selection, upload orchestration, commands, dialogs and multiple render modes.
   Splitting the dialog bundle below improves boundaries but does not resolve this.
   Next refactor: useDriveListing (request lifecycle), useDriveNavigation (typed
   location), useDriveTransfers (batch state), useDriveCommands (explicit targets),
   DriveFileBrowser (table/gallery), DriveInspector and DriveSidebar composition.
   Keep file meaning/permissions on the server and presentation in Aether UI.
   Extract behavior with focused regression tests, not arbitrary line-count chunks.

4. **Medium — frontend integration coverage is thin.**
   17 frontend tests cover selection, uploads, listing aggregation and rendering
   helpers, but not the full navigation/request/mutation state machine. Add
   deterministic delayed-response tests, partial-batch failure/retry tests and a
   browser create→rename→move→download→trash→restore acceptance flow against isolated
   fixture data. The Move picker cancellation guard was inspected and the dialog
   browser-smoked here; a deliberately reordered network response was not simulated.

5. **Medium — large-list rendering and initial load need measurement.**
   The shared table renders all rows; there is no client paging/virtualization.
   Drive sorting is now memoized, but rows/icons and workspace lookups are rebuilt.
   Final production entry JS599.84kB (151.48kB gzip), CSS376.86kB (48.28kB gzip).
   Vite warns about the JS chunk. Consider lazy loading document/history/preview
   dialogs and auditing the shared asset catalog. Measure representative1k/10k
   directories before choosing virtualization; bundle bytes alone are not latency.

## Bounded fixes made during review

- Corrected single-file action targeting inside a multi-selection. Rename,
  details and document commands now select their clicked file; copy/move/recycle/
  restore retain bulk selection. Added regression tests. This prevents Rename
  opening one filename while the save handler targets the first selected file.
- Move/Copy destination reads now ignore stale replies and clear the previous
  folder/path/error when navigating. An old reply cannot overwrite the new location.
- Memoized file selection and sorted/filtered files so unrelated dialog/progress
  updates do not repeat the full filter/sort.
- Replaced574-line DriveDialogs implementation with focused DriveShare(220),
  DriveMove(158), DriveDocument(55), DrivePreview(142) modules and a compatibility
  export file. No product protocol, data migration or shared UI package changes.

## Verification

- Drive:17 tests in6 files pass; strict TypeScript and production build pass.
- Legacy Drive/library backend:43 tests pass, including permission inheritance,
  revocation, cycles, copy/move/recycle/restore and upload integrity/sync cases.
- Browser: two selected files→second row Rename shows second filename and leaves
  only that file selected; cancelled without writes. Extracted Move dialog opens
  and lists destinations; cancelled without mutation.
- No native runtime restart/cutover, remote publication or user-file mutations.

## First-iteration scope

Keep cloud storage, server-attached volumes, offline sync UI, real-time co-editing
and bulk workspace recovery on the roadmap. Storage providers should implement a
server-owned storage boundary beneath the existing identity/permission model;
Drive must not gain provider credentials or provider-specific permissions logic.
Before calling iteration one hardened: finish explicit batch recovery, reduce the
home controller's responsibilities, add end-to-end directory checks and establish
an enforced/tested supported library size (or implement pagination).
