-- Назначение схемы на сотрудника (с UUID для user_id)
CREATE TABLE IF NOT EXISTS employee_salary_assignments (
    id SERIAL PRIMARY KEY,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    scheme_id INTEGER REFERENCES salary_schemes(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(club_id, user_id)
);

-- Индекс
CREATE INDEX IF NOT EXISTS idx_employee_salary_club ON employee_salary_assignments(club_id);
