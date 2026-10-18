# Native Studio collaboration

Comments, replies, document notes, action items and reminders are Studio-owned
metadata. They use the existing React panels and `/api/library/*` transport;
standalone applications do not gain a SQL or collaboration dependency.

## Routes and guards

POST `/api/library/collaboration` accepts `{app,id,branch?,operation_id?}`. The
optional operation ID keeps existing clients compatible; reads never create a
receipt or change history. Only Main (or omitted/empty/null) is currently supported.
The response retains the legacy comments/tasks/reminders/notes, revision, actor,
owner, members and activity fields. Only active people with current document
access appear in members. No administrator bypass exposes private documents.

POST `/api/library/collaboration_mutate` accepts:

```
{app,id,branch?,operation_id,expected_revision,collection,operation,item?,value}
```

- `expected_revision` is the **discussion** revision, starting at zero. File
  content revisions and recent-file visits are not changed by collaboration.
- Collections are comments, tasks, reminders and notes. Operations are add,
  update and delete; notes support update only. Unknown fields are rejected.
- A viewer may contribute comments, tasks and reminders, and change their own
  items. Document editors may moderate other people's items. Assignees may change
  only the status of a task/reminder assigned to them. Notes require editor access.
- App access, current session and document permissions are checked within the
  transaction. Revocation committed before a queued write wins. Password-reset
  restrictions and tenant boundaries apply as they do to document content.
- Mutation success adds `applied_revision` and `replayed` to the legacy state.
  An identical request returns its original applied revision with the **current
  authorized discussion state**. It never rewinds the caller's view to an older
  member list or conversation. Receipt reuse with different arguments conflicts.
  Current access is required for replay; a moderation/notes receipt also requires
  current editor permission. New stale revisions return409.

A transaction commits the updated item, discussion head, complete before/after
journal, audit and operation receipt together. No-op edits follow the legacy
behavior and still create an event. A failed write or failed audit leaves all
five unchanged. Deleted items become tombstones; their prior text/images remain
in the journal, and replies remain available.

## Qualified content and limits

Comments allow10,000 Unicode characters, tasks/reminders1,000 and notes50,000.
Text is trimmed. Database NUL characters are refused. Comments may reference a
canonical saved revision, with a checkpoint name or `Saved state` label. Clearing
the reference is supported. Replies require an existing root comment and cannot
nest; only root discussions can be resolved. Moving existing replies between
parents/workspaces is not supported.

Comment attachments accept at most three named PNG/JPEG images, at most1MiB
of decoded bytes each, with validated base64 and raster signatures. No SVG/URL
content is accepted. Image decoding/re-encoding remains the existing client’s
responsibility; signature validation is not a claim of full image-decoder safety.
Tasks/reminders have open/in_progress/done status, a current member assignee, and
an optional valid Gregorian YYYY-MM-DD due date.

Each item collection allows5,000 entries, including tombstones. The complete state
is bounded to16MiB (including stored JSON representation), member candidates to
2,048 and member output to4MiB. The existing host request/response/admission limits
also apply. Overlarge states fail explicitly; they are not silently truncated.
Activity returns the latest100 events, while every event remains stored.
Large-company indexed authorization and performance qualification remain open;
this bounded member projection checks each candidate against existing policy.

## Schema and legacy recovery

Access migration008 adds normalized heads/items/events/receipts. It retains the
frozen checksums of migrations1–7. Serving requires schema8; only explicit migrate
upgrades a database. Failed DDL rolls back, including the schema marker.

The offline importer extracts collaboration after checking the original frozen
snapshot projection. It replays every legacy event in order and compares each
before-state plus the final reconstructed state. It validates authors, references,
Main workspace, item fields, raster attachments, dates and size bounds. Missing
history, orphan events and inconsistent state block import rather than dropping
records. It preserves source IDs, ordering, tombstones, precise timestamps and
original before/after values. Imported events have no invented operation receipt.

The migration fixture exercises legacy comments, a reply after root deletion,
checkpoint/image references, tasks, notes and reminders; exact native read output,
new native writes/retries, import rollback and portable dump recovery are checked.
The actual preserved demo has no collaboration records; its schema8 rehearsal
therefore verifies empty collaboration tables and all original users/files/history.

This is request/response collaboration with the existing client polling. It does
not implement WebSocket synchronization, product conflict merging, branches,
notifications or background reminder delivery. Those remain separate framework
work and are not implied by the ability to save reminders.
