-- Paths, executables and credentials are operator-owned, never browser settings.
CREATE TABLE aether_settings.backups (
    tenant text PRIMARY KEY,
    interval_hours integer NOT NULL DEFAULT 0 CHECK(interval_hours IN (0,6,12,24,168)),
    last_attempt bigint NOT NULL DEFAULT 0 CHECK(last_attempt >= 0)
);
