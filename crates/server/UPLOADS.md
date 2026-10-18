# Native Studio uploads

The native Drive upload path uses PostgreSQL access schema14 and the existing
private object-store adapter. It does not add storage services to standalone apps.
Explicitly migrate before serving. The original installation is not cut over.

## Existing browser and CLI contract

`POST /api/drive/upload_begin` accepts `operation_id`, `name`, `size`, and an
ordinary Drive destination (`organization`, optional `workspace`/`parent`).
For replacement, supply `id` and `expected_revision`. Only ordinary Drive files
can be replaced; native app documents continue to use their owning editor.
The response contains `id`, `offset`, `chunk_bytes` and `replayed`.

The browser saves its operation ID before sending begin. Exact begin retries
return the same reservation; changed inputs conflict. A completion receipt
remains available after a lost reply, and replay returns current authorized file
metadata without replacing newer content. The updated CLI supplies an operation
ID; older custom clients must add one before using the native host.

- `upload_status {upload}` returns offset, size, state and acknowledged chunk
  hashes. Reselecting a file verifies that its already-sent bytes match, even if
  another file has the same name, size and modification time. Expired/cancelled
  reservations are terminal; explicit reselection can start a new reservation.
- `upload_chunk {upload, offset, data_base64}` accepts exactly the next 1 MiB, or
  the final smaller chunk. Invalid/stale offsets fail. Check status to reconcile
  a lost chunk acknowledgement; do not guess or silently restart.
- `upload_finish {upload, sha256?}` verifies every chunk and the complete hash,
  rechecks current destination/permissions/name availability, and publishes a
  file or guarded replacement atomically with its completion receipt.
- `upload_cancel {upload}` is owner-only and repeatable. It cannot delete a
  completed file. Interrupted/cancelled transfers do not create file revisions.

Limits: 512 MiB per file, 8 active reservations per user, 24-hour reservation lifetime,
1 MiB per chunk, at most 512 chunks. Lifetime does not extend on each request.
Known Aether extensions at 6 MiB or less become native app documents, preserving
existing import ownership. Larger files and other extensions remain Drive assets.
The native host's normal admission limits/deadlines apply; no unbounded background
finish task is created.

## Storage and recovery

Chunks are tenant-separated, immutable hash-addressed objects under `uploads-v1`.
Local writes flush the object and parent directories and read back its length/hash
before acknowledging the new SQL offset. S3 uses the same object-store boundary;
this qualification exercises local storage, not an S3 deployment.

SQL holds offsets, bounded manifests and receipts. File publication, manifest,
revision and receipt commit together. A failed transaction may leave an
unreferenced immutable chunk, but never a successfully acknowledged partial file.
Automatic orphan-object reclamation and storage quotas are not implemented here;
retain objects until a separately verified garbage collector can account for all
retained revisions, active uploads and receipts. Cancellation releases the active
reservation, not a promise of immediate disk reclamation.

`verify-store` now audits upload manifests and chunks as well as document content.
Back up the database, the complete object directory (including `uploads-v1`), and
any configured imported attachment/workspace roots. A database backup alone is
insufficient. The tests restore finished and interrupted uploads into a separate
PostgreSQL database and copied object root, verify content, and finish the restored
partial transfer independently of its source.

## Reading uploaded files

Ordinary `/api/drive/download` authorizes the selected file/revision before
resolving its private manifest. It streams one verified chunk at a time and
supports the existing explicit-start byte range and safe preview behavior. It
keeps no SQL connection during the response body. An already-authorized response
may finish after revocation; subsequent requests recheck current access.

Drive JSON reads retain their 16 MiB limit. Copy verifies uploaded content while
retaining the existing 64 MiB aggregate copy bound. Imported immutable attachment
snapshots remain supported; arbitrary public saves still cannot claim a blob by
supplying somebody else's digest. Replacement preserves earlier revisions and
their original attachment bytes.

Qualification evidence is in `.verification/framework-uploads-2026-10-11/`.
The PostgreSQL runner executes ordinary document regressions in the debug build
and always adds the maximum-size transfer test in the optimized release build
when running the full document or upload suite. The large-transfer client allows
120 seconds for downloading; the fixture server retains its30-second request
limit. An earlier debug run exceeded the ordinary fixture client's15-second
limit; that failed run is retained. This is capacity/correctness qualification,
not a new before/after performance result. Use optimized builds for deployment.

This is an incremental migration slice. Share links, branches, remaining app/
agent/admin APIs, live synchronization and overall release/cutover gates remain.
