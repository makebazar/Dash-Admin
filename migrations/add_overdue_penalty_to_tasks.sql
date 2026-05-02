-- Add overdue_penalty column to track penalty applied at task completion
ALTER TABLE equipment_maintenance_tasks
ADD COLUMN IF NOT EXISTS overdue_penalty DECIMAL(10,2) DEFAULT 0;
