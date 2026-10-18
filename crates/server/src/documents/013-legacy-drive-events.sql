-- Exact original Drive journal. Historical facts never grant current access.
CREATE TABLE aether_access.legacy_drive_events (
 tenant text NOT NULL,
 id bigint NOT NULL CHECK(id>0),
 organization text NOT NULL,
 file_id text,
 actor text NOT NULL,
 action text NOT NULL,
 created double precision NOT NULL CHECK(created>=0 AND created<'Infinity'::double precision),
 detail text NOT NULL,
 PRIMARY KEY(tenant,id),
 FOREIGN KEY(tenant,organization) REFERENCES aether_access.organizations(tenant,id),
 FOREIGN KEY(tenant,actor) REFERENCES aether_identity.users(tenant,id),
 FOREIGN KEY(tenant,file_id) REFERENCES aether_access.resources(tenant,id)
);
CREATE INDEX legacy_drive_event_file ON aether_access.legacy_drive_events(tenant,file_id,id DESC);
-- Identify imported folder timestamp markers so they are never displayed as
-- newly observed creation events. No creator is inferred from file ownership.
CREATE TABLE aether_access.legacy_drive_imported_folders (
 tenant text NOT NULL,
 resource text NOT NULL,
 PRIMARY KEY(tenant,resource),
 FOREIGN KEY(tenant,resource) REFERENCES aether_access.resources(tenant,id)
);
