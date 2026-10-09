-- Add SmartShell shift tracking columns to shifts table
ALTER TABLE shifts
ADD COLUMN IF NOT EXISTS smartshell_shift_id BIGINT UNIQUE,
ADD COLUMN IF NOT EXISTS smartshell_synced_at TIMESTAMP;
