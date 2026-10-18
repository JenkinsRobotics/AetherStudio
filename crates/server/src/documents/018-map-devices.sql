-- Device authority belongs to Studio; playback semantics stay in Map.
CREATE TABLE aether_access.map_devices (
 tenant text NOT NULL, id text NOT NULL CHECK(length(id) BETWEEN 1 AND 64),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
 owner text, pairing_hash text NOT NULL CHECK(length(pairing_hash)=64),
 token_hash text UNIQUE CHECK(length(token_hash)=64), code text,
 code_expires timestamptz NOT NULL, seen timestamptz NOT NULL DEFAULT clock_timestamp(),
 document text, deployed timestamptz,
 PRIMARY KEY(tenant,id), UNIQUE(tenant,code),
 FOREIGN KEY(tenant,owner) REFERENCES aether_identity.users(tenant,id),
 FOREIGN KEY(tenant,document) REFERENCES aether_store.documents(tenant,id),
 CHECK ((owner IS NULL AND token_hash IS NULL AND code IS NOT NULL AND document IS NULL)
     OR (owner IS NOT NULL AND code IS NULL)),
 CHECK(code IS NULL OR code ~ '^[0-9]{6}$')
);
-- Two global enrollment buckets, and at most one claim bucket per account.
CREATE TABLE aether_access.map_device_limits (
 tenant text NOT NULL, bucket text NOT NULL, started timestamptz NOT NULL,
 attempts integer NOT NULL CHECK(attempts>0), PRIMARY KEY(tenant,bucket)
);

-- One bounded signalling lease per device; video/audio travel peer-to-peer.
CREATE TABLE aether_access.map_cast (
 tenant text NOT NULL, device_id text NOT NULL, session_id text NOT NULL,
 token_hash text NOT NULL CHECK(length(token_hash)=64),
 offer text NOT NULL CHECK(octet_length(offer)<=65536),
 answer text CHECK(octet_length(answer)<=65536), state text NOT NULL,
 expires timestamptz NOT NULL,
 PRIMARY KEY(tenant,device_id),
 FOREIGN KEY(tenant,device_id) REFERENCES aether_access.map_devices(tenant,id) ON DELETE CASCADE
);
