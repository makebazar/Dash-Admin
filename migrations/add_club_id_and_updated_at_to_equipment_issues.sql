-- Align equipment_issues schema with app expectations (idempotent, safe on mixed environments)
-- Note: keep this migration "pg driver friendly" (avoid nested dollar-quoting inside EXECUTE).

-- Helper trigger function used across the project (safe to create/replace).
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

DO $do$
BEGIN
    IF to_regclass('public.equipment_issues') IS NULL THEN
        RAISE NOTICE 'equipment_issues table not found, skipping';
        RETURN;
    END IF;

    EXECUTE 'ALTER TABLE public.equipment_issues ADD COLUMN IF NOT EXISTS club_id INTEGER';
    EXECUTE 'ALTER TABLE public.equipment_issues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP';

    -- Backfill club_id from equipment for existing rows (if equipment exists).
    IF to_regclass('public.equipment') IS NOT NULL THEN
        EXECUTE '
            UPDATE public.equipment_issues i
            SET club_id = e.club_id
            FROM public.equipment e
            WHERE i.club_id IS NULL AND i.equipment_id = e.id
        ';
    END IF;

    -- Backfill updated_at for existing rows if column existed before without default.
    EXECUTE 'UPDATE public.equipment_issues SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)';

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_equipment_issues_club ON public.equipment_issues(club_id)';

    -- Ensure updated_at is maintained on updates (recreate trigger idempotently).
    EXECUTE 'DROP TRIGGER IF EXISTS update_equipment_issues_updated_at ON public.equipment_issues';
    EXECUTE 'CREATE TRIGGER update_equipment_issues_updated_at BEFORE UPDATE ON public.equipment_issues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
END;
$do$;
