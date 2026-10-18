CREATE SCHEMA aether_identity;
CREATE TABLE aether_identity.schema_state (
    singleton boolean PRIMARY KEY CHECK(singleton), version integer NOT NULL, checksum text NOT NULL
);
CREATE TABLE aether_identity.users (
    tenant text NOT NULL, id text NOT NULL, username text NOT NULL,
    password text NOT NULL, role text NOT NULL CHECK(role IN ('admin','member')),
    active boolean NOT NULL DEFAULT true, must_change boolean NOT NULL DEFAULT true,
    full_name text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '',
    email_verified boolean NOT NULL DEFAULT false,
    PRIMARY KEY(tenant,id), UNIQUE(tenant,username)
);
CREATE UNIQUE INDEX identity_email ON aether_identity.users(tenant,email) WHERE email<>'';
CREATE TABLE aether_identity.sessions (
    tenant text NOT NULL, token_hash text NOT NULL, user_id text NOT NULL,
    created timestamptz NOT NULL DEFAULT clock_timestamp(), expires timestamptz NOT NULL,
    PRIMARY KEY(tenant,token_hash),
    FOREIGN KEY(tenant,user_id) REFERENCES aether_identity.users(tenant,id)
);
CREATE INDEX identity_sessions_user ON aether_identity.sessions(tenant,user_id);
CREATE TABLE aether_identity.recovery (
    tenant text NOT NULL, token_hash text NOT NULL, user_id text NOT NULL,
    expires timestamptz NOT NULL, PRIMARY KEY(tenant,token_hash), UNIQUE(tenant,user_id),
    FOREIGN KEY(tenant,user_id) REFERENCES aether_identity.users(tenant,id)
);
CREATE TABLE aether_identity.attempts (
    tenant text NOT NULL, key text NOT NULL, count integer NOT NULL CHECK(count>=0),
    until timestamptz NOT NULL, PRIMARY KEY(tenant,key)
);
CREATE TABLE aether_identity.audit (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant text NOT NULL, actor text NOT NULL, action text NOT NULL, target text NOT NULL,
    happened_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
