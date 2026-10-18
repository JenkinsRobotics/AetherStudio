-- Scoped automation keys are not browser sessions. Only hashes are persisted.
CREATE TABLE aether_identity.agent_connections (
    tenant text NOT NULL, id text NOT NULL, user_id text NOT NULL,
    token_hash text NOT NULL CHECK(length(token_hash)=64),
    label text NOT NULL CHECK(char_length(label) BETWEEN 1 AND 80),
    apps text[] NOT NULL CHECK(cardinality(apps) BETWEEN 1 AND 64),
    can_write boolean NOT NULL DEFAULT false,
    can_edit_content boolean NOT NULL DEFAULT false CHECK(NOT can_edit_content OR can_write),
    created timestamptz NOT NULL DEFAULT clock_timestamp(),
    expires timestamptz NOT NULL, revoked boolean NOT NULL DEFAULT false,
    PRIMARY KEY(tenant,id), UNIQUE(tenant,token_hash),
    FOREIGN KEY(tenant,user_id) REFERENCES aether_identity.users(tenant,id) ON DELETE CASCADE
);
CREATE INDEX agent_connections_owner ON aether_identity.agent_connections(tenant,user_id,created DESC);
