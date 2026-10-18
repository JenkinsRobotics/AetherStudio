-- Personal navigation state; never a document revision or permission grant.
CREATE TABLE aether_access.file_favorites (
    tenant text NOT NULL, user_id text NOT NULL, resource text NOT NULL,
    favorite boolean NOT NULL,
    revision bigint NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 4294967295),
    PRIMARY KEY(tenant,user_id,resource),
    FOREIGN KEY(tenant,user_id) REFERENCES aether_identity.users(tenant,id),
    FOREIGN KEY(tenant,resource) REFERENCES aether_access.resources(tenant,id)
);
CREATE TABLE aether_access.file_favorite_receipts (
    tenant text NOT NULL, actor text NOT NULL, operation_id text NOT NULL,
    request jsonb NOT NULL,
    applied_revision bigint NOT NULL CHECK(applied_revision BETWEEN 1 AND 4294967295),
    PRIMARY KEY(tenant,actor,operation_id),
    FOREIGN KEY(tenant,actor) REFERENCES aether_identity.users(tenant,id)
);
CREATE TABLE aether_access.file_favorite_events (
    tenant text NOT NULL, actor text NOT NULL, resource text NOT NULL,
    revision bigint NOT NULL CHECK(revision BETWEEN 1 AND 4294967295),
    operation_id text NOT NULL, before_state jsonb NOT NULL, after_state jsonb NOT NULL,
    happened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(tenant,actor,resource,revision),
    UNIQUE(tenant,actor,operation_id),
    FOREIGN KEY(tenant,actor,resource) REFERENCES aether_access.file_favorites(tenant,user_id,resource),
    FOREIGN KEY(tenant,actor,operation_id) REFERENCES aether_access.file_favorite_receipts(tenant,actor,operation_id)
);
