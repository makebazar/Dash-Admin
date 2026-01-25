-- Migration: Add employee_shift_schedules table
-- This table stores monthly shift plans for employees

CREATE TABLE IF NOT EXISTS employee_shift_schedules (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL CHECK (year >= 2020),
    planned_shifts INTEGER NOT NULL DEFAULT 20,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(club_id, user_id, month, year)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_employee_shift_schedules_lookup 
ON employee_shift_schedules(club_id, month, year);

-- Add comment
COMMENT ON TABLE employee_shift_schedules IS 'Stores planned monthly shift counts for employees';

