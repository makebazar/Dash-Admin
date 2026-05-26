-- Add photo before and after settings to general maintenance settings
ALTER TABLE club_maintenance_settings
ADD COLUMN IF NOT EXISTS require_photo_before BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS min_photos_before INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS require_photo_after BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS min_photos_after INTEGER NOT NULL DEFAULT 1;

-- Sync existing data
UPDATE club_maintenance_settings
SET require_photo_after = require_photos_on_completion,
    min_photos_after = min_photos;
