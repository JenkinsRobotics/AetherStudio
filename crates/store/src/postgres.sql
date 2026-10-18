CREATE SCHEMA aether_store;
CREATE TABLE aether_store.schema_state (
    singleton boolean PRIMARY KEY CHECK(singleton), version integer NOT NULL, checksum text NOT NULL
);
CREATE TABLE aether_store.documents (
    tenant text NOT NULL, id text NOT NULL, app text NOT NULL,
    head_revision bigint NOT NULL CHECK(head_revision BETWEEN 1 AND 4294967295),
    PRIMARY KEY(tenant,id)
);
CREATE TABLE aether_store.revisions (
    tenant text NOT NULL, document_id text NOT NULL,
    revision bigint NOT NULL CHECK(revision BETWEEN 1 AND 4294967295),
    metadata jsonb NOT NULL,
    PRIMARY KEY(tenant,document_id,revision),
    FOREIGN KEY(tenant,document_id) REFERENCES aether_store.documents(tenant,id)
);
ALTER TABLE aether_store.documents ADD FOREIGN KEY(tenant,id,head_revision)
    REFERENCES aether_store.revisions(tenant,document_id,revision) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE aether_store.operations (
    tenant text NOT NULL, operation_id text NOT NULL, fingerprint text NOT NULL,
    document_id text NOT NULL, revision bigint NOT NULL, receipt jsonb NOT NULL,
    PRIMARY KEY(tenant,operation_id), UNIQUE(tenant,document_id,revision),
    FOREIGN KEY(tenant,document_id,revision) REFERENCES aether_store.revisions(tenant,document_id,revision)
);
CREATE TABLE aether_store.audit (
    tenant text NOT NULL, operation_id text NOT NULL, document_id text NOT NULL,
    revision bigint NOT NULL, event text NOT NULL, actor text NOT NULL, saved_unix_ms bigint NOT NULL,
    PRIMARY KEY(tenant,operation_id), UNIQUE(tenant,document_id,revision),
    FOREIGN KEY(tenant,operation_id) REFERENCES aether_store.operations(tenant,operation_id),
    FOREIGN KEY(tenant,document_id,revision) REFERENCES aether_store.revisions(tenant,document_id,revision)
);
