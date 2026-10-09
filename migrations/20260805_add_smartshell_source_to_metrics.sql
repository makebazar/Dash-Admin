-- Add smartshell_source mapping column to club_custom_metrics table
ALTER TABLE club_custom_metrics
ADD COLUMN IF NOT EXISTS smartshell_source TEXT;
