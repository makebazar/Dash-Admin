-- Таблица графиков смен для справедливого расчета KPI
CREATE TABLE IF NOT EXISTS employee_shift_schedules (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
    planned_shifts INTEGER NOT NULL DEFAULT 20 CHECK (planned_shifts >= 0),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, club_id, month, year)
);

-- Индексы для быстрого поиска
CREATE INDEX idx_shift_schedules_user ON employee_shift_schedules(user_id, club_id);
CREATE INDEX idx_shift_schedules_period ON employee_shift_schedules(club_id, month, year);

-- Стандартное количество смен в месяце (если график не заполнен)
ALTER TABLE clubs 
ADD COLUMN IF NOT EXISTS default_monthly_shifts INTEGER DEFAULT 20 CHECK (default_monthly_shifts >= 1);

-- Комментарии
COMMENT ON TABLE employee_shift_schedules IS 'Плановое количество смен для каждого сотрудника на месяц';
COMMENT ON COLUMN employee_shift_schedules.planned_shifts IS 'Количество смен по графику (используется для расчета нормы KPI на смену)';
COMMENT ON COLUMN clubs.default_monthly_shifts IS 'Стандартное количество смен (используется если график не заполнен)';
