CREATE SCHEMA aether_settings;
CREATE TABLE aether_settings.schema_state (
    singleton boolean PRIMARY KEY CHECK(singleton),
    version integer NOT NULL,
    checksum text NOT NULL
);
CREATE TABLE aether_settings.presentation (
    tenant text PRIMARY KEY,
    revision bigint NOT NULL CHECK(revision > 0),
    value jsonb NOT NULL CHECK(jsonb_typeof(value) = 'object')
);
CREATE TABLE aether_settings.audit (
    tenant text NOT NULL,
    revision bigint NOT NULL,
    actor text NOT NULL,
    action text NOT NULL CHECK(action IN ('presentation_updated','theme_updated')),
    happened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(tenant,revision)
);
