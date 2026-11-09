ALTER TABLE club_workstations
ADD COLUMN IF NOT EXISTS is_available_to_all BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_workstations_is_available_to_all ON club_workstations(is_available_to_all) WHERE is_available_to_all = TRUE;
