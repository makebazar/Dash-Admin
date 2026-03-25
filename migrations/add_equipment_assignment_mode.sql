DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'equipment'
          AND column_name = 'assignment_mode'
    ) THEN
        ALTER TABLE equipment
        ADD COLUMN assignment_mode TEXT NOT NULL DEFAULT 'DIRECT';
    END IF;

    UPDATE equipment
    SET assignment_mode = 'DIRECT'
    WHERE assignment_mode IS NULL;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE tablename = 'equipment'
          AND indexname = 'idx_equipment_assignment_mode'
    ) THEN
        CREATE INDEX idx_equipment_assignment_mode ON equipment(assignment_mode);
    END IF;
END $$;
