-- Per installation: a server farm may have independent listeners and TLS paths.
-- Saved key paths are references only; certificate/private bytes never enter SQL.
CREATE TABLE aether_settings.network (
    tenant text NOT NULL,
    instance text NOT NULL,
    value jsonb NOT NULL CHECK(jsonb_typeof(value)='object'),
    PRIMARY KEY(tenant,instance)
);
