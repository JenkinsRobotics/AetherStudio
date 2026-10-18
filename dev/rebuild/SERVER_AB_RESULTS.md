# Initial server migration A/B results — 2026-10-11

The results are mixed. The migrated server handles this concurrent read/status
workload better, but durable saves remain slower. The migration is **not complete**,
and these results do not justify switching the running installation yet.

## As-shipped original versus the current native host

Measured on Apple M1 Max,10 logical CPUs,32GiB RAM, macOS Darwin25.6.0;
Node24.12.0, Python3.11.15, Rust1.97.1 optimized build and PostgreSQL17.11.
Both servers ran separately against disposable storage on this machine. Trials
alternated A/B order. No real account or document was benchmarked.

The native fixture uses the local-host8-connection pool,4 document handlers,
20 admission slots,45s request deadline and native persisted presentation settings.
The table reports the median of three trial p95s and the median trial throughput.
Every trial contains96 measured requests, after16 warmups per workload/load/server.
Lower latency is better; throughput includes the whole batch's elapsed time.

| Workload | Concurrent requests | Original p95, ms | Native p95, ms | Original requests/s | Native requests/s |
| --- | ---: | ---: | ---: | ---: | ---: |
| Status | 1 | 0.95 | 1.04 | 1493.8 | 1266.8 |
| Status | 4 | 1.59 | 1.43 | 3429.1 | 3420.3 |
| Status | 16 | 65.42 | 3.37 | 1444.3 | 5568.7 |
| Read | 1 | 1.49 | 2.76 | 896.8 | 423.4 |
| Read | 4 | 3.72 | 4.17 | 1392.1 | 1229.1 |
| Read | 16 | 67.72 | 13.06 | 980.3 | 1343.2 |
| Save | 1 | 2.05 | 16.61 | 677.1 | 70.8 |
| Save | 4 | 8.09 | 81.39 | 984.4 | 64.7 |
| Save | 16 | 80.71 | 382.01 | 925.7 | 49.7 |

Both sides completed all2,736 workload requests (5,472 combined, including warmup)
without errors in this final run. All32 fixture documents were read back with
matching bytes and revisions; stale saves were refused. Payloads are synthetic,
highly compressible64KiB buffers with small changing prefixes. These are document
storage requests, not valid complex CAD models or rendered Map shows.

The original SQLite host uses WAL with `synchronous=NORMAL`, `fullfsync=OFF`.
Native PostgreSQL uses `fsync=on`, `synchronous_commit=on`,
`full_page_writes=on`, `wal_sync_method=open_datasync`; native content files and
publication directories are also flushed before revision commit. These different
storage guarantees are part of the as-shipped comparison, not an isolated language
speed measurement. No durability setting was weakened on the new server.

## Stronger original durability configuration

This separate experiment changes only the disposable original SQLite connection
to `synchronous=FULL`, `fullfsync=ON`. It retains the original source and the native
host's normal settings. It helps assess sensitivity to durability configuration;
it does not establish identical crash/power-loss semantics for two storage designs.

| Workload | Concurrent requests | Original p95, ms | Native p95, ms | Original requests/s | Native requests/s |
| --- | ---: | ---: | ---: | ---: | ---: |
| Status | 1 | 1.00 | 1.15 | 1375.7 | 1245.5 |
| Status | 4 | 1.60 | 1.36 | 3428.9 | 3424.2 |
| Status | 16 | 62.69 | 3.56 | 1504.3 | 5714.8 |
| Read | 1 | 14.09 | 3.58 | 92.1 | 377.4 |
| Read | 4 | 37.69 | 4.24 | 120.8 | 1148.1 |
| Read | 16 | 159.16 | 15.97 | 108.4 | 1163.0 |
| Save | 1 | 18.34 | 25.28 | 75.6 | 64.5 |
| Save | 4 | 73.59 | 110.97 | 88.2 | 51.2 |
| Save | 16 | 206.15 | 334.69 | 89.2 | 55.8 |

This final run also completed5,472 workload requests without errors, with the same
readback and stale-save checks. Stronger original settings narrow the save gap,
but the new server still regresses on concurrent saves. Reads also update each
file's recent-open timestamp, so changing commit durability affects this workload.

## What changed as a result

The first exploratory run found37 HTTP429 rejections, including warmups, on the
native host. Four executing document handlers plus a250ms queue wait was too
aggressive for this machine's durable-write bursts. The wait is now bounded at1s
inside the original request deadline; handler count,20-request admission bound,
body limits, account/control separation and cancellation behavior remain intact.
The two final configurations produced no rejected workload requests.

