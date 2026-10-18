-- Keep old checkpoint rows/receipts intact. Main retains a null branch identity.
-- `branch` is the creation-time label; projections resolve a named branch by ID.
ALTER TABLE aether_access.named_versions DROP CONSTRAINT named_versions_branch_check;
ALTER TABLE aether_access.named_versions ADD COLUMN branch_id text;
ALTER TABLE aether_access.named_versions ADD CONSTRAINT named_versions_branch_check
 CHECK ((branch_id IS NULL AND branch='Main') OR
        (branch_id IS NOT NULL AND char_length(branch) BETWEEN 1 AND 80 AND branch<>'Main'));
ALTER TABLE aether_access.named_versions ADD CONSTRAINT named_versions_branch_identity
 FOREIGN KEY(tenant,document_id,branch_id) REFERENCES aether_store.branches(tenant,document_id,id);
