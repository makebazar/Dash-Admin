-- Remove unused fields from salary_schemes
-- These fields (reward_value, target_per_shift) are not used for PROGRESSIVE type KPIs
-- Progressive KPIs use only the thresholds array

ALTER TABLE salary_schemes 
DROP COLUMN IF EXISTS reward_value,
DROP COLUMN IF EXISTS reward_type,
DROP COLUMN IF EXISTS target_per_shift;

-- Add comment
COMMENT ON TABLE salary_schemes IS 'Salary schemes with period bonuses. Progressive bonuses use only thresholds array.';
