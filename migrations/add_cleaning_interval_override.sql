-- Allow per-equipment cleaning interval overrides without mutating the club standard.
ALTER TABLE equipment
ADD COLUMN IF NOT EXISTS cleaning_interval_override_days INTEGER;

CREATE INDEX IF NOT EXISTS idx_equipment_cleaning_interval_override
ON equipment(cleaning_interval_override_days)
WHERE cleaning_interval_override_days IS NOT NULL;
