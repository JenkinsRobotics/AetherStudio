# Host scaling: 200+ concurrent users

**Requirements (Jonathan, 2026-09-12):** browser-based, GPU, server-hosted,
many concurrent users, PDM as the critical next step. These are fixed; the
architecture serves them, not the other way round.

## Where we stand against each

| Requirement | Status | Evidence |
|---|---|---|
| Browser-based | **met** | React/TS app; OCCT compiled to WASM in a worker (`kernel/occt.worker.ts`) |
| GPU | **met** | `THREE.WebGPURenderer` (`Aether CAD/src/viewer.ts`). Real WebGPU, not WebGL |
| Server hosting | **met** | `core/host` serves the suite, apps, accounts, library |
| Many concurrent users | **in progress** | see below |
| PDM | **v1 shipped**, v2 gated on concurrency | `history.py`: content-addressed blobs, branch heads, parent revisions |

**Geometry runs in the browser, and that is the scaling advantage.** Every
user's own machine does their modeling. The server is auth + documents +
blobs — a boring, horizontally scalable shape. Onshape needs a geometry farm
because their kernel is server-side; ours is not. Any proposal to move
evaluation to the server trades this away, and should be measured against
that cost. Keeping `evaluatePartDocument` a pure function of the feature
array means the option stays cheap if huge assemblies ever demand it.

GPU note: no CAD kernel uses the GPU for B-Rep math — OCCT is CPU-only by
nature. "GPU support" in CAD means rendering, which is done.

## The real bottlenecks, in the order they bite

### 1. Global request serialization — **fixed 2026-09-12**

`do_POST` wrapped the entire request in `host.lock`, body read included, so
**every POST in the server was serialized** — every autosave, commit, sign-in
and RPC — and one client dribbling a body stalled everyone until its 15 s
socket timeout. Header checks and the body read now happen outside the lock;
only `dispatch` is mutually exclusive. The error path's `rollback()` stays
under the lock, because the store is a single shared connection and an
unguarded rollback would discard another thread's transaction.

Regression test: `test_a_slow_request_body_does_not_block_other_users` opens a
socket that announces a 4 KB body, sends 5 bytes, and stops; a second request
must still be answered in under three seconds. Verified to fail against the
old shape and pass against the new one.

Still to do in the same vein: `do_GET` holds the lock across its reply, so a
slow *reader* can hold it. Hot public assets already bypass it.

### 2. One shared SQLite connection

`state.py` opens a single `sqlite3.connect(..., check_same_thread=False)` for
every thread. WAL is enabled, but WAL's concurrent readers cannot materialize
through one connection — CPython serializes statements per connection, so the
store is a second queue behind the first. **Fix: a connection per thread**
(or a small pool), which is what makes WAL's reader concurrency real. Cheap,
and it is a prerequisite for judging whether SQLite is actually the limit.

### 3. Document blobs live inside the database

`library_blobs(hash TEXT PRIMARY KEY, content BLOB NOT NULL)` stores whole
documents as rows, and continuous autosave writes a new blob per revision. So
write volume is document size x save rate: 200 active editors saving a 1 MB
document every 10 s is ~20 MB/s into the database. **No database choice
survives that** — this is the item to fix before picking one.

Two fixes, both independent of the database:

- **Blobs on the filesystem (or object storage), keyed by hash.** The table
  becomes metadata plus a hash. Content addressing is already in place, so
  this is a storage-location change, not a model change. It also makes
  backups and S3-compatible hosting straightforward.
- **Stop snapshotting whole documents per autosave.** The document is already
  an ordered array of feature operations, so store operations between periodic
  snapshots. This is the one genuinely valuable idea in the "array of discrete
  feature operations" advice — we have the model, we are just not exploiting
  it for storage.

### 4. Then, and only then, the database

With 1–3 done, SQLite handles 200 concurrent users of *this* workload: reads
scale, and metadata writes are small rows. Move to **PostgreSQL** when a
requirement actually demands it:

- more than one host process or node (SQLite is single-writer, single-file)
- real replication, point-in-time recovery, managed hosting
- multi-tenant SaaS rather than a team install

Keep SQLite as the single-install path — the roadmap's self-hosted
installation target needs a zero-dependency option. Two backends behind one
narrow store interface is justified by two real deployment targets, not
speculation.

**Not InfluxDB.** It is a time-series database: documents, revisions, users
and permissions are relational plus blobs, which is the opposite shape.
Influx *would* be a reasonable choice later for the animatronics lane's
hardware telemetry — sensor and actuator streams over time — which is a
separate store with a separate access pattern.

### 5. Serving layer

`ThreadingHTTPServer` is Python's stdlib server: one OS thread per
connection, single process, no backpressure or connection limits. Adequate
for a team install; replace with ASGI behind a real worker pool when load
justifies it. This is invisible to the client, so it can wait until measured.

## Order of work

1. ~~Global POST lock~~ — **done**
2. `do_GET` reply outside the lock; per-thread store connections
3. Blobs out of the database; operation-log storage instead of full snapshots
4. PDM v2: merge and simultaneous editing (needs 1–3 first)
5. ASGI + PostgreSQL when a deployment requirement demands them

Nothing in 1–5 touches the CAD app or the UI.
