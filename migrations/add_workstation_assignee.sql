ALTER TABLE club_workstations
ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workstations_assigned_user ON club_workstations(assigned_user_id);
