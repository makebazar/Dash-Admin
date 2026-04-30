ALTER TABLE shift_zone_discrepancy_resolutions
DROP CONSTRAINT IF EXISTS shift_zone_discrepancy_resolutions_resolution_type_check;

ALTER TABLE shift_zone_discrepancy_resolutions
ADD CONSTRAINT shift_zone_discrepancy_resolutions_resolution_type_check
CHECK (resolution_type IN ('SALARY_DEDUCTION', 'LOSS', 'NO_DEDUCTION'));

