-- Migration to add standard_monthly_shifts to salary_schemes
ALTER TABLE salary_schemes ADD COLUMN IF NOT EXISTS standard_monthly_shifts INTEGER DEFAULT 15;
