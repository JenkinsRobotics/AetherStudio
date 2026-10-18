-- Existing Pi players retain their deployment capability. TV receivers are live only.
ALTER TABLE aether_access.map_devices ADD COLUMN kind text NOT NULL DEFAULT 'player'
 CHECK(kind IN ('player','live_receiver'));
ALTER TABLE aether_access.map_devices ADD CONSTRAINT map_device_assignment_kind
 CHECK(kind='player' OR document IS NULL);
