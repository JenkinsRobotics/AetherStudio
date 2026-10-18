-- Private legacy workspace paths are names, never operating-system paths.
-- Retain every published content version and the imported base when first edited.
CREATE TABLE aether_access.workspace_files (
    tenant text NOT NULL, owner text NOT NULL, path text NOT NULL,
    sequence bigint NOT NULL CHECK(sequence >= 0),
    digest text NOT NULL, size bigint NOT NULL CHECK(size >= 0), chunks jsonb NOT NULL,
    happened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(tenant,owner,path,sequence),
    FOREIGN KEY(tenant,owner) REFERENCES aether_identity.users(tenant,id)
);
