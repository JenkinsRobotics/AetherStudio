-- Presence expires quickly; delivered actions are durable, never requeued.
CREATE TABLE aether_access.live_editors (
 tenant text NOT NULL, id text NOT NULL, owner text NOT NULL,
 document text NOT NULL, app text NOT NULL, context text NOT NULL,
 secret_hash bytea NOT NULL, tools jsonb NOT NULL,
 expires timestamptz NOT NULL, closed boolean NOT NULL DEFAULT false,
 PRIMARY KEY(tenant,id),
 FOREIGN KEY(tenant,owner) REFERENCES aether_identity.users(tenant,id)
);
CREATE TABLE aether_access.live_editor_calls (
 tenant text NOT NULL, editor text NOT NULL, operation text NOT NULL,
 grant_id text NOT NULL, name text NOT NULL, arguments jsonb NOT NULL,
 state text NOT NULL CHECK(state IN ('queued','running','completed','cancelled')),
 reply jsonb, created timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires timestamptz NOT NULL DEFAULT clock_timestamp()+interval '2 minutes',
 PRIMARY KEY(tenant,editor,operation),
 FOREIGN KEY(tenant,editor) REFERENCES aether_access.live_editors(tenant,id),
 FOREIGN KEY(tenant,grant_id) REFERENCES aether_identity.agent_connections(tenant,id)
);
CREATE INDEX live_editor_owner ON aether_access.live_editors(tenant,owner,expires);
