-- Collaboration is Studio metadata. Its revisions never advance product content.
CREATE TABLE aether_access.collaboration_heads (
 tenant text NOT NULL, document_id text NOT NULL,
 revision bigint NOT NULL CHECK(revision BETWEEN 1 AND 4294967295),
 PRIMARY KEY(tenant,document_id),
 FOREIGN KEY(tenant,document_id) REFERENCES aether_store.documents(tenant,id)
);
CREATE TABLE aether_access.collaboration_items (
 tenant text NOT NULL, document_id text NOT NULL,
 collection text NOT NULL CHECK(collection IN ('comments','tasks','reminders','notes')),
 item_id text NOT NULL, position integer NOT NULL CHECK(position BETWEEN 0 AND 4999),
 value jsonb NOT NULL CHECK(jsonb_typeof(value)='object'),
 PRIMARY KEY(tenant,document_id,collection,item_id),
 UNIQUE(tenant,document_id,collection,position),
 FOREIGN KEY(tenant,document_id) REFERENCES aether_access.collaboration_heads(tenant,document_id)
);
CREATE TABLE aether_access.collaboration_receipts (
 tenant text NOT NULL, actor text NOT NULL, operation_id text NOT NULL,
 document_id text NOT NULL, request jsonb NOT NULL,
 applied_revision bigint NOT NULL CHECK(applied_revision BETWEEN 1 AND 4294967295),
 editor_required boolean NOT NULL,
 PRIMARY KEY(tenant,actor,operation_id),
 FOREIGN KEY(tenant,actor) REFERENCES aether_identity.users(tenant,id),
 FOREIGN KEY(tenant,document_id) REFERENCES aether_store.documents(tenant,id)
);
CREATE TABLE aether_access.collaboration_events (
 tenant text NOT NULL, document_id text NOT NULL, revision bigint NOT NULL CHECK(revision BETWEEN 1 AND 4294967295),
 actor text NOT NULL, created double precision NOT NULL CHECK(created>=0 AND created<'Infinity'::double precision),
 collection text NOT NULL CHECK(collection IN ('comments','tasks','reminders','notes')),
 operation text NOT NULL CHECK(operation IN ('add','update','delete')),
 item_id text NOT NULL, before_state jsonb NOT NULL CHECK(jsonb_typeof(before_state) IN ('object','null')), after_state jsonb NOT NULL CHECK(jsonb_typeof(after_state)='object'),
 operation_id text,
 PRIMARY KEY(tenant,document_id,revision),
 FOREIGN KEY(tenant,document_id) REFERENCES aether_access.collaboration_heads(tenant,document_id),
 FOREIGN KEY(tenant,actor) REFERENCES aether_identity.users(tenant,id),
 FOREIGN KEY(tenant,actor,operation_id) REFERENCES aether_access.collaboration_receipts(tenant,actor,operation_id)
);
