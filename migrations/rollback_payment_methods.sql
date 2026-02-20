BEGIN;

-- 1. Restore payment_method column in finance_transactions
ALTER TABLE finance_transactions 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

-- 2. Migrate data back from payment_method_id to payment_method (only if column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'finance_transactions' 
        AND column_name = 'payment_method_id'
    ) THEN
        EXECUTE '
            UPDATE finance_transactions ft
            SET payment_method = (
                SELECT pm.code 
                FROM payment_methods pm 
                WHERE pm.id = ft.payment_method_id
            )
            WHERE payment_method_id IS NOT NULL
        ';
    END IF;
END $$;

-- 3. Drop the FK column
ALTER TABLE finance_transactions 
DROP COLUMN IF EXISTS payment_method_id;

-- 4. Drop tables (cascade will handle FKs)
DROP TABLE IF EXISTS finance_account_mappings CASCADE;
DROP TABLE IF EXISTS payment_methods CASCADE;

-- 5. Drop helper function
DROP FUNCTION IF EXISTS get_account_for_payment_method(INTEGER, VARCHAR);

COMMIT;
