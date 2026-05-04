-- Add role_id to club_employees to unify with roles table
ALTER TABLE club_employees ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id);

-- Populate role_id based on existing string roles
UPDATE club_employees
SET role_id = (SELECT id FROM roles WHERE roles.name = club_employees.role LIMIT 1)
WHERE role_id IS NULL;

-- If no match was found (e.g. role is 'EMPLOYEE' or something else), default to 'Сотрудник'
UPDATE club_employees
SET role_id = (SELECT id FROM roles WHERE name = 'Сотрудник' LIMIT 1)
WHERE role_id IS NULL AND role <> 'Владелец' AND role <> 'Управляющий';

-- Set default permissions for Manager and Owner roles
UPDATE roles
SET employee_access_settings = '{
    "is_full_access": true,
    "can_view_reports": true,
    "can_edit_settings": true,
    "can_manage_employees": true,
    "can_manage_inventory": true,
    "can_manage_equipment": true
}'::jsonb
WHERE name IN ('Владелец', 'Управляющий');

-- Fix any remaining missing role_ids for Club 1
UPDATE club_employees
SET role_id = (SELECT id FROM roles WHERE name = 'Сотрудник' LIMIT 1)
WHERE club_id = 1 AND role_id IS NULL;

-- Ensure roles for Club 1 have explicit permissions set
-- (Manager and Owner are already set above, but let's ensure 'Сотрудник' for Club 1)
UPDATE roles
SET employee_access_settings = jsonb_set(
    COALESCE(employee_access_settings, '{}'::jsonb),
    '{can_view_reports}',
    'false'
) WHERE name = 'Сотрудник';
