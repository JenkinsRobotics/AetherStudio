# Initial server A/B qualification

This measures a migrated server API slice. It is not the full application A/B
release gate, a pure Python-versus-Rust comparison, or a company-capacity claim.
The old installation stays running and authoritative.

## Reproduce

From the active Studio checkout, with its Python environment, Node, Rust and
PostgreSQL tools available:

```sh
AETHER_AB_ORIGINAL='/absolute/path/to/preserved/Aether Studio' \
AETHER_AB_EVIDENCE="$PWD/.verification/server-ab/defaults" \
.venv/bin/python dev/rebuild/postgres_check.py --server-ab
```

The runner builds an optimized Rust test host, creates private PostgreSQL/object
storage, and starts the preserved original Python code against a new temporary
SQLite database. Both bind ephemeral loopback ports. No real users, documents,
live server configuration, app workers or hardware are used. The original
checkout is imported with bytecode writing disabled. Fixture passwords and
session cookies are excluded from the result files.

The native fixture uses the local native-host pool size, document admission
limits, deadline and persisted server settings. Frontend bundles and product
engine services are not loaded. The original is run with its existing host
configuration. This is a storage/HTTP integration measurement, not a standalone
binary startup or resource-footprint measurement.

Run a separate durability sensitivity experiment with `AETHER_AB_DURABLE=1` and
a different evidence directory. This sets SQLite `synchronous=FULL` and
`fullfsync=ON` **only in the disposable original fixture**. It must never replace
the as-shipped original baseline or be described as identical storage engines.
Both report the actual database durability settings.

## Workload and acceptance

- One authenticated account and16 distinct documents; not16 independently active
  users or a WebSocket test. Each worker has its own document and revision guard.
- Synthetic64KiB payloads through the existing library endpoints. No CAD geometry
  or Map scene evaluation is included.
- Status, Read and Save, at1,4 and16 concurrent requests;16 warmups and three
  measured trials of96 requests per cell. A/B order alternates between trials.
- Same Node HTTP client and machine for both. Normal HTTP connection handling is
  retained; the old HTTP server's connection/accept behavior contributes to the
  result. Loopback removes office-network/TLS latency. Background apps remain
  running, so short trials have noise and are preliminary.
- Raw individual latencies, status codes and correctness results are retained.
  Any rejected request, timeout or mismatched result fails the qualification.
  No automatic retry hides overload.
- Saved bytes and revisions are read back; stale saves must return409. This
  workload does not power-cycle a machine or replace the recovery tests.
- The displayed cell is the median of three trial p95 values. It is not a pooled
  percentile or a confidence interval. The predeclared20% regression threshold
  triggers investigation, not permission to call the release complete.

Each evidence directory contains `plan.json` (written before measurements),
`raw.json`, `report.json`, and private fixture diagnostics. Release build output
is retained alongside it. The2026-10-11 investigation and measured results are
recorded in `SERVER_AB_RESULTS.md`.

## Work still required

Complete uploads/sharing/branch and remaining admin, product and agent endpoints;
qualify live synchronization and realistic multi-user editing; measure memory,
CPU, startup, large projects and office-network behavior; complete matching
Map/CAD editing/rendering workflows and final data recovery/cutover. The partial
server measurements do not satisfy those gates.
