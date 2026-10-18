# PDM revision tree standard

2026-10-13 — development gallery and shared presentation component.

The supplied branch/version reference belongs to **PDM**, alongside document
history and collaboration. Find it in Widgets → PDM → Revision trees + branches,
or Collections → PDM. Studio & Drive references the same specimens. The gallery
URL is `http://127.0.0.1:5198/#tab=widgets&section=showcase-revision-trees-branches&collection=pdm`.

## Presentation

`core/ui/src/DocumentRevisionTree.tsx` supplies compact branch pills, draft status,
a version toolbar, fine curved ancestry connectors, milestone labels, release
status and a distinct current-branch indicator. Selection and current branch are
independent. The reference's monospaced labels, outlined pills, subtle row selection
and restrained spacing are retained. Shared theme tokens drive surfaces and
contrast; the showcase uses a local red accent matching the reference. Narrow
containers wrap controls and scroll the graph horizontally.

The component consumes existing `DocumentHistory` and `documentHistoryGraph`,
using real snapshot parent links through omitted autosaves. Versions and saved
branch heads are distinct. Creation markers covered by a named version are hidden.
Branch keys remain separate from display names. Snapshot revision IDs are not
user-visible version numbers. Shared artwork uses AetherIcon.

## Interaction example

The local gallery fixture provides:

- Independent draft notes on main, lightweight and hotfix; switching keeps edits.
- Save advances only the current branch's saved snapshot. It creates no version.
- Create version captures the current draft, including pending edits, under an
  explicit validated name and description.
- Branch creates a branch from the selected **saved** snapshot. Other drafts stay.
- Take over confirms replacing the current draft with selected saved content.
  This is a draft copy in the example, not a branch merge or an ownership transfer.
- Release marks a selected unreleased version; captured content is unchanged.
- Snapshot inspection, duplicate-name validation, disabled action states and a
  confirmed reset. Changes last only while this showcase remains mounted.

## Ownership and adoption

Exported `DocumentRevisionTree` is controlled presentation, with optional actions
and host-provided draft state. Missing callbacks, read-only history and busy
operations disable mutations. Host adapters must enforce permissions, validate
release transitions, flush product editors, guard revisions, persist changes and
surface errors. Callback visibility is not authorization. The gallery helper
`pdm-revision-example.ts` is disposable fixture behavior, not a second PDM service.

Studio continues to own PDM and Drive semantics. This change does not adopt the
new tree into live products, change native endpoints, publish a package, modify
installed assets/pins, or restart the installed server. Existing connected
DocumentVersionPanel behavior is unchanged.

## Verification

Nine new tests cover branch-local saves, immutable snapshots, named-version
capture, stable branch identity, selected-snapshot branching, release eligibility,
actual ancestry, host action guards, PDM membership and interactive controls.
Browser walkthrough covers draft switching, Save, version capture/release,
duplicate names, branching, Take over, reset and light/dark appearance.

Full UI suite: 588 tests across 124 files; typecheck, gallery and library builds
pass. A 472px content panel contains the graph scroll and stacks the editor and
snapshot inspector without outer overflow. Existing gallery chunk-size and
unrelated test act warnings remain.
