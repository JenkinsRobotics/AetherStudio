-- Frozen access migration9: private workspace preferences, separate from files.
CREATE TABLE aether_access.workspace_preferences (
    tenant text NOT NULL, user_id text NOT NULL, workspace text NOT NULL,
    favorite boolean NOT NULL DEFAULT false,
    opened double precision CHECK (opened>=0 AND opened<'Infinity'::double precision),
    revision bigint NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 4294967295),
    PRIMARY KEY(tenant,user_id,workspace),
    FOREIGN KEY(tenant,user_id) REFERENCES aether_identity.users(tenant,id),
    FOREIGN KEY(tenant,workspace) REFERENCES aether_access.workspaces(tenant,id)
);
CREATE TABLE aether_access.workspace_preference_receipts (
    tenant text NOT NULL, actor text NOT NULL, operation_id text NOT NULL,
    request jsonb NOT NULL, applied_revision bigint NOT NULL CHECK(applied_revision BETWEEN 1 AND 4294967295),
    PRIMARY KEY(tenant,actor,operation_id),
    FOREIGN KEY(tenant,actor) REFERENCES aether_identity.users(tenant,id)
);
CREATE TABLE aether_access.workspace_preference_events (
    tenant text NOT NULL, actor text NOT NULL, workspace text NOT NULL,
    revision bigint NOT NULL CHECK(revision BETWEEN 1 AND 4294967295),
    operation_id text NOT NULL, before_state jsonb NOT NULL, after_state jsonb NOT NULL,
    happened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(tenant,actor,workspace,revision),
    UNIQUE(tenant,actor,operation_id),
    FOREIGN KEY(tenant,actor,workspace) REFERENCES aether_access.workspace_preferences(tenant,user_id,workspace),
    FOREIGN KEY(tenant,actor,operation_id) REFERENCES aether_access.workspace_preference_receipts(tenant,actor,operation_id)
);
