-- Service credentials share delegated authority, never browser sessions.
ALTER TABLE aether_identity.agent_connections ADD COLUMN kind text NOT NULL DEFAULT 'agent' CHECK(kind IN ('agent','service'));
CREATE UNIQUE INDEX service_connection_name ON aether_identity.agent_connections(tenant,label) WHERE kind='service';
