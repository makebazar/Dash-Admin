DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'equipment_maintenance_tasks'
          AND column_name = 'overdue_days_at_completion'
    ) THEN
        ALTER TABLE equipment_maintenance_tasks
        ADD COLUMN overdue_days_at_completion INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'equipment_maintenance_tasks'
          AND column_name = 'was_overdue'
    ) THEN
        ALTER TABLE equipment_maintenance_tasks
        ADD COLUMN was_overdue BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'equipment_maintenance_tasks'
          AND column_name = 'responsible_user_id_at_completion'
    ) THEN
        ALTER TABLE equipment_maintenance_tasks
        ADD COLUMN responsible_user_id_at_completion UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    UPDATE equipment_maintenance_tasks
    SET
        overdue_days_at_completion = GREATEST((COALESCE(completed_at::date, CURRENT_DATE) - due_date), 0),
        was_overdue = GREATEST((COALESCE(completed_at::date, CURRENT_DATE) - due_date), 0) > 0,
        responsible_user_id_at_completion = COALESCE(responsible_user_id_at_completion, assigned_user_id, completed_by)
    WHERE status = 'COMPLETED';
END $$;

CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_responsible_completion
ON equipment_maintenance_tasks (responsible_user_id_at_completion, completed_at)
WHERE status = 'COMPLETED';
