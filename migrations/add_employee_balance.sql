-- Employee Balance System (Виртуальный баланс сотрудников)
-- Позволяет зачислять бонусы на внутренний счёт для игр в клубе

-- 1. Таблица балансов сотрудников
CREATE TABLE IF NOT EXISTS employee_balances (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(10, 2) DEFAULT 0.00,
    currency VARCHAR(20) DEFAULT 'RUB', -- RUB, HOURS, CREDITS
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(club_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_balances_club ON employee_balances(club_id);
CREATE INDEX IF NOT EXISTS idx_employee_balances_user ON employee_balances(user_id);

-- 2. Таблица транзакций баланса (история)
CREATE TABLE IF NOT EXISTS employee_balance_transactions (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL, -- Положительное = начисление, отрицательное = списание
    transaction_type VARCHAR(50) NOT NULL, -- BONUS, SALARY_TRANSFER, GAME_SESSION, ADJUSTMENT, REFUND
    description TEXT,
    reference_type VARCHAR(50), -- payment, shift, manual
    reference_id INTEGER, -- ID связанной записи (payment.id, shift.id и т.д.)
    created_by UUID REFERENCES users(id), -- Кто создал (NULL если автоматически)
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_balance_transactions_club ON employee_balance_transactions(club_id);
CREATE INDEX IF NOT EXISTS idx_balance_transactions_user ON employee_balance_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_transactions_created ON employee_balance_transactions(created_at);

-- 3. Добавляем тип выплаты в payments (если ещё не добавлен)
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS transfer_to_balance BOOLEAN DEFAULT FALSE;

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS balance_transaction_id INTEGER REFERENCES employee_balance_transactions(id);

-- 4. Добавляем комментарий
COMMENT ON TABLE employee_balances IS 'Балансы сотрудников для виртуальных выплат (игры, бонусы)';
COMMENT ON TABLE employee_balance_transactions IS 'История транзакций баланса сотрудников';
COMMENT ON COLUMN employee_balance_transactions.transaction_type IS 'BONUS=премия, SALARY_TRANSFER=перевод зарплаты, GAME_SESSION=списание за игру, ADJUSTMENT=корректировка, REFUND=возврат';

-- 5. Создаём функцию для обновления updated_at
CREATE OR REPLACE FUNCTION update_employee_balance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Триггер для автообновления timestamp
DROP TRIGGER IF EXISTS trg_employee_balance_updated ON employee_balances;
CREATE TRIGGER trg_employee_balance_updated
    BEFORE UPDATE ON employee_balances
    FOR EACH ROW
    EXECUTE FUNCTION update_employee_balance_timestamp();

-- 7. Представление для быстрого просмотра балансов
CREATE OR REPLACE VIEW employee_balances_view AS
SELECT 
    eb.id,
    eb.club_id,
    eb.user_id,
    u.full_name,
    eb.balance,
    eb.currency,
    eb.updated_at,
    (SELECT COALESCE(SUM(amount), 0) 
     FROM employee_balance_transactions 
     WHERE user_id = eb.user_id AND club_id = eb.club_id) as total_accrued
FROM employee_balances eb
JOIN users u ON eb.user_id = u.id;
