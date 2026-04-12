ALTER TABLE club_signage_devices
ADD COLUMN IF NOT EXISTS current_slide_id VARCHAR(128),
ADD COLUMN IF NOT EXISTS control_action VARCHAR(16),
ADD COLUMN IF NOT EXISTS control_slide_id VARCHAR(128),
ADD COLUMN IF NOT EXISTS control_until TIMESTAMP,
ADD COLUMN IF NOT EXISTS control_updated_at TIMESTAMP;

ALTER TABLE club_signage_devices
DROP CONSTRAINT IF EXISTS club_signage_devices_control_action_check;

ALTER TABLE club_signage_devices
ADD CONSTRAINT club_signage_devices_control_action_check
CHECK (control_action IS NULL OR control_action IN ('jump', 'pause'));

CREATE INDEX IF NOT EXISTS idx_club_signage_devices_control_updated_at
    ON club_signage_devices(control_updated_at DESC);
