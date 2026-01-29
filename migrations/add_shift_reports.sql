-- Add report columns to shifts table
ALTER TABLE shifts
ADD COLUMN IF NOT EXISTS cash_income DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS card_income DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS expenses DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS report_comment TEXT;

-- Add index for easier reporting later
CREATE INDEX idx_shifts_check_in ON shifts(check_in);
