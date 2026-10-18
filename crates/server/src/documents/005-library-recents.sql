CREATE TABLE aether_access.library_recents (
    tenant text NOT NULL, user_id text NOT NULL, resource text NOT NULL,
    opened timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(tenant,user_id,resource),
    FOREIGN KEY(tenant,user_id) REFERENCES aether_identity.users(tenant,id),
    FOREIGN KEY(tenant,resource) REFERENCES aether_access.resources(tenant,id)
);
