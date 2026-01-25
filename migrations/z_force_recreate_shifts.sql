-- FORCE Recreate employee_shift_schedules table
-- Use 'z_' prefix to ensure this runs LAST after potential conflicts

DROP TABLE IF EXISTS employee_shift_schedules CASCADE;

CREATE TABLE employee_shift_schedules (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    planned_shifts INTEGER DEFAULT 20,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(club_id, user_id, month, year)
);

CREATE INDEX idx_ess_club_period ON employee_shift_schedules(club_id, month, year);
