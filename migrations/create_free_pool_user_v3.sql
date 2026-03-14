DO $$
DECLARE
  free_user_id UUID;
BEGIN
  -- Add role column if missing
  IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'club_employees'
        AND column_name = 'role'
  ) THEN
      ALTER TABLE club_employees ADD COLUMN role VARCHAR(100);
  END IF;

  -- Normalize null roles before enforcing constraints
  UPDATE club_employees
  SET role = 'EMPLOYEE'
  WHERE role IS NULL;

  ALTER TABLE club_employees ALTER COLUMN role SET DEFAULT 'EMPLOYEE';

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'club_employees'
      AND column_name = 'role'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE club_employees ALTER COLUMN role SET NOT NULL;
  END IF;

  -- Ensure Free Pool user exists, so the FK insert into club_employees can't fail.
  -- Prefer the fixed UUID if it's free, otherwise reuse an existing system user by phone.
  SELECT id INTO free_user_id
  FROM users
  WHERE id = '00000000-0000-0000-0000-000000000001'
  LIMIT 1;

  IF free_user_id IS NULL THEN
    SELECT id INTO free_user_id
    FROM users
    WHERE phone_number = '__system_free_pool__'
    LIMIT 1;
  END IF;

  IF free_user_id IS NULL THEN
    free_user_id := '00000000-0000-0000-0000-000000000001';
    BEGIN
      INSERT INTO users (id, full_name, phone_number, is_active)
      VALUES (free_user_id, 'Free Pool', '__system_free_pool__', TRUE);
    EXCEPTION
      WHEN unique_violation THEN
        -- If phone_number is already taken, fall back to that user.
        SELECT id INTO free_user_id
        FROM users
        WHERE phone_number = '__system_free_pool__'
        LIMIT 1;
    END;
  END IF;

  IF free_user_id IS NOT NULL THEN
    -- Assign Free Pool user to all clubs as employee
    INSERT INTO club_employees (club_id, user_id, role, is_active)
    SELECT id, free_user_id, 'EMPLOYEE', TRUE
    FROM clubs
    ON CONFLICT (club_id, user_id) DO NOTHING;
  END IF;
END $$;
