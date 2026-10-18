-- Chunk bytes live in the private object store. SQL owns durable offsets and
-- completion receipts; cancelled/expired receipts prevent delayed resurrection.
CREATE TABLE aether_access.uploads (
 tenant TEXT NOT NULL, owner TEXT NOT NULL, id TEXT NOT NULL,
 request JSONB NOT NULL, name TEXT NOT NULL, app TEXT NOT NULL,
 location JSONB NOT NULL, replacement TEXT, expected_revision BIGINT,
 expected_structure_revision BIGINT,
 size BIGINT NOT NULL CHECK(size BETWEEN 0 AND 536870912),
 received BIGINT NOT NULL DEFAULT 0 CHECK(received >= 0 AND received <= size),
 chunks JSONB NOT NULL DEFAULT '[]',
 state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','cancelled','complete','expired')),
 created TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 result_id TEXT, digest TEXT,
 PRIMARY KEY(tenant,owner,id)
);
CREATE INDEX active_uploads ON aether_access.uploads(tenant,owner) WHERE state='active';
CREATE TABLE aether_access.upload_blobs (
 tenant TEXT NOT NULL, digest TEXT NOT NULL CHECK(digest ~ '^[0-9a-f]{64}$'),
 size BIGINT NOT NULL CHECK(size BETWEEN 0 AND 536870912),
 chunks JSONB NOT NULL,
 PRIMARY KEY(tenant,digest)
);
