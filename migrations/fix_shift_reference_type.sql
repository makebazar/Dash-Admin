-- Fix related_shift_report_id type mismatch
-- shifts.id is UUID, not INTEGER

ALTER TABLE finance_transactions 
DROP COLUMN IF EXISTS related_shift_report_id;

ALTER TABLE finance_transactions
ADD COLUMN related_shift_report_id UUID REFERENCES shifts(id);

CREATE INDEX idx_finance_transactions_shift ON finance_transactions(related_shift_report_id) WHERE related_shift_report_id IS NOT NULL;
