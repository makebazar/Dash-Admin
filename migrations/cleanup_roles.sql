-- Set role_id to NULL for all club owners (they don't need employee roles)
UPDATE users SET role_id = NULL 
WHERE id IN (SELECT owner_id FROM clubs);

-- Remove unused roles, keep only employee roles
DELETE FROM roles WHERE name NOT IN ('Админ', 'Управляющий');

-- Ensure we have both employee roles
INSERT INTO roles (name, default_kpi_settings)
VALUES 
  ('Админ', '{"base_rate": 150, "kpi_multiplier": 1.2}'),
  ('Управляющий', '{"base_rate": 200, "kpi_multiplier": 1.5}')
ON CONFLICT (name) DO NOTHING;
