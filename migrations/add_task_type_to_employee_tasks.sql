ALTER TABLE employee_tasks ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'GENERAL';

ALTER TABLE equipment_performance_logs ADD COLUMN IF NOT EXISTS employee_task_id UUID REFERENCES employee_tasks(id) ON DELETE SET NULL;
