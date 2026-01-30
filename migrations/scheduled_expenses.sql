-- Migration: Advanced Fixed Expenses Management
-- Adds scheduled expense instances and links them to transactions

-- 1. CREATE SCHEDULED EXPENSES TABLE
CREATE TABLE IF NOT EXISTS finance_scheduled_expenses (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES finance_categories(id),
    name VARCHAR(200) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    due_date DATE NOT NULL,
    
    is_consumption_based BOOLEAN DEFAULT FALSE,
    consumption_unit VARCHAR(20),
    consumption_value DECIMAL(12, 2),
    unit_price DECIMAL(12, 2),

    status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'cancelled')),
    recurring_payment_id INTEGER REFERENCES recurring_payments(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fse_club_date ON finance_scheduled_expenses(club_id, due_date);
CREATE INDEX IF NOT EXISTS idx_fse_status ON finance_scheduled_expenses(club_id, status);

-- 2. ADD LINK TO TRANSACTIONS
ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS scheduled_expense_id INTEGER REFERENCES finance_scheduled_expenses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ft_scheduled_expense ON finance_transactions(scheduled_expense_id);

-- 3. UTILITY TRIGGERS
DROP TRIGGER IF EXISTS update_finance_scheduled_expenses_updated_at ON finance_scheduled_expenses;
CREATE TRIGGER update_finance_scheduled_expenses_updated_at BEFORE UPDATE ON finance_scheduled_expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. FUNCTION TO UPDATE SCHEDULED EXPENSE STATUS
CREATE OR REPLACE FUNCTION update_scheduled_expense_status()
RETURNS TRIGGER AS $$
DECLARE
    total_paid DECIMAL(12, 2);
    expense_amount DECIMAL(12, 2);
BEGIN
    -- Only act if scheduled_expense_id is present
    IF (NEW.scheduled_expense_id IS NOT NULL) OR (OLD.scheduled_expense_id IS NOT NULL) THEN
        -- Get the affected scheduled expense ID
        DECLARE
            fse_id INTEGER := COALESCE(NEW.scheduled_expense_id, OLD.scheduled_expense_id);
        BEGIN
            -- Calculate total paid for this instance
            SELECT COALESCE(SUM(amount), 0) INTO total_paid
            FROM finance_transactions
            WHERE scheduled_expense_id = fse_id AND status = 'completed';

            -- Get target amount
            SELECT amount INTO expense_amount
            FROM finance_scheduled_expenses
            WHERE id = fse_id;

            -- Update status
            UPDATE finance_scheduled_expenses
            SET status = CASE 
                WHEN total_paid >= expense_amount THEN 'paid'
                WHEN total_paid > 0 THEN 'partial'
                ELSE 'unpaid'
            END
            WHERE id = fse_id;
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to transactions
DROP TRIGGER IF EXISTS trg_update_scheduled_expense_status ON finance_transactions;
CREATE TRIGGER trg_update_scheduled_expense_status
    AFTER INSERT OR UPDATE OR DELETE ON finance_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_scheduled_expense_status();

COMMENT ON TABLE finance_scheduled_expenses IS 'Экземпляры ежемесячных расходов для отслеживания оплаты';
