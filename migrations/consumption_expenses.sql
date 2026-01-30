-- Migration: Consumption-based Expenses Support
-- Adds fields to track utility consumption and pricing in recurring templates and scheduled expenses

-- 1. Update recurring_payments table
ALTER TABLE recurring_payments 
ADD COLUMN IF NOT EXISTS is_consumption_based BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS consumption_unit VARCHAR(20),
ADD COLUMN IF NOT EXISTS default_unit_price DECIMAL(12, 2);

-- 2. Update finance_scheduled_expenses table
ALTER TABLE finance_scheduled_expenses
ADD COLUMN IF NOT EXISTS consumption_value DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS unit_price DECIMAL(12, 2);

COMMENT ON COLUMN recurring_payments.is_consumption_based IS 'Флаг: расчет на основе потребления (электричество, вода и т.д.)';
COMMENT ON COLUMN recurring_payments.consumption_unit IS 'Единица измерения (кВт, м3, и т.д.)';
COMMENT ON COLUMN recurring_payments.default_unit_price IS 'Цена за единицу по умолчанию';

COMMENT ON COLUMN finance_scheduled_expenses.consumption_value IS 'Фактическое потребление за период';
COMMENT ON COLUMN finance_scheduled_expenses.unit_price IS 'Цена за единицу для конкретного счета';
