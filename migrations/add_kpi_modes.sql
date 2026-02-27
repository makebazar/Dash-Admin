-- Add calculation_mode and monthly_tiers to maintenance_kpi_config
ALTER TABLE maintenance_kpi_config
ADD COLUMN IF NOT EXISTS calculation_mode TEXT DEFAULT 'PER_TASK', -- 'PER_TASK' or 'MONTHLY_TIERS'
ADD COLUMN IF NOT EXISTS monthly_tiers JSONB DEFAULT '[]'; -- Array of { threshold: number, bonus: number }
