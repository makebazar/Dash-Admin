-- Add block_desktop_access column to club_maintenance_settings
ALTER TABLE club_maintenance_settings ADD COLUMN IF NOT EXISTS block_desktop_access BOOLEAN NOT NULL DEFAULT FALSE;
