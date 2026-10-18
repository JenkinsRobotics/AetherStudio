-- Immutable compatibility details from the verified source archive. Content,
-- revisions and authorization remain in their existing native authorities.
CREATE TABLE aether_access.legacy_history_annotations (
    tenant text NOT NULL,
    document_id text NOT NULL,
    revision bigint NOT NULL,
    note text NOT NULL CHECK(char_length(note)<=500),
    saved double precision NOT NULL CHECK(saved>=0 AND saved<'Infinity'::double precision),
    parent_revision bigint CHECK(parent_revision>0 AND parent_revision<revision),
    PRIMARY KEY(tenant,document_id,revision),
    FOREIGN KEY(tenant,document_id,revision) REFERENCES aether_store.revisions(tenant,document_id,revision)
);
