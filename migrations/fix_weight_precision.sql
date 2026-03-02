-- Increase weight column precision to support values >= 10
-- DECIMAL(3,2) allows max 9.99, we need at least 10.00, so DECIMAL(5,2) is safer
ALTER TABLE evaluation_template_items ALTER COLUMN weight TYPE DECIMAL(5,2);

-- Also update score columns in responses if needed, though they are INTEGER currently
-- But for our proportional logic we might need decimals there too?
-- The user request implies the score displayed is 9.5 etc.
-- Let's check evaluation_responses schema
-- score is INTEGER. We need to change it to DECIMAL to support 9.5
ALTER TABLE evaluation_responses ALTER COLUMN score TYPE DECIMAL(5,2);
