CREATE INDEX IF NOT EXISTS idx_equipment_club_workstation_active
ON equipment(club_id, workstation_id, is_active);

CREATE INDEX IF NOT EXISTS idx_equipment_club_workstation_type_name
ON equipment(club_id, workstation_id, type, name);

CREATE INDEX IF NOT EXISTS idx_equipment_issues_club_status_equipment
ON equipment_issues(club_id, status, equipment_id);

CREATE INDEX IF NOT EXISTS idx_equipment_issues_open_by_club_equipment
ON equipment_issues(club_id, equipment_id)
WHERE status IN ('OPEN', 'IN_PROGRESS');

CREATE INDEX IF NOT EXISTS idx_workstations_club_zone_name
ON club_workstations(club_id, zone, name);

CREATE INDEX IF NOT EXISTS idx_club_zones_club_name
ON club_zones(club_id, name);

CREATE INDEX IF NOT EXISTS idx_club_employees_club_active_dismissed_user
ON club_employees(club_id, is_active, dismissed_at, user_id);
