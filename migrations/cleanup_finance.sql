-- Cleanup Finance Tables
-- Removes tables and columns related to Recurring Payments, Scheduled Expenses, and Credits

-- 1. Drop Tables
DROP TABLE IF EXISTS finance_credit_payments CASCADE;
DROP TABLE IF EXISTS finance_credits CASCADE;
DROP TABLE IF EXISTS finance_scheduled_expenses CASCADE;
DROP TABLE IF EXISTS recurring_payments CASCADE;

-- 2. Cleanup Transaction Links
ALTER TABLE finance_transactions 
DROP COLUMN IF EXISTS scheduled_expense_id;

-- 3. Cleanup Reminders Links
ALTER TABLE finance_reminders 
DROP COLUMN IF EXISTS related_recurring_id,
DROP COLUMN IF EXISTS related_credit_id;

-- 4. Drop Functions and Triggers
DROP FUNCTION IF EXISTS update_scheduled_expense_status() CASCADE;
