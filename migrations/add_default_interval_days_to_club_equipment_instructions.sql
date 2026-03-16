-- Add default_interval_days to club_equipment_instructions (idempotent)
DO $$
BEGIN
    IF to_regclass('public.club_equipment_instructions') IS NULL THEN
        RAISE NOTICE 'club_equipment_instructions table not found, skipping';
    ELSE
        EXECUTE 'ALTER TABLE club_equipment_instructions ADD COLUMN IF NOT EXISTS default_interval_days INTEGER';
    END IF;
END $$;

