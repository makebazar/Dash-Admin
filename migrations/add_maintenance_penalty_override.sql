-- Add penalty override fields to equipment_maintenance_tasks
ALTER TABLE equipment_maintenance_tasks
ADD COLUMN IF NOT EXISTS penalty_override_status VARCHAR(20) DEFAULT 'DEFAULT',
ADD COLUMN IF NOT EXISTS penalty_override_amount NUMERIC(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS penalty_override_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS penalty_override_by UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS penalty_override_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