Application permissions now use one shared batched query for catalog status and
individual app access. File metadata uses one current role evaluation for its
read/write flags, under the existing transaction and locks. It does not cache
permissions across requests or bypass revocation checks. Permission and queue
regressions have dedicated tests.203 native HTTP/PostgreSQL tests,23 server unit
tests,512 imported-policy comparisons, Clippy and the actual built-browser flows
passed. All eight catalog entries load, including the administrator-only UI
gallery; the browser still reports the known missing device/agent/CAD-engine
APIs and applicationsReady:false. This change does not add missing server services.

## Has the migration been worth it?

The work has produced a stronger storage and authorization foundation: guarded
writes, safe exact retries, transactional history/audit and verified recovery of
the existing demo data. The concurrent reads here are encouraging. Performance
payback for the whole product is **not yet proven**: saves need further work, the
UI/engines were reused, and several server workflows still do not run natively.
Keep the new server in qualification until those gaps and the save regression
are resolved or explicitly accepted with representative workload evidence.

This experiment has one account, separate per-worker files, loopback networking
and no real-time subscriptions. Normal HTTP connection/accept behavior differs
between implementations and contributes to the observed result. Short trials and
background applications introduce noise; earlier exploratory native save p95s
varied noticeably. No CPU, memory, startup, viewport, CAD recompute, Map playback,
large-asset, multi-machine or hundreds-of-user conclusion follows from this test.

Remaining release work includes uploads, sharing links, branches, remaining
admin/product/agent services, live synchronization, representative full-app A/B,
and final compatibility/recovery/cutover. The original server stays authoritative.

## Evidence and reproduction

Use [the benchmark instructions](SERVER_AB.md). Raw final results live in
`.verification/framework-server-ab-2026-10-11/host-defaults/` and `host-durable/`.
Each contains its pre-run plan, individual samples and complete result JSON.
Earlier exploratory runs, including the rejected-request run, are retained in
the same parent directory. They are not silently substituted for final results.
`native-benchmark-source.tar.gz` and its verified SHA256 manifest preserve171
native/script source files; the original source/build baseline remains in the
previously verified private migration archive. No remote push or cutover occurred.

## Repeated qualification — 2026-10-12

The as-shipped comparison was repeated after access schema21 and the new adapters. Both fixtures completed the workload with zero errors, exact content readback and stale-save refusal. The same single-account/64KiB/loopback protocol and three trials apply; this does not test Animation or the complete application UI.

| Workload | Concurrent requests | Original p95, ms | Native p95, ms |
| --- | ---: | ---: | ---: |
| Status | 1 | 0.87 | 1.13 |
| Status | 4 | 1.60 | 1.49 |
| Status | 16 | 33.89 | 3.87 |
| Read | 1 | 1.46 | 2.97 |
| Read | 4 | 3.43 | 4.33 |
| Read | 16 | 66.25 | 13.39 |
| Save | 1 | 2.08 | 15.04 |
| Save | 4 | 7.66 | 76.03 |
| Save | 16 | 77.14 | 293.04 |

Concurrent reads/status improve in this run; saves and some lower-concurrency cases exceed the20% review threshold. The original retains SQLite NORMAL durability while native PostgreSQL/object commits retain synchronous durability. This explains a relevant difference to investigate, not proof of the entire cause or permission to weaken data guarantees. Save performance and representative company workload acceptance remain open.

Raw plan, samples and report: `.verification/framework-cutover-steps-2026-10-12/ab/`. No live installation changed.


## Distinct-user/native live-subscription qualification — 2026-10-12

The native server passed a synthetic local company workflow with500distinct
member identities,500private documents and500persistent authenticated SSE
subscriptions. Across three rounds, eight concurrent editing workflows completed
1,500guarded16KiB JSON saves and4,500HTTP status/save/read requests with exact
readback. All500cross-user reads were refused; disabling an account closed its
live subscription, and another account reconnected to the latest durable revision.
The smaller64-user/128-subscription run also passed.

Run `AETHER_COMPANY_USERS=500 .venv/bin/python dev/rebuild/postgres_check.py --company-only`. The runner creates and removes a private PostgreSQL
fixture with normal durability; no real user or document is used. Evidence:
`.verification/framework-native-admin-2026-10-12/company-500.log`.

This adds functional multiuser evidence, not a new A/B performance result. It uses
local synthetic authenticated sessions, a debug server and no password hashing,
real CAD/Map rendering, LAN delay or resource-budget certification. Only eight
editing workflows run concurrently. The measured42.65second workload occurred
alongside regression tests and must not be treated as a production throughput
benchmark. The previously measured durable-save regression remains unresolved;
500connected subscriptions does not mean500simultaneous modeling computations.

## Final unmodified-durability comparison — 2026-10-12

