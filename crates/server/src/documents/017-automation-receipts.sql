-- Command results share the content commit; product-generated IDs replay exactly.
CREATE TABLE aether_access.automation_receipts (
 tenant text NOT NULL, actor text NOT NULL, operation_id text NOT NULL,
 fingerprint text NOT NULL CHECK(length(fingerprint)=64),
 document_id text NOT NULL, response jsonb NOT NULL CHECK(octet_length(response::text)<=8388608),
 PRIMARY KEY(tenant,actor,operation_id),
 FOREIGN KEY(tenant,actor) REFERENCES aether_identity.users(tenant,id),
 FOREIGN KEY(tenant,document_id) REFERENCES aether_store.documents(tenant,id)
);
