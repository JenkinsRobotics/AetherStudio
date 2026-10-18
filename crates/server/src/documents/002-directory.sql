-- Frozen access migration 2. Existing locations and permission rules stay intact.
ALTER TABLE aether_access.organizations ADD COLUMN name text NOT NULL DEFAULT '';
ALTER TABLE aether_access.workspaces ADD COLUMN name text NOT NULL DEFAULT '';
UPDATE aether_access.organizations SET name=id;
UPDATE aether_access.workspaces SET name=id;
CREATE INDEX directory_members ON aether_access.members(tenant,user_id,organization);
CREATE INDEX directory_workspaces ON aether_access.workspaces(tenant,organization,id COLLATE "C");
