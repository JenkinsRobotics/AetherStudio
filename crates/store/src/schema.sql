CREATE TABLE blobs(hash TEXT PRIMARY KEY, content BLOB NOT NULL) STRICT;
CREATE TABLE documents(
    id TEXT PRIMARY KEY, app TEXT NOT NULL, head_revision INTEGER NOT NULL CHECK(head_revision > 0),
    FOREIGN KEY(id, head_revision) REFERENCES revisions(document_id, revision) DEFERRABLE INITIALLY DEFERRED
) STRICT;
CREATE TABLE revisions(
    document_id TEXT NOT NULL REFERENCES documents(id),
    revision INTEGER NOT NULL CHECK(revision > 0),
    blob_hash TEXT NOT NULL REFERENCES blobs(hash), metadata TEXT NOT NULL,
    PRIMARY KEY(document_id, revision)
) STRICT;
CREATE TABLE operations(
    operation_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL,
    document_id TEXT NOT NULL, revision INTEGER NOT NULL, receipt TEXT NOT NULL,
    UNIQUE(document_id, revision),
    FOREIGN KEY(document_id,revision) REFERENCES revisions(document_id,revision)
) STRICT;
CREATE TABLE audit(
    operation_id TEXT PRIMARY KEY REFERENCES operations(operation_id),
    document_id TEXT NOT NULL, revision INTEGER NOT NULL, event TEXT NOT NULL,
    actor TEXT NOT NULL, saved_unix_ms INTEGER NOT NULL,
    UNIQUE(document_id, revision),
    FOREIGN KEY(document_id, revision) REFERENCES revisions(document_id, revision)
) STRICT;
