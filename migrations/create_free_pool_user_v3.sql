
-- Assign Free Pool user to all clubs as employee
INSERT INTO club_employees (club_id, user_id, role, is_active)
SELECT id, '00000000-0000-0000-0000-000000000001', 'EMPLOYEE', true
FROM clubs
ON CONFLICT (club_id, user_id) DO NOTHING;
