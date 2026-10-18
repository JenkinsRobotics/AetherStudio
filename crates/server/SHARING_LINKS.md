# Native organization sharing links

Access schema15 adds `link_credentials` beside the existing canonical `links` and
`link_visits` tables. Run the explicit migration before starting the native host.
Schemas1–14 and their checksums remain unchanged. These are Studio services;
standalone apps do not acquire a database or sharing server.

The existing authenticated Drive endpoints now support:

- `link_create`: `{id,role,days,token,operation_id}`. Current resource owner
  authority and Drive/product access are required. Role is viewer/editor; expiry
  is1–365 whole days. The browser uses Web Crypto to create a32-byte URL-safe
  capability. Only its SHA-256 digest reaches the database, including command
  receipts. The response supplies `{id,url,role,expires,revoked,active,operation_id,replayed}`.
- `redeem`: `{token}`. The signed-in user must currently belong to the resource's
  organization and have Drive/product access. An active capability records a
  visit, then returns the existing Drive metadata projection. No organization
  enrollment or permanent direct grant occurs. Trashed/inaccessible ancestor
  failures roll back the visit.
- `link_revoke`: `{id,link,operation_id}`. Current owner authority is required.
  Revocation is monotonic and repeatable, checks the resource/link association,
  and is audited atomically. It does not remove independent direct/workspace
  permissions. Expiration and revocation are checked on subsequent authorized
  reads and saves, including inherited folder access.

Mutations use the existing serialized authority transaction, current identity,
bounded request admission, strict input fields and20-second service deadline.
Publication and revocation share a transaction with their audit and replay
receipt. Replayed issuance returns the original identity/expiry and current active
state; it never renews or reactivates access. Changed arguments with the same
operation ID conflict. Sharing details never return the digest or capability.
A resource's combined links and direct grants are limited to1,000, matching the
existing complete sharing-details response. Revoked links remain for audit.

Session alpha53 carries the guarded link transport. The Drive sharing dialog
retains an uncertain creation request in memory and offers an explicit retry.
A successful revoked/expired replay is not displayed as an active link. Closing
or refreshing the dialog discards that secret; owners can inspect/revoke the
existing link and create another. There is no automatic network retry or local
persistence of sharing secrets. The original Python endpoint remains compatible
with the added fields; exact receipt replay is a native-server capability.

## Original data and recovery

The offline importer now accepts validated original organization links and visits,
preserving IDs, hashed capabilities, roles, issuer/time metadata, revoked state and
recipient identities. Public/unknown audiences, malformed digests, missing
references and invalid dates are refused. Original snapshot projections remain
frozen: new link data is derived from the verified SQLite snapshot rather than
rewriting recovery archives. PostgreSQL timestamps preserve expiry to microsecond
precision. Content revisions are unaffected.

Qualification and remaining limits are recorded in
`.verification/framework-links-2026-10-11/`. This does not complete branch editing,
remaining application/agent/admin services, live synchronization, offline app
packaging or company-scale performance/cutover qualification. The original local
installation remains authoritative until those gates pass.
