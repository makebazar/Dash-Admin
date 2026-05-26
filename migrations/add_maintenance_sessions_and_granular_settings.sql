-- Step 1: Create Maintenance Sessions table
CREATE TABLE IF NOT EXISTS equipment_maintenance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, CANCELLED
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maint_sessions_club ON equipment_maintenance_sessions(club_id);
CREATE INDEX IF NOT EXISTS idx_maint_sessions_status ON equipment_maintenance_sessions(status);

-- Step 2: Update Equipment Maintenance Tasks table
DO $$
BEGIN
    -- Add session_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='equipment_maintenance_tasks' AND column_name='session_id') THEN
        ALTER TABLE equipment_maintenance_tasks ADD COLUMN session_id UUID REFERENCES equipment_maintenance_sessions(id) ON DELETE SET NULL;
    END IF;

    -- Add photos_before
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='equipment_maintenance_tasks' AND column_name='photos_before') THEN
        ALTER TABLE equipment_maintenance_tasks ADD COLUMN photos_before TEXT[] DEFAULT '{}';
    END IF;

    -- Add photos_after
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='equipment_maintenance_tasks' AND column_name='photos_after') THEN
        ALTER TABLE equipment_maintenance_tasks ADD COLUMN photos_after TEXT[] DEFAULT '{}';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_maint_tasks_session ON equipment_maintenance_tasks(session_id);

-- Step 3: Create Granular Settings table
CREATE TABLE IF NOT EXISTS club_equipment_type_maintenance_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    equipment_type_code VARCHAR(50) NOT NULL REFERENCES equipment_types(code) ON DELETE CASCADE,

    require_photo_before BOOLEAN NOT NULL DEFAULT FALSE,
    min_photos_before INTEGER NOT NULL DEFAULT 0,

    require_photo_after BOOLEAN NOT NULL DEFAULT TRUE,
    min_photos_after INTEGER NOT NULL DEFAULT 1,

    -- ALWAYS, ON_ISSUE, NEVER
    require_comment_mode VARCHAR(20) NOT NULL DEFAULT 'ON_ISSUE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(club_id, equipment_type_code)
);

CREATE INDEX IF NOT EXISTS idx_club_eq_type_maint_settings_club ON club_equipment_type_maintenance_settings(club_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_club_eq_type_maint_settings_updated_at ON club_equipment_type_maintenance_settings;
CREATE TRIGGER update_club_eq_type_maint_settings_updated_at
    BEFORE UPDATE ON club_equipment_type_maintenance_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
