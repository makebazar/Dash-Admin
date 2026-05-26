-- Add missing columns to equipment_maintenance_tasks
-- These columns are expected by the API routes but were missing from the schema

DO $$
BEGIN
    -- Add club_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'equipment_maintenance_tasks' AND column_name = 'club_id'
    ) THEN
        ALTER TABLE equipment_maintenance_tasks ADD COLUMN club_id INTEGER;

        -- Backfill club_id from equipment
        UPDATE equipment_maintenance_tasks mt
        SET club_id = e.club_id
        FROM equipment e
        WHERE mt.equipment_id = e.id;

        CREATE INDEX IF NOT EXISTS idx_maint_tasks_club ON equipment_maintenance_tasks(club_id);
    END IF;

    -- Add created_by
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'equipment_maintenance_tasks' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE equipment_maintenance_tasks ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    -- Add cycle_no
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'equipment_maintenance_tasks' AND column_name = 'cycle_no'
    ) THEN
        ALTER TABLE equipment_maintenance_tasks ADD COLUMN cycle_no INTEGER NOT NULL DEFAULT 1;
    END IF;

    -- Add photos
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'equipment_maintenance_tasks' AND column_name = 'photos'
    ) THEN
        ALTER TABLE equipment_maintenance_tasks ADD COLUMN photos TEXT[] DEFAULT '{}';
    END IF;
END $$;
