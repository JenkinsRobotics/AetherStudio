# Shared browser session

The host serves `account.js` and `account.css` at `/suite/` and includes them in hosted application HTML. Each front end provides a `data-aether-account` slot. One framework-neutral account control projects the signed-in host identity, profile picture and appearance preference into every application. It calls the canonical host APIs; it does not store passwords or duplicate account data in browser storage.

`account.js` and `account.css` are generated deployment assets. Edit
`account-source.js` and `account-layout.css`, then run `npm run build:bootstrap`.
The build embeds the immutable UI86 ApplicationStatusBar renderer and stylesheet;
React and the hosted bootstrap use the same presentation. The host serves these
two complete assets and needs no additional module route or React runtime.

The adapter supplies confirmed connection state, product catalog name and the
configured Studio/company name (`/api/status.name`). A failed request or offline
event shows unavailable; successful refresh restores connected. UI owns the
indicator/product-left and company-right layout; session owns polling, account
behavior and reserving the footer's window space. Deploy the generated pair as
one qualified session snapshot, preserving the current application/worker paths.

Core UI tokens own the visual palette. Dark blue-grey remains the product default; light/system are per-user preferences. Product renderers retain control of 3D viewport appearance.

An explicit shared UI theme choice (`aether-theme` in browser storage) takes
precedence over the account theme, application override, workspace base, then
Aether default. Account refresh/focus must not overwrite that choice. The session
publishes the host fallback on `html[data-aether-host-theme]` and notifies the
shared theme controls when it changes, so displayed selection and rendered theme
agree even without a browser override. Theme choices follow storage changes across
tabs; light/dark/system and viewport themes remain separate preferences.

## Default document autosave

`autosave.ts` provides the browser save queue and refresh recovery used by Map,
CAD Parts/Assemblies, Animation, Sketch and IO. Autosave is always on in these
hosted editors. Vector remains a coming-soon application.

Products keep ownership of document formats, validation, serialization and their
host APIs. The shared session accepts serialized text plus an opaque base revision;
it contains no CAD, animation or projection semantics. New document editors should
connect their existing serializer and revision-checked save API to this session.

- Call `write` whenever the document changes. It immediately records the pending
  snapshot in `sessionStorage`, then schedules a server write after 1.2 seconds.
  Repeated edits do not postpone that write indefinitely.
- Each session allows one server write at a time. An older response cannot clear
  a newer edit. The next snapshot retains the returned revision as its save base.
- Recovery keys include the application, authenticated account and document.
  CAD also scopes them by project item, branch and historical revision. Untitled
  documents retain a draft ID in the URL until the host assigns a document ID.
- On reopening, products load the current document and compare it with the local
  recovery record. Changed server revisions block automatic overwrite. Map offers
  **Save a copy** for conflicts and read-only documents.
- Network failures retain the snapshot and retry. Permission, missing-document,
  validation and revision failures stop automatic retries. UI subscribes to the
  actual saved/saving/local/error state rather than treating an attempted write as
  a successful save.
- Map property previews are captured locally while their server save is paused;
  Accept resumes saving and Discard records the restored document. CAD Assembly
  capture first obtains its canonical archive from the product engine; navigation
  protection remains active while that asynchronous capture is incomplete.

Recovery is scoped to the browser tab and survives refresh. It is not a durable
backup after the tab is closed or browser storage is cleared; completed host saves
are the durable copy. If storage is unavailable or full, the browser's navigation
confirmation remains active until the pending edit reaches the server. Unsubmitted
tool-dialog input and operations the engine has not accepted are not saved documents.

The queue's deterministic tests run in `aether-map/src/autosave.test.ts`. Product
integration coverage is in CAD's `src/host-library.test.ts` and Map's
`e2e/{autosave,suite-autosave}.spec.ts`, using an isolated host and disposable users.

## Shared workspace agents

`agent.ts` is the account-authenticated `/api/agent/*` transport, consumed by the
shared `WorkspaceAgent` widget. Providers are installed/enabled in Studio Plugins;
personal account connections are stored by the host. The account menu opens the
same right-side agent drawer in every hosted app. Map adds its scene/mask SVG
context through its own adapter. No product engine is imported by this transport.
See `core/host/agents/README.md` for capabilities, sign-in limitations and tests.

