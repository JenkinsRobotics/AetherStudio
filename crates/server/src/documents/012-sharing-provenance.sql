-- Optional facts about current direct grants. Unknown historical facts stay NULL.
-- This is metadata for grants, not an independent permission authority.
CREATE TABLE aether_access.grant_provenance(
 tenant text NOT NULL,
 resource text NOT NULL,
 user_id text NOT NULL,
 shared_by text,
 shared_at double precision CHECK(shared_at>=0 AND shared_at<'Infinity'::double precision),
 PRIMARY KEY(tenant,resource,user_id),
 FOREIGN KEY(tenant,resource,user_id) REFERENCES aether_access.grants(tenant,resource,user_id) ON DELETE CASCADE,
 FOREIGN KEY(tenant,shared_by) REFERENCES aether_identity.users(tenant,id)
);
