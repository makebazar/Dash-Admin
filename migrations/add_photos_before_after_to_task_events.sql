ALTER TABLE equipment_maintenance_task_events
ADD COLUMN IF NOT EXISTS photos_before TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS photos_after TEXT[] DEFAULT '{}';
