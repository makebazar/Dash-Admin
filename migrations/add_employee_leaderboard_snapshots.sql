CREATE TABLE IF NOT EXISTS employee_leaderboard_snapshots (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    score DECIMAL(4, 1) NOT NULL DEFAULT 0,
    revenue_score DECIMAL(4, 1) NOT NULL DEFAULT 0,
    checklist_score DECIMAL(4, 1) NOT NULL DEFAULT 0,
    maintenance_score DECIMAL(4, 1) NOT NULL DEFAULT 0,
    schedule_score DECIMAL(4, 1) NOT NULL DEFAULT 0,
    discipline_score DECIMAL(4, 1) NOT NULL DEFAULT 0,
    revenue_per_shift DECIMAL(12, 2) NOT NULL DEFAULT 0,
    completed_shifts INTEGER NOT NULL DEFAULT 0,
    planned_shifts INTEGER NOT NULL DEFAULT 0,
    total_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
    evaluation_score DECIMAL(5, 2) NOT NULL DEFAULT 0,
    maintenance_tasks_assigned INTEGER NOT NULL DEFAULT 0,
    maintenance_tasks_completed INTEGER NOT NULL DEFAULT 0,
    maintenance_overdue_open_tasks INTEGER NOT NULL DEFAULT 0,
    maintenance_rework_open_tasks INTEGER NOT NULL DEFAULT 0,
    maintenance_stale_rework_tasks INTEGER NOT NULL DEFAULT 0,
    maintenance_overdue_completed_tasks INTEGER NOT NULL DEFAULT 0,
    maintenance_overdue_completed_days INTEGER NOT NULL DEFAULT 0,
    finalized_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (club_id, user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_employee_leaderboard_snapshots_period
ON employee_leaderboard_snapshots(club_id, year, month);

CREATE INDEX IF NOT EXISTS idx_employee_leaderboard_snapshots_rank
ON employee_leaderboard_snapshots(club_id, year, month, rank);
