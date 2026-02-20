-- Migration: Create tables for PC maintenance tracking

CREATE TABLE club_workstations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    zone TEXT DEFAULT 'General',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pc_maintenance_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE INDEX idx_workstations_club_id ON club_workstations(club_id);
CREATE INDEX idx_maintenance_tasks_date ON pc_maintenance_tasks(year, month);
CREATE INDEX idx_maintenance_tasks_user ON pc_maintenance_tasks(assigned_user_id);
