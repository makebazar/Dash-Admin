ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_customizable BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS club_role_settings (
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    employee_access_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(club_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_club_role_settings_club_id ON club_role_settings(club_id);
