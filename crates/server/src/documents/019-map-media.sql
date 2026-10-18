-- Immutable names and manifests. Bytes use the existing tenant object store.
CREATE TABLE aether_access.map_media (
 tenant text NOT NULL, name text NOT NULL, owner text NOT NULL,
 size bigint NOT NULL CHECK(size BETWEEN 1 AND 536870912),
 digest text NOT NULL CHECK(length(digest)=64), chunks jsonb NOT NULL,
 deleted boolean NOT NULL DEFAULT false,
 PRIMARY KEY(tenant,name),
 FOREIGN KEY(tenant,owner) REFERENCES aether_identity.users(tenant,id)
);
CREATE INDEX map_media_owner ON aether_access.map_media(tenant,owner);
-- Monotonic retention across Main, branches and immutable revision history.
CREATE TABLE aether_access.map_media_refs (
 tenant text NOT NULL, document text NOT NULL, name text NOT NULL,
 PRIMARY KEY(tenant,document,name),
 FOREIGN KEY(tenant,document) REFERENCES aether_store.documents(tenant,id),
 FOREIGN KEY(tenant,name) REFERENCES aether_access.map_media(tenant,name)
);
CREATE INDEX map_media_refs_name ON aether_access.map_media_refs(tenant,name);
