ALTER TABLE shifts
ADD COLUMN IF NOT EXISTS owner_correction_changes JSONB;
