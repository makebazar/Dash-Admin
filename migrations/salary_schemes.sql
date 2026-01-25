-- Salary Schemes - шаблоны схем оплаты
CREATE TABLE IF NOT EXISTS salary_schemes (
    id SERIAL PRIMARY KEY,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Версии схем - при изменении формулы создаётся новая версия
CREATE TABLE IF NOT EXISTS salary_scheme_versions (
    id SERIAL PRIMARY KEY,
    scheme_id INTEGER REFERENCES salary_schemes(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    formula JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(scheme_id, version)
);

-- Назначение схемы на сотрудника
CREATE TABLE IF NOT EXISTS employee_salary_assignments (
    id SERIAL PRIMARY KEY,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    scheme_id INTEGER REFERENCES salary_schemes(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(club_id, user_id)
);

-- Добавляем поля для расчёта зарплаты в смены
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS salary_calculated DECIMAL(10,2);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS salary_scheme_version_id INTEGER REFERENCES salary_scheme_versions(id);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS salary_breakdown JSONB;

-- Индексы
CREATE INDEX IF NOT EXISTS idx_salary_schemes_club ON salary_schemes(club_id);
CREATE INDEX IF NOT EXISTS idx_salary_scheme_versions_scheme ON salary_scheme_versions(scheme_id);
CREATE INDEX IF NOT EXISTS idx_employee_salary_club ON employee_salary_assignments(club_id);
