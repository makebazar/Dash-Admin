-- Remove legacy "Free Pool" system user created by create_free_pool_user_v3.sql.
-- If hard FK constraints prevent deletion, deactivate the user and keep it hidden from UI.

DO $$
DECLARE
  free_user_id UUID;
BEGIN
  SELECT id INTO free_user_id
  FROM users
  WHERE phone_number = '__system_free_pool__'
  LIMIT 1;

  IF free_user_id IS NULL THEN
    SELECT id INTO free_user_id
    FROM users
    WHERE id = '00000000-0000-0000-0000-000000000001'
    LIMIT 1;
  END IF;

  IF free_user_id IS NULL THEN
    RAISE NOTICE 'Free Pool user not found; skipping.';
    RETURN;
  END IF;

  -- Always detach from clubs list first.
  IF to_regclass('public.club_employees') IS NOT NULL THEN
    DELETE FROM club_employees WHERE user_id = free_user_id;
  END IF;

  -- Best-effort cleanup of common nullable references (only if table/column exists).
  IF to_regclass('public.equipment') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='equipment' AND column_name='assigned_user_id') THEN
      EXECUTE 'UPDATE equipment SET assigned_user_id = NULL WHERE assigned_user_id = $1' USING free_user_id;
    END IF;
  END IF;

  IF to_regclass('public.club_workstations') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='club_workstations' AND column_name='assigned_user_id') THEN
      EXECUTE 'UPDATE club_workstations SET assigned_user_id = NULL WHERE assigned_user_id = $1' USING free_user_id;
    END IF;
  END IF;

  IF to_regclass('public.club_zones') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='club_zones' AND column_name='assigned_user_id') THEN
      EXECUTE 'UPDATE club_zones SET assigned_user_id = NULL WHERE assigned_user_id = $1' USING free_user_id;
    END IF;
  END IF;

  IF to_regclass('public.equipment_maintenance_tasks') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='equipment_maintenance_tasks' AND column_name='assigned_user_id') THEN
      EXECUTE 'UPDATE equipment_maintenance_tasks SET assigned_user_id = NULL WHERE assigned_user_id = $1' USING free_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='equipment_maintenance_tasks' AND column_name='completed_by') THEN
      EXECUTE 'UPDATE equipment_maintenance_tasks SET completed_by = NULL WHERE completed_by = $1' USING free_user_id;
    END IF;
  END IF;

  IF to_regclass('public.equipment_issues') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='equipment_issues' AND column_name='reported_by') THEN
      EXECUTE 'UPDATE equipment_issues SET reported_by = NULL WHERE reported_by = $1' USING free_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='equipment_issues' AND column_name='resolved_by') THEN
      EXECUTE 'UPDATE equipment_issues SET resolved_by = NULL WHERE resolved_by = $1' USING free_user_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='equipment_issues' AND column_name='assigned_to') THEN
      EXECUTE 'UPDATE equipment_issues SET assigned_to = NULL WHERE assigned_to = $1' USING free_user_id;
    END IF;
  END IF;

  IF to_regclass('public.equipment_moves') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='equipment_moves' AND column_name='moved_by') THEN
      EXECUTE 'UPDATE equipment_moves SET moved_by = NULL WHERE moved_by = $1' USING free_user_id;
    END IF;
  END IF;

  IF to_regclass('public.equipment_issue_comments') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='equipment_issue_comments' AND column_name='user_id') THEN
      EXECUTE 'UPDATE equipment_issue_comments SET user_id = NULL WHERE user_id = $1' USING free_user_id;
    END IF;
  END IF;

  BEGIN
    DELETE FROM users WHERE id = free_user_id;
    RAISE NOTICE 'Free Pool user deleted: %', free_user_id;
    RETURN;
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
    WHEN others THEN
      NULL;
  END;

  -- Fallback: deactivate + make it obvious it's a system record.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='is_active') THEN
    UPDATE users SET is_active = FALSE WHERE id = free_user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='full_name') THEN
    UPDATE users SET full_name = '[SYSTEM] Free Pool' WHERE id = free_user_id AND full_name IS DISTINCT FROM '[SYSTEM] Free Pool';
  END IF;

  RAISE NOTICE 'Free Pool user could not be fully deleted; deactivated instead: %', free_user_id;
END $$;
