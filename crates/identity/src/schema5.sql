-- OAuth clients and short-lived authorization state are durable, tenant-scoped.
-- Browser sessions and delegated credentials never cross authentication modes.
CREATE TABLE aether_identity.oauth_clients (
 tenant text NOT NULL, id text NOT NULL, name text NOT NULL,
 redirects text[] NOT NULL, created timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant,id), CHECK(cardinality(redirects) BETWEEN 1 AND 8)
);
CREATE TABLE aether_identity.oauth_requests (
 tenant text NOT NULL, id_hash text NOT NULL, client_id text NOT NULL,
 redirect_uri text NOT NULL, resource text NOT NULL, challenge text NOT NULL,
 state text NOT NULL, owner_id text, grant_id text, code_hash text,
 created timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires timestamptz NOT NULL DEFAULT clock_timestamp()+interval '10 minutes',
 code_expires timestamptz,
 PRIMARY KEY(tenant,id_hash), UNIQUE(tenant,code_hash),
 FOREIGN KEY(tenant,client_id) REFERENCES aether_identity.oauth_clients(tenant,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant,owner_id) REFERENCES aether_identity.users(tenant,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant,grant_id) REFERENCES aether_identity.agent_connections(tenant,id) ON DELETE CASCADE
);
CREATE TABLE aether_identity.oauth_grants (
 tenant text NOT NULL, grant_id text NOT NULL, client_id text NOT NULL,
 resource text NOT NULL,
 PRIMARY KEY(tenant,grant_id),
 FOREIGN KEY(tenant,client_id) REFERENCES aether_identity.oauth_clients(tenant,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant,grant_id) REFERENCES aether_identity.agent_connections(tenant,id) ON DELETE CASCADE
);
