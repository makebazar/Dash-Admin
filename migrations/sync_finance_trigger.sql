-- Robust Finance Account Balance Trigger
-- Handles: 
-- 1. Insert/Update/Delete transactions (balance update)
-- 2. Changes to account_id (shifting balance between accounts)
-- 3. Status changes (completed vs others)

CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. HANDLE OLD ACCOUNT (if it existed and was completed)
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        IF OLD.account_id IS NOT NULL AND OLD.status = 'completed' THEN
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

    -- 2. HANDLE NEW ACCOUNT (if it exists and is completed)
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
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

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create trigger
DROP TRIGGER IF EXISTS trg_update_account_balance ON finance_transactions;
CREATE TRIGGER trg_update_account_balance
    AFTER INSERT OR UPDATE OR DELETE ON finance_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_account_balance();

COMMENT ON FUNCTION update_account_balance IS 'Автоматически обновляет баланс счёта при любых изменениях транзакций, включая смену счёта';
