-- Studio-owned labels for immutable revisions. Label edits never rewrite content.
CREATE TABLE aether_access.named_versions (
    tenant text NOT NULL, document_id text NOT NULL,
    name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 80),
    revision bigint NOT NULL, author text NOT NULL,
    created double precision NOT NULL CHECK(created>=0 AND created<'Infinity'::double precision),
    message text NOT NULL CHECK(char_length(message)<=500),
    status text NOT NULL CHECK(status IN ('version','candidate','released','obsolete')),
    origin text NOT NULL CHECK(origin IN ('user','automatic')),
    status_updated double precision NOT NULL CHECK(status_updated>=0 AND status_updated<'Infinity'::double precision),
    status_note text NOT NULL CHECK(char_length(status_note)<=500),
    branch text NOT NULL CHECK(branch='Main'),
    PRIMARY KEY(tenant,document_id,name),
    FOREIGN KEY(tenant,document_id,revision) REFERENCES aether_store.revisions(tenant,document_id,revision),
    FOREIGN KEY(tenant,author) REFERENCES aether_identity.users(tenant,id)
);
CREATE TABLE aether_access.version_receipts (
    tenant text NOT NULL, actor text NOT NULL, operation_id text NOT NULL,
    request jsonb NOT NULL, response jsonb NOT NULL,
    PRIMARY KEY(tenant,actor,operation_id),
    FOREIGN KEY(tenant,actor) REFERENCES aether_identity.users(tenant,id)
);
CREATE TABLE aether_access.version_events (
    tenant text NOT NULL, actor text NOT NULL, operation_id text NOT NULL,
    document_id text NOT NULL, before_state jsonb NOT NULL, after_state jsonb NOT NULL,
    happened_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(tenant,actor,operation_id),
    FOREIGN KEY(tenant,actor,operation_id) REFERENCES aether_access.version_receipts(tenant,actor,operation_id),
    FOREIGN KEY(tenant,document_id) REFERENCES aether_store.documents(tenant,id)
);
