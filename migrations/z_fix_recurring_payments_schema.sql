-- Fix Migration: Ensure recurring_payments table exists
-- This migration fixes issues where the table might not have been created due to migration ordering conflicts

CREATE TABLE IF NOT EXISTS recurring_payments (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES finance_categories(id),
    name VARCHAR(200) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    
    -- Recurrence settings
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    interval INTEGER DEFAULT 1,
    day_of_month INTEGER,
    day_of_week INTEGER,
    
    -- Advanced split payments
    has_split BOOLEAN DEFAULT FALSE,
    split_config JSONB,
    
    payment_method VARCHAR(30) DEFAULT 'cash',
    start_date DATE NOT NULL,
    end_date DATE,
    
    -- Consumption settings (Ensuring these columns exist)
    account_id INTEGER REFERENCES finance_accounts(id),
    is_consumption_based BOOLEAN DEFAULT FALSE,
    consumption_unit VARCHAR(20),
    default_unit_price DECIMAL(12, 2),
    
    is_active BOOLEAN DEFAULT TRUE,
    last_generated_date DATE,
    next_generation_date DATE,
    
    description TEXT,
    notes TEXT,
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_recurring_payments_club ON recurring_payments(club_id);
CREATE INDEX IF NOT EXISTS idx_recurring_payments_active ON recurring_payments(club_id, is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_payments_next_gen ON recurring_payments(next_generation_date);

-- Ensure trigger exists
DROP TRIGGER IF EXISTS update_recurring_payments_updated_at ON recurring_payments;
CREATE TRIGGER update_recurring_payments_updated_at BEFORE UPDATE ON recurring_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
