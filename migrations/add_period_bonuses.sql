-- Add period_bonuses column to salary_schemes
ALTER TABLE salary_schemes ADD COLUMN IF NOT EXISTS period_bonuses JSONB DEFAULT '[]';
