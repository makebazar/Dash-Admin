-- Create club_zones table if not exists
CREATE TABLE IF NOT EXISTS club_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(club_id, name)
);

-- Add updated_at to equipment_maintenance_tasks
ALTER TABLE equipment_maintenance_tasks 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- Create trigger for equipment_maintenance_tasks
DROP TRIGGER IF EXISTS update_equipment_maintenance_tasks_updated_at ON equipment_maintenance_tasks;
CREATE TRIGGER update_equipment_maintenance_tasks_updated_at
    BEFORE UPDATE ON equipment_maintenance_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
