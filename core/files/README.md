# Ordinary browser files

`@aether/files` provides browser document saving and per-editor crash recovery.
It consumes the Rust-generated file contract from a pinned protocol archive.
No React, SQL, IndexedDB, Studio account, server or network transport is required.
The adapter also runs in a dedicated browser worker with structured-cloned file
capabilities; use that arrangement for large documents to keep encoding off the
interaction thread. Real-browser acceptance exercises worker recovery too.
This is a framework adapter; existing application save flows are not switched yet.

The caller supplies a user-selected `FileSystemFileHandle`, a stable app document
key, `navigator.locks`, `crypto`, and optionally the OPFS root returned by
`navigator.storage.getDirectory()`. The adapter never opens a file picker or
requests access itself. With a null file handle, an untitled document can stage
recovery, but saving requires a selected file. For Save As, read the selected
handle's fingerprint after the user chooses it; a save picker may create an empty
file. Do not replace a conflict guard with current content without explicit user
resolution.

```ts
const document = new BrowserDocument(selectedHandle, stableDocumentId, {
  locks: navigator.locks,
  crypto,
  recoveryRoot: await navigator.storage.getDirectory(),
});
const opened = await document.read();
const expected = { kind: 'content' as const, sha256: opened.file.sha256 };
await document.stageRecovery(editorSessionId, expected, editedBytes);
const saved = await document.save(expected, editedBytes);
await document.discardRecovery(editorSessionId, saved.file);
```

A SHA256 guard refuses stale replacements. One origin-wide Web Lock serializes
Aether writers across tabs even if callers assign different document keys to the
same file. The browser write stream requests exclusive access; bytes are staged,
the original is rechecked, and close publishes the replacement. Failures before
close abort the stream. Failure during close is **outcome_unknown**, requiring a
read before deciding whether to retry. Never blindly retry saves. The global lock
is deliberately conservative, so independent documents may briefly report Busy.
External applications and other origins do not participate in this lock: a writer
can still race the final guard/close. This is not an OS compare-and-swap primitive.

The success receipt says `browser_managed`: the browser accepted the stream close.
It does not promise native file-and-directory fsync or persistence through power
loss. Browser support for file pickers varies; feature-detect at the application
boundary and offer explicit import/download when direct access is unavailable.
Do not claim a download proves the destination file was saved.

Recovery uses ordinary JSON files in OPFS, isolated by a hash of the app document
key and editor session ID. The app must keep keys stable and use a fresh session
ID per editor window (letters, digits, dashes and underscores). Drafts are bounded
to 64 MiB of document bytes and 128 sessions per document. Each session keeps its
latest draft, not version history. A failed initial draft can leave an empty file;
it is reported as corrupt rather than silently removed. Directory traversal,
wrong-document drafts, checksum damage and oversized records are refused.

`listRecovery` separates usable and corrupt drafts. Reading never restores them.
Candidates report whether the base still matches the current document and whether
the draft was already saved before its caller lost acknowledgment. Discard checks
the expected draft fingerprint. A normal save does not delete any recovery file.
OPFS is browser-managed and may be evicted or cleared; the UI must surface quota
failures and may request persistent storage through `navigator.storage.persist()`.
Recovery is not a replacement for saving to a user-visible file or Studio.

Run `npm ci`, `npm test`, then `npx playwright install chromium` and
`npm run test:browser`. Unit fixtures inject stale writes, permission/quota errors,
uncertain close and damaged drafts. Real Chromium acceptance uses temporary files
and a temporary browser profile: two-tab locking, external edit conflict, a full
browser restart, explicit recovery, save acknowledgment and guarded discard.
It qualifies OPFS/stream/lock behavior, not native picker integration, Safari,
Tauri or cross-platform power-loss durability. The shared framework gate requires
these checks and verifies that the pinned protocol matches generated source.

Browser behavior references:
[write-stream publication](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createWritable),
[OPFS storage](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system),
[Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request).
