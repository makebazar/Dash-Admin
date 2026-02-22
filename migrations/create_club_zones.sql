-- Create club_zones table
CREATE TABLE IF NOT EXISTS club_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(club_id, name)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_club_zones_club_id ON club_zones(club_id);

-- Migrate existing zones from club_workstations
INSERT INTO club_zones (club_id, name, assigned_user_id)
SELECT DISTINCT 
    w.club_id, 
    w.zone, 
    w.assigned_user_id 
FROM club_workstations w
WHERE w.zone IS NOT NULL 
ON CONFLICT (club_id, name) DO UPDATE 
SET assigned_user_id = EXCLUDED.assigned_user_id;
