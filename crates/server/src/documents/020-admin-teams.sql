-- Keep display labels separate so original positional team imports remain valid.
CREATE TABLE aether_access.team_labels (
    tenant text NOT NULL, team text NOT NULL, name text NOT NULL,
    PRIMARY KEY(tenant,team), UNIQUE(tenant,name),
    FOREIGN KEY(tenant,team) REFERENCES aether_access.teams(tenant,id) ON DELETE CASCADE
);