## Shared document services

Run `npm ci --prefix core/session` before product builds (the installer and CI do
this). React adapters use the products' deduplicated React runtime.

`documents.ts` is the authenticated same-origin library transport. Its errors
extend `SaveError`, so conflict and permission failures block autosave retries.
`useHostedDocument` supplies identity-safe text-document saves and branch/account
scoped recovery; the owning product validates the loaded text. Switching files
never feeds the new snapshot to the previous document's queue.
`useDocumentConnection` binds an editor's identity, flush, copy and reload to the
transport-free panels in `@aether/ui`. Restoring or merging reloads the editor;
creating a named version first flushes pending work. Product formats stay in the
products; collaboration and immutable revisions stay in the host database.

The shared panels provide versions, branches, compare, restore, explicit whole-file
merge resolution, threaded comments, notes, assigned tasks and dated reminders.
Collaboration has a separate optimistic revision and append-only edit journal.
Only owners change file content/history or notes; workspace members may comment,
create tasks/reminders, edit their own items and update assigned-item status.
Private files and their discussions remain private. Restore changes document bytes,
not discussions, tasks or their audit history. Copy creates independent history;
comments and tasks remain with their original document.

Reminders are in-app due-date records; email/push delivery is not implemented.
Merge keeps both revision parents and asks which complete document to retain when
both branches changed; it does not merge arbitrary CAD/animation semantics.

### Drive destinations

`drive-destination.ts` projects the `driveOrganization`, `driveWorkspace` and
`driveParent` creation URL parameters into the first hosted create request. Once
`document` exists, that identity wins and the creation hints are ignored. Shared
`useDocumentConnection.openLibrary` opens the same document in `/drive/`; it does
not copy the file or create a product-specific library. Authorization stays on
the Studio server.

## Hosted application catalog

`@aether/session/applications` owns the `/api/status` request and projects the
per-user catalog for application headers. Editors pass `useStudioApplications()`
to `DocumentBar.application.apps`. Disabled applications are omitted; unbuilt
applications remain non-launchable. Errors leave the suite-home escape link
available without inventing an app catalog. The shared UI never fetches a catalog.

Run `npm test` and `npm run typecheck` here. The session package now has its own
CI matrix entry; its source exports and remaining UI type dependency still need
the independent-package publishing work in the repository split brief.

An account slot can opt into bottom-sidebar presentation with
`data-aether-account-layout="sidebar"`. The runtime displays the signed-in name
and email beside the avatar, followed by settings, and opens menus upward.
Inside a collapsed `aui-sidebar`, labels hide and the controls stack vertically.
Ordinary account slots retain their header presentation and behavior.


### Live document invalidation

`useDocumentConnection` exposes optional `subscribeChanges` for shared panels.
The internal `document-changes.ts` transport negotiates
`capabilities.document_changes === 1`, then opens same-origin SSE for that app and
document. Multiple panels share the stream; the final unsubscribe closes it.
Unknown/legacy hosts retain polling. Payloads are validated before notification;
wrong-document or malformed state closes the connection. Reconnect sends a fresh
invalidation even when the saved token is unchanged. Retry delay grows from one
to thirty seconds, with an immediate retry on browser online. Offline and account
replacement close the old stream; cleanup aborts requests and removes listeners.

Shared panels refresh authorized history/discussion data only. They keep draft
text, original edit guards and pending-write receipts. Unavailability clears
server-derived panel state and blocks actions while keeping notes drafts visible;
late reads from before the disconnect cannot restore that state. Reconnect never
calls product flush or reload. Mounted drafts are not a durable cross-navigation
outbox. See `crates/server/CHANGE_STREAM.md` for the server contract.

## External live editors

`LiveEditorAccess` is an opt-in hosted transport control around the app's existing
`AgentInteraction`. Products pass their actual hosted document ID and current
interaction; no modeling logic lives here. It registers only while explicitly
shared, validates context changes, polls authorization during async tools, and
never calls `execute` twice to repair a lost receipt. Requires Studio access
schema22. CAD and Map use versioned session147/148 archives, respectively, retaining
their existing UI peer versions. Shared JSX explicitly imports React so dependency
compilation works with both product bundlers.
