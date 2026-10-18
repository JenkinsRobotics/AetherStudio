# Durable branch foundation

This is the Studio storage implementation, not a completed browser branch port.
The native library HTTP adapter now supports authorized stable-ID branch commands,
reads, saves, restores, history and comparison; see `../server/LIBRARY_BRANCHES.md`.
Browser capabilities still advertise `branches:false` while checkpoint, collaboration
and client integration remain pending. The legacy branch importer still refuses them.
No running installation has been upgraded by this work.

## Authority and commands

`aether-protocol-core::branches` defines typed branch creation, rename, deletion,
merge, and branch-targeted document mutations. TypeScript is generated from Rust.
The host must obtain `AuthorizedScope` from current authenticated identity and
hold current document editor/app/organization permission locks around every
write and receipt replay. The `_in` methods join that transaction and never
commit it. A successful method return is not permission to acknowledge a save
until the host commits. Read helpers require current viewer authority.

Main's sole head remains `aether_store.documents.head_revision`. Other branches
have stable IDs, names and independent heads in `aether_store.branches`.
`BranchHead.id` is null for Main. **Writes and merges use the stable ID, or the
literal `Main`, never a display name.** `read_branch_in` is a convenience name
lookup for reads; it does not grant authority to write to that name. IDs remain
stable on rename. Deletion leaves a tombstone and every saved revision. A reused
name receives a new ID, so an old editor cannot overwrite the new branch.

Creating a branch guards Main and selects an existing immutable fork revision.
Save, rename-document and restore guard the target branch's head. Revision numbers
are allocated across the entire document under the existing document transaction
lock. A branch edit leaves Main unchanged; the next Main edit gets the next global
number and points to Main's own preceding revision. Existing Main-only requests
retain their wire shapes and fingerprints. A branch wrapper is a separate request
shape, including when explicitly targeting Main.

Renaming a branch changes its label only; revision metadata and old receipts stay
immutable. Deletion guards both its head and Main's head, and refuses unmerged
work unless `force:true` is explicit. Forced deletion does not purge history.
Current branch names can be projected by joining stable revision branch IDs;
historical consumers must not assume a revision's number minus one is its parent.

## Merges and retries

A merge guards both source and target. If source is already an ancestor of target,
it records a durable no-op result. A fast-forward merge takes source content but
still appends a revision recording both parents. Divergent histories require an
explicit `source` or `target` resolution; the storage layer does not guess how to
merge a CAD model, a show, JSON or binary content. Target document name is retained.
The largest shared ancestor is reported as the merge base, matching the existing
host's deterministic rule. More elaborate product merge strategies remain separate.

All operations share a tenant-wide operation ID namespace. A repeated identical
request returns its original result even after rename, deletion or further edits.
Changing its arguments returns an operation conflict. Replay never recreates a
deleted branch or advances a head. Revision receipts, branch receipts, audit and
head changes commit atomically. Merges add a normal revision event; metadata-only
branch commands have their durable branch audit but do not add revision events.
Live branch metadata delivery remains an integration task.

## Storage and recovery

Storage schema3 is additive over frozen schemas1 and2. It adds branch identities,
operation receipts and audit, with foreign keys to revisions and creation receipts.
The optional `branch_id` and `merge_parent_revision` fields are omitted from old
Main revision JSON. Migration does not rewrite old revisions or saved receipts.
Readiness requires schema3; upgrades run only through explicit provisioning.
An upgrade failure rolls back all schema changes. Rollback to an older executable
requires its verified database-plus-object backup, not changing a schema marker.

Verification checks every revision and content object, global number continuity,
each branch's first-parent chain, both merge parents, latest heads, retained branch
identities, creation receipts, audit and operation results. Recovery tests restore
a database dump and an independent object copy, including deleted branches and
previously acknowledged retry results. No pruning is performed.

Synchronous graph traversal is bounded at100,000 revisions; exceeding it returns
a busy error without a partial merge. A document can retain up to4096 branch
identities including tombstones. Names allow1–80 trimmed characters, descriptions
up to500. These are explicit current limits, not company-scale qualification.

## Authorized HTTP integration

The server now reauthorizes branch metadata commands and content edits, including
receipt replay. `read_target_in` resolves permanent IDs; `branch_snapshot_in`
holds a read-only shared document lock while collecting all heads, including
retained tombstones. History uses this to preserve deleted-branch revisions and
project current labels. Comparison traverses both merge parents. Never acquire
the snapshot lock in a write transaction before its operation lock. These methods
remain trusted store adapters; the caller owns current identity/app/resource ACL.
See `../server/LIBRARY_BRANCHES.md` for endpoint contracts and remaining UI work.

## Remaining integration

Connect the existing browser controls to permanent branch IDs and guarded operation
retries. Complete checkpoint/release and collaboration projections, automatic merge
checkpoints and detailed conflict responses. Qualify original branch import/restore
and live metadata delivery before enabling browser capabilities. HTTP document
operations are available; full branch/UI parity and framework completion are not
claimed.

Acceptance commands:

```sh
.venv/bin/python dev/rebuild/postgres_check.py --store-only
.venv/bin/python dev/rebuild/postgres_check.py --branches-only
```
