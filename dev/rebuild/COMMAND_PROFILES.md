# Studio command profile 1

This is the first typed command migration over the existing authority, not a new
write authority or the complete product command protocol. Rust owns the profile
in `crates/protocol-core/src/studio_commands.rs`; TypeScript is generated into
`@aether/protocol`. The profile and transport have independent version numbers.
The five existing platform commands are covered; CAD/Map/Animation contracts
remain product-owned and still require migration.

## Discovery and permission boundary

`GET /v1/commands/profiles` requires an agent credential and asks the current
Studio authority for its grant-filtered catalog on every call. A revoked grant
cannot keep discovering commands from a cache. Each entry has its original
`descriptor` and a `semantics` object. Commands outside this profile retain their
descriptor with `semantics: null`; clients must not infer offline support, safe
retries or editor undo from that absence. Conflicting write flags fail discovery.

`GET /v1/capabilities` advertises `studio_command_profile_version`. It continues
to report that Rust storage, live collaboration and durable execution retries
are not connected to this gateway. The new PostgreSQL library does not by itself
make those capabilities available to current commands.

## Effects

| Command | Saved state | Guard | Recovery after uncertain outcome |
| --- | --- | --- | --- |
| `document.list` | Reads accessible files and named-version counts | None | Read again |
| `document.inspect` | Reads saved metadata and bounded text preview; Main reads may update recents | None | Read again |
| `document.history` | Reads revisions, named versions and branch heads | None | Read again |
| `document.rename` | Appends a revision with the new name | Current document head | Inspect before retrying |
| `document.version.create` | Names an existing saved revision; does not append one | Selected branch head (Main by default) | Inspect history before retrying |

All five require the Studio server and operate on saved state, not unsaved editor
content. Successful calls are audited by the authority. None modifies an editor
undo stack. History recovery and editor undo remain separate features. There is
no hardware effect or offline execution capability in this profile.

The adapter never automatically retries any command. `ReadAgain` describes a
caller recovery option, not a transport retry loop. A read may observe a newer
state and may create an audit/recents entry. Writes have **no durable replay**
through this execution adapter, even when the same transport request ID is used.

## Types and validation

`StudioInvocation` is a command-discriminated argument union.
`StudioCommandResult` is a command-discriminated result union. Narrow by `command`
before reading command-specific fields. Shared errors carry both a code and an
execution state; an error code alone is insufficient to decide whether to retry.

The `/v1/commands/run` boundary validates migrated argument types, rejects unknown
fields and requires positive unsigned 32-bit revision guards before dispatch.
The authority still validates its published string lengths, allowed values,
account/app access, document ACLs and current revisions on every execution.
Published legacy `inputSchema` constraints remain authoritative during this
compatibility phase; this is not a second permanent command registry. Future
adapter replacement must pass these same fixtures before removing legacy rules.

Successful replies are checked for their required result types, selected document
and application, positive revisions and saved-state markers. Nullable result
fields must be present; additive metadata passes through unchanged. A malformed
successful result after dispatch is `outcome_unknown`, because the write may
already be committed. It must never be reported as a safe pre-dispatch refusal.
The original legacy endpoints retain their existing request/response shapes.

Legacy `created`, `modified`, `saved` and `status_updated` fields are Unix
**seconds**, including fractional seconds; metadata `size` is bytes. These units
differ from the new storage receipt's explicit `saved_unix_ms`. Revisions are
identifiers, not timestamps or the user's named-version number. Branches share a
global revision sequence: a Main rename can advance from revision 1 to 3 when
revision 2 belongs to a branch. Validators must not require exactly one-step
increments. The future storage adapter must preserve this rule when adding
branching; its initial linear history does not yet replace legacy branch history.

## Acceptance and remaining work

The framework gate runs the same real authority through direct and Rust routes
and compares list/inspect/history results. It verifies rename conflicts,
read-only refusal, immediate revocation, named versions without duplicate saves,
branch-specific version guards and global revision numbers. Response loss and
malformed success bodies are injected **after a real committed rename** to verify
saved history survives exactly once. Rust tests separately prove invalid writes
never dispatch, malformed results are never retried, unknown product semantics
stay unknown and conflicting discovery flags are refused. TypeScript consumer
checks require command narrowing and reject writes without a revision guard.

Still open: product-specific typed results/units/effects, full interface command
coverage, runtime/engine capability negotiation, jobs/cancellation, native/browser
execution adapters and migrating the actual host authority. Authentication/ACLs,
SQL and durable history continue to belong to Studio, not standalone apps.
