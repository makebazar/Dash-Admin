-- Add maintenance_enabled flag to equipment
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS maintenance_enabled BOOLEAN DEFAULT TRUE;

-- Create table for storing per-club equipment instructions
CREATE TABLE IF NOT EXISTS club_equipment_instructions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    equipment_type_code TEXT REFERENCES equipment_types(code) ON DELETE CASCADE,
    instructions TEXT, -- HTML content from Rich Text Editor
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(club_id, equipment_type_code)
);

-- Add column to link issues to maintenance tasks (optional but good for traceability)
ALTER TABLE equipment_issues
ADD COLUMN IF NOT EXISTS maintenance_task_id UUID REFERENCES equipment_maintenance_tasks(id) ON DELETE SET NULL;

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_issues_maintenance_task ON equipment_issues(maintenance_task_id);
