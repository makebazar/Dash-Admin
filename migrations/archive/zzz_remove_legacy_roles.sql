INSERT INTO roles (name, default_kpi_settings)
VALUES
  ('Админ', '{"base_rate": 150, "kpi_multiplier": 1.2}'),
  ('Управляющий', '{"base_rate": 200, "kpi_multiplier": 1.5}')
ON CONFLICT (name) DO NOTHING;

WITH manager_role AS (
  SELECT id FROM roles WHERE name = 'Управляющий' LIMIT 1
),
legacy_roles AS (
  SELECT id FROM roles WHERE name IN ('Клинер', 'Охрана', 'Бариста')
)
UPDATE users
SET role_id = (SELECT id FROM manager_role)
WHERE role_id IN (SELECT id FROM legacy_roles)
  AND (SELECT id FROM manager_role) IS NOT NULL;

UPDATE club_employees
SET role = 'Управляющий'
WHERE role IN ('Клинер', 'Охрана', 'Бариста');

DELETE FROM roles
WHERE name IN ('Клинер', 'Охрана', 'Бариста');
