# Native branch document API

Studio storage schema3 and access schema16. These native-cookie routes run against
PostgreSQL and the content store, with no Python forwarding. Browser capabilities
still report `branches:false`: stable-ID browser controls and validated legacy branch import are qualified, but
live metadata delivery remains open. Do not enable that flag
based on the editor checks alone. The running installation has not been cut over.

## Identity and commands

POST `/api/library/{action}` uses the existing session cookie, same-origin rules,
admission limits and JSON errors. Every command below includes `app`, `id` (the
document ID), and `operation_id`. The actor and tenant come from the authenticated
session, never the body. Unknown fields are rejected.

| Action | Additional fields |
| --- | --- |
| `branch_create` | `name`, `expected_revision` (Main), `from_revision`, optional `message` |
| `branch_rename` | `branch`, `expected_revision`, `new_name` |
| `branch_delete` | `branch`, `expected_revision`, `expected_main_revision`, optional `force` |
| `merge` | `source`, `target`, `expected_source_revision`, `expected_revision` (target), optional `resolution` (`source` or `target`) |

**`branch`, `source` and `target` select permanent branch IDs, or literal `Main`.**
`branch_create` returns `branch_id`; history includes the same ID alongside the
mutable display name. Renaming a branch cannot change its identity. Deleting and
recreating a name gives a new ID. Main cannot be renamed/deleted. A create guards
Main even when `from_revision` selects an older or another branch's revision.

Branch metadata responses include `ok`, `branch` (display label), `branch_id`,
`head_revision`, `deleted` and `replayed`. Merge returns `ok`, `merged`,
`fast_forward`, `revision`, `branch_id` (null for Main), `target` (stable selector),
`source_head`, `merge_base_revision` and `replayed`.

Both merge heads are validated under the document lock. Divergent content requires
an explicit source/target resolution; no CAD/JSON semantic merge is guessed.
Merges append a revision retaining both parents; an already-merged source produces
an idempotent no-op. A content-changing merge creates an automatic named checkpoint,
version event and receipt in the same transaction as the merge. A failed checkpoint
rolls back the merge/head/receipt; exact replay and no-op merges add no checkpoint.
The target branch identity is retained, and colliding user labels get a bounded
suffix. A divergent unresolved merge returns HTTP409, code `merge_conflict`,
execution `rejected`, and `detail: {conflict:true,source_head,target_head}`. Both
heads are the guarded values under the document lock. A stale guard remains an
ordinary conflict and does not invite a source/target resolution.

## Read, save and history

Existing `read`, `save` and `restore` accept a permanent branch ID in their optional
`branch` field. Main/omitted/empty/null retain their old request fingerprint and
response shape. Non-Main responses add `branch_id` and current `branch_label`; `restore.branch` is the stable
selector. Saves/restores guard the chosen head and allocate a document-wide
revision number without advancing Main. Exact retries may return an acknowledged
old revision even after rename/deletion; they never reactivate a branch or move a
head. A new write to a deleted ID fails. Display names are rejected as selectors.

`history`, `read_revision` and `compare` also accept the stable selector. History
lists all immutable revisions, including retained deleted-branch work, and only
active branch heads. The top-level `branch_identity: "stable"` distinguishes this
protocol even when only Main exists. Branch revisions carry their current label plus `branch_id`;
Main revisions retain their original shape. Renaming never rewrites revision JSON.
Explicit historical reads remain read-only. Comparison follows both merge parents
and can compare revisions beyond Main's current revision number.

History and comparison hold the document's shared lock while capturing heads,
labels and the revision graph, so concurrent edits/renames cannot yield a mixed
snapshot. These read transactions never acquire an operation lock or mutate the
store. Both are bounded by the existing1000-revision compatibility limit; exceeding
it fails rather than returning a misleading partial history. Pagination is a
separate contract. Store branch count and graph limits still apply.

## Authorization and durability

