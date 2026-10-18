-- Secrets are supplied once by the client; only their SHA-256 digest is stored.
-- Separating credentials preserves existing link authority/imported visits.
CREATE TABLE aether_access.link_credentials(
 tenant text NOT NULL,
 link text NOT NULL,
 token_hash text NOT NULL CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 shared_by text,
 created double precision NOT NULL CHECK(created>=0 AND created<'Infinity'::double precision),
 PRIMARY KEY(tenant,link),
 UNIQUE(tenant,token_hash),
 FOREIGN KEY(tenant,link) REFERENCES aether_access.links(tenant,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant,shared_by) REFERENCES aether_identity.users(tenant,id)
);