After the media/installation/readiness changes, the current implementation was
measured again with the same plan. All5,472 original/native requests completed
without errors; content/revision readback and stale-save refusal passed.

| Workload | Concurrent requests | Original p95, ms | Native p95, ms |
| --- | ---: | ---: | ---: |
| Status | 1 | 0.91 | 1.21 |
| Status | 4 | 1.76 | 1.49 |
| Status | 16 | 33.27 | 3.42 |
| Read | 1 | 1.48 | 2.87 |
| Read | 4 | 3.57 | 4.08 |
| Read | 16 | 64.54 | 13.45 |
| Save | 1 | 2.30 | 66.84 |
| Save | 4 | 8.02 | 83.52 |
| Save | 16 | 79.29 | 287.38 |

Raw plan/samples/report are in
`.verification/framework-native-media-operations-2026-10-12/ab-final/`.
This is still an as-shipped durability comparison, not an isolated Rust/Python
language benchmark. The large variation in native single-save latency across
runs also prevents treating one short run as a stable application SLA.

The investigation compared file-flush primitives. On this Apple target, the
installed Rust standard library uses `F_FULLFSYNC` for file synchronization;
a separate Python `os.fsync` timing does not measure the same operation. See the
[installed Rust version's filesystem implementation](https://raw.githubusercontent.com/rust-lang/rust/1.97.1/library/std/src/sys/fs/unix.rs).
In the isolated Rust calibration, a single64KiB file plus ancestor-directory
flush had11.40ms median/16.50ms p95; at16 workers this was116.69/160.77ms. Removing
repeated directory flushing did not establish a useful concurrent improvement.
A tested directory-cache experiment was therefore removed, and final code keeps
full file and ancestor-directory synchronization before publishing SQL history.

The packet retains the experimental `ab-defaults` results and source separately;
they are not the shipping implementation. `flush-calibration.json` is the
non-equivalent Python experiment; `rust-flush-calibration.json` uses the actual
Rust primitive. These results identify a material durability cost, not a complete
causal breakdown of server latency. Save regression and full app/LAN performance
remain open; no durability setting or acceptance threshold was weakened.


### Rejected flush batching candidate — 2026-10-12

A same-filesystem batching prototype preserved per-file writeback, a final Apple
full-drive barrier and ancestor-directory synchronization before SQL commit. Its
primitive four-file median improved from19.57 to9.27ms, and3 unit/21 PostgreSQL
storage checks passed. The complete matched HTTP experiment did not improve:
concurrency4/16 median-trial native save p95 was114.95/333.85ms, against the
original full-flush native baseline83.52/287.38ms. All requests/readback passed.
The candidate and its additional dependency were removed from production source;
full per-file and directory flushing remains. These successive runs have ambient
load variance and do not prove a universal batching penalty; they do not justify
shipping this implementation. Raw source, passing and failed exploratory logs,
and `ab-batched-candidate/report.json` are retained in the media/operations packet.


### Qualified revision-notification build — 2026-10-12

The final full-flush build adds transaction-committed PostgreSQL revision hints.
Matched HTTP A/B still has zero errors, correct readback and stale-save refusal.
At concurrency16, original/native median-trial p95s are34.73/3.76ms for status,
66.23/13.11ms for reads and47.91/249.70ms for saves. At concurrency1 native saves
are17.37ms p95; at concurrency4 they are86.35ms. Results retain the weaker legacy
SQLite versus stronger native file/SQL durability distinction. Save parity is not
achieved and this is not an isolated language benchmark. The rejected batch/cache
optimizations remain removed. See `ab-notifications-final/report.json` and raw data.

A separate optimized500-user/500-subscription fixture passes1,500guarded16KiB
saves,4,500status/save/read requests,500cross-user denials and live revocation/reconnect
with eight editing workflows in parallel. P95 status/read/save latencies are
2.11/76.95/155.52ms; saved state reaches the subscriber4.41ms after the HTTP save
response at p95. Save-start to visible state is157.90ms p95. Events arriving
before the save response count as zero post-response lag. Complete raw samples
and scope are in `company-notifications-500/`. The previous company run was debug
and did not measure event arrival concurrently, so elapsed-time comparisons
between those runs are not valid performance claims.

Two independent HTTP host instances on one local database also observe12 committed
revisions within1.93–7.36ms after commit. A held/rolled-back mutation emits no new
state; lost notification connections recover and revoked users receive no state.
This qualifies local invalidation delivery, not physical LAN or CAD engine latency.
For local deployment the compatibility, durability and bounded workload gates
pass; optimize durable-save latency and measure office-network/full-app workloads
before a company performance or full-framework release claim.