All operations authenticate the current session, check the current app and the
resource's actual app/kind, and retain identity/permission locks until commit.
Reads require Viewer; branch commands and saves/restores require Editor, including
receipt replay. Revoked sessions, disabled apps and lost grants cannot replay old
successful requests. Branches inherit document access; they are not separate ACL
boundaries. Drive upload descriptors are excluded from these editor branch APIs.

Revision content, chosen head, audit, receipt and recent-file visit commit together.
A failed recent-file write rolls back an otherwise prepared branch save. Old Main
requests and immutable receipts are preserved. No production SQL/schema or live
server state is changed by the qualification runner.

## Qualification

`dev/rebuild/postgres_check.py --library-branches-only` runs real PostgreSQL and
HTTP tests for branch reads/saves/restores, merge graphs, retained deletion and name
reuse, exact retries, current authority, rejected malformed requests, atomic save
rollback, competing writers, guarded merges after a blocked source edit, consistent
history capture, and revocation while waiting on the identity lock.

Full document, storage, unit, lint and original-import results are recorded under
`.verification/framework-branch-api-2026-10-11/`. Client/browser branch behavior is qualified separately in
`.verification/framework-branch-client-2026-10-11/`. Validated original branch import is now qualified separately; live branch
metadata delivery and full migration/cutover remain outstanding gates.

## Named versions and collaboration — access schema16

Named versions and release lifecycle commands accept permanent branch selectors.
The optimistic content guard uses the selected branch head, rather than Main.
Version records retain the branch ID and creation label; history resolves the
current label without rewriting old records or receipts. Deletion retains those
references, including when a new branch reuses the name. Main projections and
original request fingerprints keep their previous shape. Retained checkpoints
can be managed from Main after deletion; new checkpoints cannot target a deleted
branch. Exact acknowledged retries still require current Editor access.

Collaboration remains document-wide with its own revision. A root comment uses
the selected branch (or an explicit stable selector in value.branch); a reply
inherits its parent's branch identity even after deletion. An explicit conflicting
reply selector fails. Comment references cannot be moved on update. Display labels
follow branch rename while stored items and event snapshots stay unchanged. New
root comments require an active branch; exact retries and replies from Main may
retain deleted branch references. Existing author/editor moderation rules apply.

Schema16 only adds the checkpoint identity column and constraints. The migration
is explicit and transactional; old schema1–15 SQL and receipts are unchanged.
The offline importer requires the new empty target schema. Original non-Main
branches with provable lineage now transfer through `dev/rebuild/legacy_branches.py`;
ambiguous name reuse and unresolved old comment aliases fail closed. See
`dev/rebuild/LEGACY_TRANSFER.md` for exact recovery and provenance limits.

Metadata qualification, upgrade rollback, merge rollback, name reuse, reply
inheritance, checkpoint limits and original demo recovery evidence live under
`.verification/framework-branch-metadata-2026-10-11/`. This does not enable browser
branch controls or authorize an early cutover.


## Browser integration and explicit retry

UI35/session54/assets6 are installed in all eight consumers. Shared history graphs
and controls use IDs for selection/filtering/navigation and names for display.
Native collaboration responses include `mutation_replay: "operation_id"`. The
shared panels retain an uncertain command's action/body/operation ID and use those
exact values on explicit retry; edited fields/newly observed heads never silently
replace them. Successful acknowledgment clears the pending command before a UI
refresh. Legacy hosts without the native marker do not offer unsafe replay.
The pending command lives in the initiating mounted panel; durable retention
across navigation/reload is still separate work. Browser unload warns while the
reply is uncertain.

Map tab metadata carries `branch_label` separately from `branch_id`. The label
query stays inside the authorized document transaction and also works for exact
save replays after rename/deletion; it cannot change the selected branch. Server
schemas and old Main response shapes are unchanged.

Actual Chromium qualification uses the built Map UI to create, rename and open a
branch, lose a committed version reply and retry it once, add a branch comment,
resolve divergent content, and delete the merged branch while retaining its named
checkpoint. All eight app builds and exact installed-package checks pass; source
and evidence hashes are in the browser integration evidence directory above.
