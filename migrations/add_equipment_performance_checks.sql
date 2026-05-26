-- Add performance_instructions to club_equipment_instructions
ALTER TABLE club_equipment_instructions
ADD COLUMN IF NOT EXISTS performance_instructions TEXT;

-- Create table for custom performance metrics defined by the club
CREATE TABLE IF NOT EXISTS club_equipment_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    equipment_type_code TEXT REFERENCES equipment_types(code) ON DELETE CASCADE,
    name TEXT NOT NULL,          -- e.g., "CPU Temperature", "FPS in CS2"
    unit TEXT,                   -- e.g., "°C", "fps", "%"
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_club_perf_metrics_club ON club_equipment_performance_metrics(club_id);
CREATE INDEX IF NOT EXISTS idx_club_perf_metrics_type ON club_equipment_performance_metrics(equipment_type_code);

-- Create table for logging performance check results
CREATE TABLE IF NOT EXISTS equipment_performance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    maintenance_task_id UUID REFERENCES equipment_maintenance_tasks(id) ON DELETE SET NULL,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Store the actual measurements as JSONB for flexibility since metrics are dynamic
    -- Format: {"metric_id": "value", "metric_id_2": "value_2"}
    metrics_data JSONB NOT NULL DEFAULT '{}'::jsonb,

    notes TEXT,
    recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_equip_perf_logs_equipment ON equipment_performance_logs(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equip_perf_logs_club ON equipment_performance_logs(club_id);
CREATE INDEX IF NOT EXISTS idx_equip_perf_logs_task ON equipment_performance_logs(maintenance_task_id);
CREATE INDEX IF NOT EXISTS idx_equip_perf_logs_date ON equipment_performance_logs(recorded_at);
