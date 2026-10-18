# Studio identity migration

This server-only crate implements native PostgreSQL accounts, password checking,
sessions, administrative revocation and password recovery. It is not linked into
standalone apps; the separate `aether-native-host` executable now exposes account
HTTP routes using this authority. The existing Python authority and running
installation are unchanged. This slice does not establish document permissions:
an authenticated administrator is not automatically an owner of another person's
private documents.

`Identity::new` takes an operator-configured tenant and a dedicated bounded pool
whose connector owns TLS. It never accepts tenant selection from untrusted request
bodies. Reuse one instance or clones per deployed identity authority. All tables
and lookups include the tenant; session and recovery tokens store only SHA256.
The constructor's hash-job limit applies across clones, not independent instances
or processes. Capacity planning must account for the total number of instances.

`migrate` explicitly provisions schema3 or upgrades verified frozen schema1/2
under an advisory lock. Schema checksum,
unknown version and foreign schema checks refuse incompatible stores. It does not
import or read a legacy database. `bootstrap` is a local operator-only operation
that atomically refuses a second initialization. Never expose it as an anonymous
web route. Existing setup-file authorization still needs its native migration.

## Credentials and concurrency

- Legacy Python scrypt hashes (N=16384, r=8, p=1, 64 bytes) remain readable,
  proven against a Python-generated fixture. New/reset passwords use explicit
  `scrypt-v1` parameters N=131072, r=8, p=1 and a fresh 128-bit salt. This stronger
  format is not readable by the old host; production account migration requires
  a pre-migration backup and an explicit rollback plan.
- Passwords retain the legacy 12–256 Unicode character bounds. Password hashes
  accept only the two defined bounded formats, not attacker-chosen work factors.
  Derived values use a constant-time comparison. Password copies and secret
  buffers are zeroized; tokens omit serialization and redact Debug output.
- Password hashing uses blocking workers outside all database transactions and
  connections. A fail-fast semaphore limits 1–8 jobs (~128 MiB per new hash).
  Canceling a request does not release its permit while its worker still runs.
  Unknown accounts perform a new-format dummy verification. Legacy accounts
  still have a cheaper verification cost; no identical timing claim is made.
- Account/IP attempt reservations persist before password work, so simultaneous
  requests and abandoned requests cannot bypass the limit. Loopback users have
  separate account buckets; one person's mistakes cannot lock out the host.
  Ten attempts block for 15 minutes; expired buckets restart. A success removes
  only its reservation, preserving concurrent failures (a deliberate hardening
  from the legacy whole-bucket clearing behavior).
- Identity mutations have short per-tenant transaction locks, never hash work.
  Password/active state and admin credentials are rechecked at commit, preventing
  an in-flight old-password login from surviving a reset or deactivation. Current
  sessions, not cached user objects, authorize every administrative mutation.
  Session queries reread active state and expiry each time.
- Sessions expire after 12 hours. Password replacement revokes all sessions and
  recovery links atomically; forced-reset sessions can change their password but
  cannot edit identity or administer accounts. Self-disable/demotion is refused.
  No administrative flow can remove the last active administrator.
- Recovery links expire after 30 minutes and are single-use. Requesting another
  replaces the prior token; changing email invalidates recovery. Per-account and
  peer-address throttles bound requests. The internal `request_recovery` result
  is **only for a trusted mail sender**; a public endpoint must always respond
  generically, never return a token or reveal whether an account exists.
- Audit entries and identity changes commit together. Database details, passwords
  and tokens are not included in errors. Ambiguous commits return OutcomeUnknown.
  Reads and writes have bounded pool waits, statement and lock deadlines.

Crypto uses [RustCrypto scrypt](https://docs.rs/scrypt/0.11.0/scrypt/),
[getrandom](https://docs.rs/getrandom/0.4.3/getrandom/) and constant-time comparison;
this crate does not invent a password algorithm.

## Acceptance and remaining integration

`dev/rebuild/postgres_check.py` runs native identity acceptance after storage tests
inside a private disposable PostgreSQL cluster. Fixtures cover actual legacy
credentials, tenants, revocation, expiry, concurrent throttling, recovery,
identity changes, administrator protections, rollback on audit failure, schema
refusal and a login racing deactivation. A separate case runs 500 simultaneous session checks
through a pool capped at eight connections, then revokes the session and repeats;
every subsequent check must reject it. Reported timings cover internal identity
reads only, not browser networking, multiple active editors or live collaboration. Unit tests cover hash compatibility and
cancellation without oversubscribing hashing workers.

The native host now provides same-origin cookie sign-in/session/password/profile
and selected admin mutations. `check_schema` is read-only at host startup.
`update_profile` requires current-password verification and rechecks the credential
under the commit lock; `update_identity` remains an internal trusted caller API.
See `../server/NATIVE_HOST.md` for supported routes and acceptance.

Not yet migrated: full setup/SMTP/admin UI routes, service and agent
credentials, team/app/document ACLs, themes/avatars, full account import/rollback,
SSO and hosted operational qualification. The Rust gateway still delegates to the
legacy authority; identity parity must be finished before switching it. No
production deployment or user database is altered by building or testing this.


## Account preferences

Identity schema2 adds a separate per-tenant/user preferences table. It leaves all
v1 credentials, sessions and identity columns intact. An explicit migration checks
the frozen v1 checksum, runs the additive SQL and advances the combined checksum
in one transaction. Serving refuses old/unknown schemas; reads never upgrade SQL.

`update_preferences` accepts only the current user's optional theme, theme_id and
avatar fields. Omitted fields retain their current value; empty strings clear an
avatar or theme override. Unknown fields, nulls and duplicate JSON keys are invalid.
The theme is dark/light/system, theme_id has at most64 Unicode characters and is
trimmed on update (NUL is refused). Avatar data is a PNG/JPEG base64 data URL with
the matching signature, at most256 KiB decoded and350,000 encoded bytes. This is
signature validation matching the existing host, not a full image decoder.

Preference updates serialize with account/session changes, recheck active sessions
and forced-password state, and commit with their audit record. Concurrent patches
preserve unrelated fields; concurrent changes to the same field use commit order.
Queued requests see a revoke committed before they obtain the identity lock.
Status/session display projections read preferences under the same shared identity
lock. Routine document authorization keeps the small `User` type and does not fetch
profile images. No preferences cache or second identity store was introduced.


## Agent grants — schema3

Scoped agent credentials have their own hashed table and authorization method;
`authenticate` and browser sessions never accept them. Issuance/revocation is
normal-session-only. Grant checks participate in the same shared identity lock
as document commits, and account/password/session revocation marks grants revoked.
Rate/active limits serialize by tenant/user, while failed audit writes roll back
issuance. See `../server/NATIVE_AUTOMATION.md` for HTTP boundaries and recovery.
