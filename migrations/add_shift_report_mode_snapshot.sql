ALTER TABLE shifts
    ADD COLUMN IF NOT EXISTS report_mode VARCHAR(20) DEFAULT 'FULL_REPORT';

ALTER TABLE shifts
    ADD COLUMN IF NOT EXISTS actor_role_id_snapshot INTEGER;

ALTER TABLE shifts
    ADD COLUMN IF NOT EXISTS actor_role_name_snapshot VARCHAR(50);

UPDATE shifts
SET report_mode = 'FULL_REPORT'
WHERE report_mode IS NULL;

