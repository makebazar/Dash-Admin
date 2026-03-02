-- Добавляем тип выплаты для бонусов (реальные деньги или виртуальный баланс)
-- Позволяет выбирать, как начислять бонусы сотрудникам
-- ЗАВИСИМОСТИ: migrations/add_employee_balance.sql должен быть применён первым

-- 1. Добавляем payout_type в bonuses внутри JSONB formula
-- Это поле будет храниться в структуре каждого бонуса
-- Значения: 'REAL_MONEY' (по умолчанию) или 'VIRTUAL_BALANCE'

-- 2. Добавляем payout_type в period_bonuses
-- Для обратной совместимости старые бонусы считаются как REAL_MONEY

-- 3. Создаём таблицу для хранения настроек виртуального баланса клуба
CREATE TABLE IF NOT EXISTS club_virtual_balance_settings (
    id SERIAL PRIMARY KEY,
    club_id INTEGER UNIQUE NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT true,
    currency_type VARCHAR(20) DEFAULT 'RUB', -- RUB, HOURS, CREDITS
    min_balance_for_transfer DECIMAL(10, 2) DEFAULT 0, -- Минимальный баланс для вывода
    auto_convert_on_hire BOOLEAN DEFAULT false, -- Автоматически зачислять баланс при найме
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE club_virtual_balance_settings IS 'Настройки системы виртуального баланса для клуба';
COMMENT ON COLUMN club_virtual_balance_settings.currency_type IS 'RUB=рубли, HOURS=часы игры, CREDITS=кредиты';

-- 4. Добавляем триггер для автообновления updated_at
CREATE OR REPLACE FUNCTION update_club_virtual_balance_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_club_virtual_balance_settings_updated ON club_virtual_balance_settings;
CREATE TRIGGER trg_club_virtual_balance_settings_updated
    BEFORE UPDATE ON club_virtual_balance_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_club_virtual_balance_settings_timestamp();

-- 5. Добавляем поля в employee_balance_transactions для связи с бонусами
ALTER TABLE employee_balance_transactions
ADD COLUMN IF NOT EXISTS bonus_type VARCHAR(50), -- Тип бонуса из salary scheme (CHECKLIST_BONUS, MAINTENANCE_KPI, etc.)

ADD COLUMN IF NOT EXISTS payout_type VARCHAR(20) DEFAULT 'REAL_MONEY', -- REAL_MONEY или VIRTUAL_BALANCE

ADD COLUMN IF NOT EXISTS shift_id INTEGER; -- Связь со сменой (shift_reports.id или shifts.id)

-- 6. Индексы для ускорения выборки
CREATE INDEX IF NOT EXISTS idx_balance_transactions_payout_type 
ON employee_balance_transactions(payout_type);

CREATE INDEX IF NOT EXISTS idx_balance_transactions_shift_id
ON employee_balance_transactions(shift_id);

CREATE INDEX IF NOT EXISTS idx_balance_transactions_bonus_type
ON employee_balance_transactions(bonus_type);

-- 7. Представление для просмотра начислений по типам выплат
CREATE OR REPLACE VIEW employee_balance_summary AS
SELECT
    eb.id,
    eb.club_id,
    eb.user_id,
    u.full_name,
    eb.balance,
    eb.currency,
    eb.updated_at,
    COALESCE(real.total_real_money, 0) as total_real_money,
    COALESCE(virt.total_virtual_balance, 0) as total_virtual_balance,
    COALESCE(real.count_real_money, 0) as count_real_money,
    COALESCE(virt.count_virtual_balance, 0) as count_virtual_balance
FROM employee_balances eb
JOIN users u ON eb.user_id = u.id
LEFT JOIN (
    SELECT
        user_id,
        club_id,
        SUM(amount) FILTER (WHERE payout_type = 'REAL_MONEY') as total_real_money,
        COUNT(*) FILTER (WHERE payout_type = 'REAL_MONEY') as count_real_money
    FROM employee_balance_transactions
    WHERE amount > 0
    GROUP BY user_id, club_id
) real ON eb.user_id = real.user_id AND eb.club_id = real.club_id
LEFT JOIN (
    SELECT
        user_id,
        club_id,
        SUM(amount) FILTER (WHERE payout_type = 'VIRTUAL_BALANCE') as total_virtual_balance,
        COUNT(*) FILTER (WHERE payout_type = 'VIRTUAL_BALANCE') as count_virtual_balance
    FROM employee_balance_transactions
    WHERE amount > 0
    GROUP BY user_id, club_id
) virt ON eb.user_id = virt.user_id AND eb.club_id = virt.club_id;

COMMENT ON VIEW employee_balance_summary IS 'Сводка по балансам сотрудников с разделением по типам выплат';
