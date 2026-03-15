-- Ensure employee roles exist and are up-to-date
INSERT INTO roles (name, default_kpi_settings)
VALUES
  ('Админ', '{"base_rate": 150, "kpi_multiplier": 1.2}'),
  ('Управляющий', '{"base_rate": 200, "kpi_multiplier": 1.5}')
ON CONFLICT (name) DO UPDATE SET default_kpi_settings = EXCLUDED.default_kpi_settings;

-- Reassign users on non-employee roles to 'Админ' to avoid FK violations
UPDATE users u
SET role_id = (SELECT id FROM roles WHERE name = 'Админ' LIMIT 1)
WHERE u.role_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM roles r
    WHERE r.id = u.role_id
      AND r.name IN ('Админ', 'Управляющий')
  );

-- Delete unused roles (only if not referenced by users)
DELETE FROM roles r
WHERE r.name NOT IN ('Админ', 'Управляющий')
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.role_id = r.id);
