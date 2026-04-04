ALTER TABLE equipment
ADD COLUMN IF NOT EXISTS status TEXT;

UPDATE equipment
SET status = CASE
    WHEN is_active = FALSE THEN 'WRITTEN_OFF'
    WHEN workstation_id IS NULL THEN 'STORAGE'
    ELSE 'ACTIVE'
END
WHERE status IS NULL;

ALTER TABLE equipment
ALTER COLUMN status SET DEFAULT 'STORAGE';

ALTER TABLE equipment
DROP CONSTRAINT IF EXISTS equipment_status_check;

ALTER TABLE equipment
ADD CONSTRAINT equipment_status_check
CHECK (status IN ('ACTIVE', 'STORAGE', 'REPAIR', 'WRITTEN_OFF'));

CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);
