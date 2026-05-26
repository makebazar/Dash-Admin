-- Add desktop_completion_mode column to club_maintenance_settings
ALTER TABLE club_maintenance_settings 
ADD COLUMN IF NOT EXISTS desktop_completion_mode VARCHAR(50) NOT NULL DEFAULT 'QR';
