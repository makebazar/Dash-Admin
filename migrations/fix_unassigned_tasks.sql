
-- Update existing pending tasks that are unassigned
UPDATE equipment_maintenance_tasks mt
SET assigned_user_id = COALESCE(e.assigned_user_id, w.assigned_user_id, z.assigned_user_id)
FROM equipment e
LEFT JOIN club_workstations w ON e.workstation_id = w.id
LEFT JOIN club_zones z ON w.club_id = z.club_id AND w.zone = z.name
WHERE mt.equipment_id = e.id
  AND mt.status = 'PENDING'
  AND mt.assigned_user_id IS NULL
  AND COALESCE(e.assigned_user_id, w.assigned_user_id, z.assigned_user_id) IS NOT NULL;
