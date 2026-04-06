ALTER TABLE shift_zone_snapshots
ADD COLUMN IF NOT EXISTS accepted_from_shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS accepted_from_employee_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shift_zone_snapshots_accepted_from_shift
    ON shift_zone_snapshots(accepted_from_shift_id);
