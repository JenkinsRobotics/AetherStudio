# Aether platform host — local development

This folder owns accounts, sessions, entitlements, documents, revisions, sharing
and storage. Products register services through installed `aether.products` entry
points; HTTP requests cannot name modules or dynamically install services.

## Local setup

From the platform root, run `python3.11 bootstrap.py`. It installs the configured
sibling products and builds their web apps. For service-only setup use
`python3.11 bootstrap.py --python-only`. Keep the siblings together or update the
operator-owned `projects.json` (or `AETHER_PROJECTS_FILE`).

Start with `.venv/bin/python -m core.host serve --data /an/explicit/test-directory`
and choose a free port during setup. Do not use the old macOS installer scripts
for this candidate: they describe the original monorepo deployment and have not
been migrated or qualified. Existing production data and launch agents remain
untouched. The historical host documentation is in `README.pre-split.md`.

## Product service contract

Each installed entry point returns a service whose `app` matches its registered
name. Optional initialization receives the platform host. JSON `api` and `rpc`
dispatch check application entitlement before product code runs. Streaming HTTP
handlers own their endpoint-specific authorization, including Map's public
provisioning, pairing proofs and device bearer tokens; user streams require a
user account and app entitlement. The platform checks origin for generic JSON requests. Product streaming handlers
retain their endpoint-specific origin/framing checks and use platform response
primitives.

Services declare `document_create_actions` and `document_actions`. Platform file
lookup checks access; mutating product handlers additionally require write access
and the current revision. Product handlers reuse platform save/history operations.
Map's table shares the platform database and transaction lock, while its schema
and behavior are product-owned. No second document or account store is introduced.

Registration tests: `.venv/bin/pytest core/host/tests/test_product_services.py`.
Full integration tests: `.venv/bin/pytest core/host/tests` with the product services
installed. See `../../migration/PHASE2.md` for evidence and remaining limitations.
