ALTER TABLE shift_receipts
ADD COLUMN IF NOT EXISTS salary_target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS salary_target_shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS counts_in_revenue BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE shift_receipts
DROP CONSTRAINT IF EXISTS shift_receipts_payment_type_check;

ALTER TABLE shift_receipts
ADD CONSTRAINT shift_receipts_payment_type_check
CHECK (payment_type IN ('cash', 'card', 'mixed', 'other', 'salary'));

CREATE INDEX IF NOT EXISTS idx_shift_receipts_salary_target_user
    ON shift_receipts(salary_target_user_id);

CREATE INDEX IF NOT EXISTS idx_shift_receipts_counts_in_revenue
    ON shift_receipts(club_id, shift_id, counts_in_revenue);
