
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'club_employees'
          AND column_name = 'role'
    ) THEN
        ALTER TABLE club_employees ADD COLUMN role VARCHAR(100);
    END IF;
END $$;

UPDATE club_employees
SET role = 'EMPLOYEE'
WHERE role IS NULL;

ALTER TABLE club_employees ALTER COLUMN role SET DEFAULT 'EMPLOYEE';
ALTER TABLE club_employees ALTER COLUMN role SET NOT NULL;

-- Assign Free Pool user to all clubs as employee
INSERT INTO club_employees (club_id, user_id, role, is_active)
SELECT id, '00000000-0000-0000-0000-000000000001', 'EMPLOYEE', true
FROM clubs
ON CONFLICT (club_id, user_id) DO NOTHING;
