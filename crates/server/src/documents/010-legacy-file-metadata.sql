-- Original file timestamps are distinct from original revision-save times.
-- Import-only baseline; native editing never updates or invents these records.
CREATE TABLE aether_access.legacy_file_metadata (
    tenant text NOT NULL,
    document_id text NOT NULL,
    revision bigint NOT NULL,
    created double precision NOT NULL CHECK(created>=0 AND created<'Infinity'::double precision),
    modified double precision NOT NULL CHECK(modified>=0 AND modified<'Infinity'::double precision),
    PRIMARY KEY(tenant,document_id),
    FOREIGN KEY(tenant,document_id,revision) REFERENCES aether_store.revisions(tenant,document_id,revision)
);
