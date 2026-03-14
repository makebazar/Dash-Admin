-- Finance Accounts System
-- Adds proper account management (Касса, Банк, Терминал) to track balances

-- ============================================
-- 1. CREATE FINANCE_ACCOUNTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS finance_accounts (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    account_type VARCHAR(30) NOT NULL CHECK (account_type IN ('cash', 'bank', 'card', 'other')),
    currency VARCHAR(3) DEFAULT 'RUB',
    
    -- Balance tracking
    initial_balance DECIMAL(12, 2) DEFAULT 0,
    current_balance DECIMAL(12, 2) DEFAULT 0,
    
    -- Display settings
    icon VARCHAR(50) DEFAULT '💰',
    color VARCHAR(20) DEFAULT '#3b82f6',
    
    -- Metadata
    bank_name VARCHAR(100),
    account_number VARCHAR(50),
    description TEXT,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(club_id, name)
);

CREATE INDEX IF NOT EXISTS idx_finance_accounts_club ON finance_accounts(club_id);
CREATE INDEX IF NOT EXISTS idx_finance_accounts_active ON finance_accounts(club_id, is_active);

COMMENT ON TABLE finance_accounts IS 'Счета клуба (Касса, Банк, Терминал)';
COMMENT ON COLUMN finance_accounts.account_type IS 'Тип счёта: cash=касса, bank=банк, card=терминал, other=прочее';
COMMENT ON COLUMN finance_accounts.current_balance IS 'Текущий баланс счёта, обновляется автоматически при транзакциях';

-- ============================================
-- 2. ADD ACCOUNT_ID TO TRANSACTIONS
-- ============================================

-- Add account_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'finance_transactions' 
        AND column_name = 'account_id'
    ) THEN
        ALTER TABLE finance_transactions 
        ADD COLUMN account_id INTEGER REFERENCES finance_accounts(id);
        
        CREATE INDEX IF NOT EXISTS idx_finance_transactions_account ON finance_transactions(account_id);
    END IF;
END $$;

COMMENT ON COLUMN finance_transactions.account_id IS 'Счёт с которого/на который проводится транзакция';

-- ============================================
-- 3. CREATE DEFAULT ACCOUNTS FOR EACH CLUB
-- ============================================

-- Insert default accounts for each club
INSERT INTO finance_accounts (club_id, name, account_type, icon, color, initial_balance, current_balance)
SELECT 
    id as club_id,
    'Касса (наличные)' as name,
    'cash' as account_type,
    '💵' as icon,
    '#10b981' as color,
    0 as initial_balance,
    0 as current_balance
FROM clubs
WHERE NOT EXISTS (
    SELECT 1 FROM finance_accounts 
    WHERE finance_accounts.club_id = clubs.id 
    AND finance_accounts.account_type = 'cash'
)
ON CONFLICT (club_id, name) DO NOTHING;

INSERT INTO finance_accounts (club_id, name, account_type, icon, color, initial_balance, current_balance)
SELECT 
    id as club_id,
    'Банковский счёт' as name,
    'bank' as account_type,
    '🏦' as icon,
    '#3b82f6' as color,
    0 as initial_balance,
    0 as current_balance
FROM clubs
WHERE NOT EXISTS (
    SELECT 1 FROM finance_accounts 
    WHERE finance_accounts.club_id = clubs.id 
    AND finance_accounts.account_type = 'bank'
)
ON CONFLICT (club_id, name) DO NOTHING;

INSERT INTO finance_accounts (club_id, name, account_type, icon, color, initial_balance, current_balance)
SELECT 
    id as club_id,
    'Терминал (безнал)' as name,
    'card' as account_type,
    '💳' as icon,
    '#8b5cf6' as color,
    0 as initial_balance,
    0 as current_balance
FROM clubs
WHERE NOT EXISTS (
    SELECT 1 FROM finance_accounts 
    WHERE finance_accounts.club_id = clubs.id 
    AND finance_accounts.account_type = 'card'
)
ON CONFLICT (club_id, name) DO NOTHING;

-- ============================================
-- 4. MIGRATE EXISTING TRANSACTIONS TO ACCOUNTS
-- ============================================

-- Link existing transactions to accounts based on payment_method
UPDATE finance_transactions ft
SET account_id = (
    SELECT fa.id
    FROM finance_accounts fa
    WHERE fa.club_id = ft.club_id
    AND fa.account_type = ft.payment_method
    AND fa.is_active = TRUE
    ORDER BY fa.created_at ASC
    LIMIT 1
)
WHERE ft.account_id IS NULL
AND ft.payment_method IN ('cash', 'bank', 'card');

-- Handle 'bank_transfer' mapped to 'bank' account
UPDATE finance_transactions ft
SET account_id = (
    SELECT fa.id
    FROM finance_accounts fa
    WHERE fa.club_id = ft.club_id
    AND fa.account_type = 'bank'
    AND fa.is_active = TRUE
    ORDER BY fa.created_at ASC
    LIMIT 1
)
WHERE ft.account_id IS NULL
AND ft.payment_method = 'bank_transfer';

-- ============================================
-- 5. RECALCULATE ACCOUNT BALANCES
-- ============================================

-- Calculate current balance for each account based on completed transactions
UPDATE finance_accounts fa
SET current_balance = fa.initial_balance + COALESCE((
    SELECT SUM(
        CASE 
            WHEN ft.type = 'income' THEN ft.amount
            WHEN ft.type = 'expense' THEN -ft.amount
            ELSE 0
        END
    )
    FROM finance_transactions ft
    WHERE ft.account_id = fa.id
    AND ft.status = 'completed'
), 0);

-- ============================================
-- 6. FUNCTION TO UPDATE ACCOUNT BALANCE
-- ============================================

-- Function to automatically update account balance when transaction changes
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- If inserting or updating to completed status
    IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed')) THEN
        IF NEW.account_id IS NOT NULL AND NEW.status = 'completed' THEN
            UPDATE finance_accounts
            SET current_balance = current_balance + 
                CASE 
                    WHEN NEW.type = 'income' THEN NEW.amount
                    WHEN NEW.type = 'expense' THEN -NEW.amount
                    ELSE 0
                END,
                updated_at = NOW()
            WHERE id = NEW.account_id;
        END IF;
    END IF;
    
    -- If updating from completed to another status (cancellation)
    IF (TG_OP = 'UPDATE' AND OLD.status = 'completed' AND NEW.status != 'completed') THEN
        IF OLD.account_id IS NOT NULL THEN
            UPDATE finance_accounts
            SET current_balance = current_balance - 
                CASE 
                    WHEN OLD.type = 'income' THEN OLD.amount
                    WHEN OLD.type = 'expense' THEN -OLD.amount
                    ELSE 0
                END,
                updated_at = NOW()
            WHERE id = OLD.account_id;
        END IF;
    END IF;
    
    -- If deleting completed transaction
    IF (TG_OP = 'DELETE' AND OLD.status = 'completed') THEN
        IF OLD.account_id IS NOT NULL THEN
            UPDATE finance_accounts
            SET current_balance = current_balance - 
                CASE 
                    WHEN OLD.type = 'income' THEN OLD.amount
                    WHEN OLD.type = 'expense' THEN -OLD.amount
                    ELSE 0
                END,
                updated_at = NOW()
            WHERE id = OLD.account_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_account_balance ON finance_transactions;
CREATE TRIGGER trg_update_account_balance
    AFTER INSERT OR UPDATE OR DELETE ON finance_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_account_balance();

COMMENT ON FUNCTION update_account_balance IS 'Автоматически обновляет баланс счёта при изменении транзакций';
