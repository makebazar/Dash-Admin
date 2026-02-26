-- Add KPI tuning columns
ALTER TABLE maintenance_kpi_config 
ADD COLUMN IF NOT EXISTS overdue_tolerance_days INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS min_efficiency_percent INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS target_efficiency_percent INTEGER DEFAULT 90;

-- Add efficiency columns to maintenance tasks for tracking
ALTER TABLE equipment_maintenance_tasks
ADD COLUMN IF NOT EXISTS applied_kpi_multiplier DECIMAL(3,2) DEFAULT 1.0;