-- Only folders own names here; document names remain in canonical revisions.
ALTER TABLE aether_access.resources ADD COLUMN folder_name text;
UPDATE aether_access.resources SET folder_name=id WHERE kind='folder';
ALTER TABLE aether_access.resources ADD CONSTRAINT folder_name_kind CHECK(folder_name IS NULL OR kind='folder');
CREATE INDEX browse_children ON aether_access.resources(tenant,organization,workspace,parent,id COLLATE "C") WHERE NOT trashed;
