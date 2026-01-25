-- Update existing roles instead of deleting
UPDATE roles SET name = 'Админ', default_kpi_settings = '{"base_rate": 150, "kpi_multiplier": 1.2}' WHERE id = 1;
UPDATE roles SET name = 'Управляющий', default_kpi_settings = '{"base_rate": 200, "kpi_multiplier": 1.5}' WHERE id = 2;

-- Delete unused roles (if they exist)
DELETE FROM roles WHERE id > 2;
