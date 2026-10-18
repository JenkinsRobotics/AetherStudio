-- Frozen migration 3. Existing revision JSON, receipts and checksums are retained.
LOCK TABLE aether_store.documents, aether_store.revisions,
    aether_store.operations, aether_store.audit IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE aether_store.branches (
    tenant text NOT NULL, document_id text NOT NULL, id text NOT NULL,
    name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80 AND name<>'Main'),
    head_revision bigint NOT NULL, created_from bigint NOT NULL,
    actor text NOT NULL, created_operation_id text NOT NULL,
    created_unix_ms bigint NOT NULL CHECK(created_unix_ms>=0),
    message text NOT NULL CHECK(length(message)<=500), deleted boolean NOT NULL DEFAULT false,
    PRIMARY KEY(tenant,document_id,id),
    FOREIGN KEY(tenant,document_id,head_revision)
        REFERENCES aether_store.revisions(tenant,document_id,revision) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY(tenant,document_id,created_from)
        REFERENCES aether_store.revisions(tenant,document_id,revision)
);
-- A deleted branch retains its identity and history, while its name is reusable.
CREATE UNIQUE INDEX active_branch_name ON aether_store.branches(tenant,document_id,name) WHERE NOT deleted;
CREATE TABLE aether_store.branch_operations (
    tenant text NOT NULL, operation_id text NOT NULL, document_id text NOT NULL,
    actor text NOT NULL, fingerprint text NOT NULL, receipt jsonb NOT NULL,
    event text NOT NULL, saved_unix_ms bigint NOT NULL CHECK(saved_unix_ms>=0),
    PRIMARY KEY(tenant,operation_id),
    FOREIGN KEY(tenant,document_id) REFERENCES aether_store.documents(tenant,id)
);
CREATE TABLE aether_store.branch_audit (
    tenant text NOT NULL, operation_id text NOT NULL, document_id text NOT NULL,
    actor text NOT NULL, event text NOT NULL, saved_unix_ms bigint NOT NULL,
    PRIMARY KEY(tenant,operation_id),
    FOREIGN KEY(tenant,operation_id) REFERENCES aether_store.branch_operations(tenant,operation_id),
    FOREIGN KEY(tenant,document_id) REFERENCES aether_store.documents(tenant,id)
);
ALTER TABLE aether_store.branches ADD FOREIGN KEY(tenant,created_operation_id)
    REFERENCES aether_store.branch_operations(tenant,operation_id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX branch_operations_document ON aether_store.branch_operations(tenant,document_id);
