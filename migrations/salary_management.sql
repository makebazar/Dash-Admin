-- Salary Management Migration
-- Добавляем таблицу выплат и расширяем shifts для хранения расчёта зарплаты

-- 1. Таблица выплат
CREATE TABLE IF NOT EXISTS salary_payments (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('advance', 'salary', 'bonus', 'penalty', 'correction')),
    comment TEXT,
    paid_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для быстрых выборок
CREATE INDEX IF NOT EXISTS idx_salary_payments_club ON salary_payments(club_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_user ON salary_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_paid_at ON salary_payments(paid_at);

-- 2. Расширяем таблицу shifts для хранения расчёта
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS club_id INTEGER REFERENCES clubs(id);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS calculated_salary DECIMAL(10,2);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS salary_breakdown JSONB;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS scheme_version_id INTEGER REFERENCES salary_scheme_versions(id);

-- Комментарии
COMMENT ON TABLE salary_payments IS 'Учёт выплат зарплаты сотрудникам';
COMMENT ON COLUMN salary_payments.payment_type IS 'Тип: advance=аванс, salary=зарплата, bonus=премия, penalty=штраф, correction=корректировка';
COMMENT ON COLUMN shifts.calculated_salary IS 'Рассчитанная зарплата за смену';
COMMENT ON COLUMN shifts.salary_breakdown IS 'Детализация расчёта: {base, bonuses[], penalties[], total}';
