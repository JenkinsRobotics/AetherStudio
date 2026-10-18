ALTER TABLE aether_access.resources ADD COLUMN structure_revision bigint NOT NULL DEFAULT 1 CHECK(structure_revision BETWEEN 1 AND 4294967295);
CREATE INDEX recycle_roots ON aether_access.resources(tenant,organization,workspace,id COLLATE "C") WHERE trashed;
CREATE TABLE aether_access.resource_receipts (
    tenant text NOT NULL, actor text NOT NULL, operation_id text NOT NULL,
    request jsonb NOT NULL, receipt jsonb NOT NULL,
    PRIMARY KEY(tenant,actor,operation_id),
    FOREIGN KEY(tenant,actor) REFERENCES aether_identity.users(tenant,id)
);
CREATE TABLE aether_access.resource_events (
    tenant text NOT NULL, resource text NOT NULL, revision bigint NOT NULL,
    actor text NOT NULL, operation_id text NOT NULL,
    before_state jsonb NOT NULL, after_state jsonb NOT NULL,
    happened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(tenant,resource,revision),
    FOREIGN KEY(tenant,resource) REFERENCES aether_access.resources(tenant,id),
    FOREIGN KEY(tenant,actor) REFERENCES aether_identity.users(tenant,id)
);
