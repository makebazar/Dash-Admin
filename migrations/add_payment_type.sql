-- Add payment type to distinguish advance from full salary
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) DEFAULT 'salary';

-- Add check constraint
ALTER TABLE payments 
ADD CONSTRAINT check_payment_type 
CHECK (payment_type IN ('advance', 'salary'));

COMMENT ON COLUMN payments.payment_type IS 'advance = аванс (без заморозки KPI), salary = зарплата (с заморозкой)';
