-- Credential bytes live in the operator's private mail vault, never SQL backups.
CREATE TABLE aether_settings.mail (
    tenant text PRIMARY KEY,
    value jsonb NOT NULL CHECK(jsonb_typeof(value)='object')
);
CREATE TABLE aether_settings.mail_events (
    tenant text NOT NULL,
    actor text NOT NULL,
    action text NOT NULL,
    happened_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
