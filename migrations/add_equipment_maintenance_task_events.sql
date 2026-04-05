CREATE TABLE IF NOT EXISTS equipment_maintenance_task_events (
    id SERIAL PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES equipment_maintenance_tasks(id) ON DELETE CASCADE,
    cycle_no INTEGER NOT NULL DEFAULT 1,
    event_type VARCHAR(30) NOT NULL,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    note TEXT,
    task_notes TEXT,
    photos TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_task_events_task
ON equipment_maintenance_task_events(task_id, created_at DESC);
