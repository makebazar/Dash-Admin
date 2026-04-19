ALTER TABLE roles
    ADD COLUMN IF NOT EXISTS employee_access_settings JSONB DEFAULT '{}'::jsonb;

UPDATE roles
SET employee_access_settings = '{}'::jsonb
WHERE employee_access_settings IS NULL;

INSERT INTO roles (name, default_kpi_settings, employee_access_settings)
VALUES (
    'Хостес',
    '{}'::jsonb,
    '{
        "employee_only": true,
        "shift_start_enabled": true,
        "shift_end_mode": "NO_REPORT",
        "handover_checklist_on_start": "DISABLED",
        "closing_checklist_enabled": false,
        "shift_zone_handover_enabled": false,
        "inventory_actions_enabled": false,
        "maintenance_enabled": true,
        "schedule_enabled": true,
        "requests_enabled": true,
        "workstations_view_enabled": true
    }'::jsonb
)
ON CONFLICT (name) DO NOTHING;

