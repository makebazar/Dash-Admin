-- Align equipment_issues schema with app expectations (idempotent, safe on mixed environments)
DO $$
BEGIN
    IF to_regclass('public.equipment_issues') IS NULL THEN
        RAISE NOTICE 'equipment_issues table not found, skipping';
        RETURN;
    END IF;

    -- Ensure update_updated_at_column() exists (used by triggers)
    IF NOT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.proname = 'update_updated_at_column' AND n.nspname = 'public'
    ) THEN
        EXECUTE $fn$
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql'
        $fn$;
    END IF;

    EXECUTE 'ALTER TABLE equipment_issues ADD COLUMN IF NOT EXISTS club_id INTEGER';
    EXECUTE 'ALTER TABLE equipment_issues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP';

    -- Backfill club_id from equipment for existing rows
    EXECUTE $q$
        UPDATE equipment_issues i
        SET club_id = e.club_id
        FROM equipment e
        WHERE i.club_id IS NULL AND i.equipment_id = e.id
    $q$;

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_equipment_issues_club ON equipment_issues(club_id)';

    -- Ensure updated_at is maintained on updates
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = ''public''
          AND c.relname = ''equipment_issues''
          AND t.tgname = ''update_equipment_issues_updated_at''
          AND NOT t.tgisinternal
    ) THEN
        EXECUTE 'CREATE TRIGGER update_equipment_issues_updated_at BEFORE UPDATE ON equipment_issues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
    END IF;
END $$;

