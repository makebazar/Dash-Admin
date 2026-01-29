-- Custom Payment Methods System
-- Allows clubs to define their own payment methods (СБП, Криптовалюта, etc.)
-- and map them to specific accounts

-- ============================================
-- 1. CREATE PAYMENT_METHODS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS payment_methods (
    id SERIAL PRIMARY KEY,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,  -- NULL = system method
    code VARCHAR(50) NOT NULL,                               -- 'cash', 'card', 'sbp', 'crypto'
    label VARCHAR(100) NOT NULL,                             -- "Наличные", "СБП", "Криптовалюта"
    icon VARCHAR(50) DEFAULT '💰',
    color VARCHAR(20) DEFAULT '#3b82f6',
    is_system BOOLEAN DEFAULT FALSE,                         -- Cannot delete system methods
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(club_id, code)
);

CREATE INDEX idx_payment_methods_club ON payment_methods(club_id);
CREATE INDEX idx_payment_methods_active ON payment_methods(club_id, is_active);

COMMENT ON TABLE payment_methods IS 'Способы оплаты (системные и кастомные для клубов)';
COMMENT ON COLUMN payment_methods.code IS 'Уникальный код способа оплаты';
COMMENT ON COLUMN payment_methods.is_system IS 'Системные методы нельзя удалить';

-- ============================================
-- 2. INSERT SYSTEM PAYMENT METHODS
-- ============================================

INSERT INTO payment_methods (club_id, code, label, icon, color, is_system) VALUES
(NULL, 'cash', 'Наличные', '💵', '#10b981', TRUE),
(NULL, 'card', 'Карта', '💳', '#8b5cf6', TRUE)
ON CONFLICT (club_id, code) DO NOTHING;

-- ============================================
-- 3. MIGRATE EXISTING PAYMENT METHODS FROM TRANSACTIONS
-- ============================================

-- Create club-specific methods from existing transaction data
DO $$
DECLARE
    club_record RECORD;
BEGIN
    FOR club_record IN 
        SELECT DISTINCT club_id, payment_method
        FROM finance_transactions
        WHERE payment_method NOT IN ('cash', 'card')
        AND payment_method IS NOT NULL
    LOOP
        INSERT INTO payment_methods (club_id, code, label, icon, is_system)
        VALUES (
            club_record.club_id,
            club_record.payment_method,
            CASE club_record.payment_method
                WHEN 'bank_transfer' THEN 'Банковский перевод'
                WHEN 'other' THEN 'Прочее'
                ELSE INITCAP(REPLACE(club_record.payment_method, '_', ' '))
            END,
            CASE club_record.payment_method
                WHEN 'bank_transfer' THEN '🏦'
                WHEN 'other' THEN '💰'
                ELSE '💳'
            END,
            FALSE
        )
        ON CONFLICT (club_id, code) DO NOTHING;
    END LOOP;
END $$;

-- ============================================
-- 4. ADD PAYMENT_METHOD_ID TO TRANSACTIONS
-- ============================================

-- Add new column
ALTER TABLE finance_transactions 
ADD COLUMN IF NOT EXISTS payment_method_id INTEGER REFERENCES payment_methods(id);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_payment_method ON finance_transactions(payment_method_id);

-- Migrate existing data
UPDATE finance_transactions ft
SET payment_method_id = (
    SELECT pm.id 
    FROM payment_methods pm
    WHERE pm.code = ft.payment_method
    AND (pm.club_id = ft.club_id OR pm.club_id IS NULL)
    ORDER BY pm.club_id DESC NULLS LAST
    LIMIT 1
)
WHERE ft.payment_method_id IS NULL 
AND ft.payment_method IS NOT NULL;

-- After migration is complete, we can drop the old column
-- (Commenting out for safety - run manually after verification)
-- ALTER TABLE finance_transactions DROP COLUMN payment_method;

COMMENT ON COLUMN finance_transactions.payment_method_id IS 'Способ оплаты (ссылка на payment_methods)';

-- ============================================
-- 5. CREATE ACCOUNT MAPPINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS finance_account_mappings (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    payment_method_id INTEGER NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(club_id, payment_method_id)
);

CREATE INDEX idx_finance_account_mappings_club ON finance_account_mappings(club_id);
CREATE INDEX idx_finance_account_mappings_method ON finance_account_mappings(payment_method_id);

COMMENT ON TABLE finance_account_mappings IS 'Маппинг: какой способ оплаты → на какой счёт';

-- ============================================
-- 6. CREATE DEFAULT MAPPINGS
-- ============================================

-- Map system payment methods to corresponding account types
INSERT INTO finance_account_mappings (club_id, payment_method_id, account_id)
SELECT DISTINCT
    fa.club_id,
    pm.id as payment_method_id,
    fa.id as account_id
FROM finance_accounts fa
JOIN payment_methods pm ON 
    (pm.club_id = fa.club_id OR pm.club_id IS NULL)
    AND pm.code = fa.account_type
WHERE fa.account_type IN ('cash', 'card')
AND fa.is_active = TRUE
ON CONFLICT (club_id, payment_method_id) DO NOTHING;

-- Map bank_transfer to bank accounts
INSERT INTO finance_account_mappings (club_id, payment_method_id, account_id)
SELECT DISTINCT
    fa.club_id,
    pm.id as payment_method_id,
    fa.id as account_id
FROM finance_accounts fa
JOIN payment_methods pm ON pm.club_id = fa.club_id AND pm.code = 'bank_transfer'
WHERE fa.account_type = 'bank'
AND fa.is_active = TRUE
ON CONFLICT (club_id, payment_method_id) DO NOTHING;

-- ============================================
-- 7. HELPER FUNCTION: GET ACCOUNT FOR PAYMENT METHOD
-- ============================================

CREATE OR REPLACE FUNCTION get_account_for_payment_method(
    p_club_id INTEGER,
    p_payment_method_code VARCHAR
) RETURNS INTEGER AS $$
DECLARE
    v_account_id INTEGER;
    v_payment_method_id INTEGER;
BEGIN
    -- Get payment method ID
    SELECT id INTO v_payment_method_id
    FROM payment_methods
    WHERE code = p_payment_method_code
    AND (club_id = p_club_id OR club_id IS NULL)
    ORDER BY club_id DESC NULLS LAST
    LIMIT 1;
    
    IF v_payment_method_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Get mapped account
    SELECT account_id INTO v_account_id
    FROM finance_account_mappings
    WHERE club_id = p_club_id
    AND payment_method_id = v_payment_method_id;
    
    RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_account_for_payment_method IS 'Получить account_id для способа оплаты по коду';
