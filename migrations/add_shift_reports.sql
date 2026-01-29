-- Add report columns to shifts table
ALTER TABLE shifts
ADD COLUMN cash_income DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN card_income DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN expenses DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN report_comment TEXT;

-- Add index for easier reporting later
CREATE INDEX idx_shifts_check_in ON shifts(check_in);
