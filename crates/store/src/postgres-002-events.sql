-- Frozen migration 2. Version 1 remains byte-for-byte unchanged.
-- Provision in a maintenance window; old writers cannot commit without events
-- after this migration's deferred constraint trigger is installed.
LOCK TABLE aether_store.documents, aether_store.revisions,
    aether_store.operations, aether_store.audit IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE aether_store.event_cursors (
    tenant text PRIMARY KEY,
    last_cursor bigint NOT NULL CHECK(last_cursor >= 0)
);
CREATE TABLE aether_store.document_events (
    tenant text NOT NULL,
    cursor bigint NOT NULL CHECK(cursor > 0),
    document_id text NOT NULL,
    revision bigint NOT NULL,
    kind text NOT NULL CHECK(kind IN ('revision_committed','history_backfill')),
    PRIMARY KEY(tenant,cursor), UNIQUE(tenant,document_id,revision),
    FOREIGN KEY(tenant,document_id,revision)
        REFERENCES aether_store.revisions(tenant,document_id,revision)
);
-- Initial replay has deterministic per-document revision order; it does not
-- pretend to reconstruct the old cross-document commit chronology.
INSERT INTO aether_store.document_events(tenant,cursor,document_id,revision,kind)
SELECT tenant,row_number() OVER (PARTITION BY tenant ORDER BY document_id,revision),
    document_id,revision,'history_backfill' FROM aether_store.revisions;
INSERT INTO aether_store.event_cursors(tenant,last_cursor)
SELECT tenant,max(cursor) FROM aether_store.document_events GROUP BY tenant;
CREATE FUNCTION aether_store.require_revision_event() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM aether_store.document_events
        WHERE tenant=NEW.tenant AND document_id=NEW.document_id AND revision=NEW.revision) THEN
        RAISE EXCEPTION 'Aether revision requires a committed change event';
    END IF;
    RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER revision_has_event
AFTER INSERT ON aether_store.revisions DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION aether_store.require_revision_event();
