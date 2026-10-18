# Standalone document files

This is the native file adapter for future Tauri integration and the local CLI.
It preserves ordinary product document bytes without a server, account, SQL
library or revision-history service. Product engines own file formats and undo.
It is a reusable infrastructure package hosted in the Studio source repository,
not a dependency on the Studio server. No current app has been silently rewired.

The public library and `aether-local-files` executable use the same adapter. The
CLI accepts one `LocalFileRequest` JSON object on stdin and returns one typed
response. Rust generates the TypeScript contracts. Absolute document/recovery
paths must come from an explicitly authorized local file picker or caller; these
path-bearing operations are never remote Studio/MCP bearer-token commands.

## Saving

Read returns bytes and a SHA-256 fingerprint. Save requires either `missing` for
a new file or the fingerprint last read. Another Aether writer gets an OS lock
refusal or a stale-content conflict. All Aether processes must use the same
application-private recovery root, and each editor window needs a distinct
recovery session ID. Persistent empty lock files are intentional: removing their
inode while another process holds it would break mutual exclusion.

Content is written to a temporary file in the destination directory, synchronized,
checked again against the original fingerprint, and atomically published. New
file creation never overwrites a file created concurrently. Existing permissions
are preserved; read-only files, symbolic-link targets and directories are refused.
There is a 64 MiB document limit; media belongs in product-managed external assets.
Unix success reports file and parent-directory synchronization. Other platforms
report file-only durability until their directory durability is qualified. Failure
after publication reports `outcome_unknown`; read the file before deciding to retry.

Unrelated editors can ignore advisory locks. This adapter detects changes before
and during staging, but filesystem replacement cannot atomically compare hashes
against a non-cooperating writer in the final check/rename interval. It does not
claim transactional multiuser editing of network shares or hardware power-loss
certification. Use Studio for coordinated shared document editing.

## Crash recovery

The editor stages one latest draft per session in the private recovery directory.
Different windows retain separate drafts. Discovery returns bounded summaries
(up to 128 sessions per document) plus corrupt session IDs; it never deletes or
silently restores a draft. A candidate reports separately whether its original
base still matches the file and whether its content was already saved before
response loss. Explicit recovery can save only against the current fingerprint;
outside edits must be resolved first. Discard checks the draft fingerprint.

Saving a file does not automatically remove a draft. After confirmed success,
the caller may explicitly discard the matching session draft. An interrupted
save can leave a temporary sibling file; it is not published, and the old file
and staged recovery remain. Automatic recovery requires the editor to stage its
draft before losing the unsaved state; application wiring is still required.
Corrupt drafts are retained for inspection. There is no SQL, version log, account
service, automatic history pruning or Studio connection in this adapter.

## Verified locally

Tests use disposable files only: stale saves, competing writers, external edits
during staging, missing-file protection, symbolic links/read-only/size limits,
separate session drafts, guarded discard, corrupt-draft discovery and real
process exits before publication and after completed save. CLI subprocess tests
exercise creation, recovery discovery/read/discard and conflict responses without
starting a server. The framework gate rejects SQL/server/network dependencies in
this crate's normal dependency graph.

Browser file APIs, file-picker authorization, app workspace integration, native
engine capability checks and signed desktop distribution remain separate gates.

The writer-lock guard explicitly unlocks before closing its descriptor. A child
process can briefly inherit an open file description during launch; relying only
on close could keep a completed operation busy until the child reaches exec.
A deterministic duplicate-handle regression covers that case while the normal
competing-writer and killed-process recovery checks remain enabled.
