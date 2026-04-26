CREATE TABLE IF NOT EXISTS club_maintenance_settings (
    club_id INTEGER PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
    require_photos_on_completion BOOLEAN NOT NULL DEFAULT TRUE,
    min_photos INTEGER NOT NULL DEFAULT 1,
    require_notes_on_completion BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_maintenance_settings_club_id
ON club_maintenance_settings (club_id);

