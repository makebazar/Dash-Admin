-- Migration: Create tables for PC maintenance tracking

-- Use uuid-ossp to avoid depending on pgcrypto/gen_random_uuid().
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS club_workstations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    zone TEXT DEFAULT 'General',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pc_maintenance_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workstation_id UUID REFERENCES club_workstations(id) ON DELETE CASCADE,
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    status TEXT DEFAULT 'PENDING', -- PENDING, COMPLETED
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    UNIQUE(workstation_id, month, year)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_workstations_club_id ON club_workstations(club_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_date ON pc_maintenance_tasks(year, month);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_user ON pc_maintenance_tasks(assigned_user_id);
