-- Migration: Remove maintenance_monthly_bonuses table (legacy, double-counting source)
-- Бонус теперь считается из equipment_maintenance_tasks.bonus_earned

-- Backup data before drop (optional, for rollback)
-- CREATE TABLE IF NOT EXISTS maintenance_monthly_bonuses_backup AS SELECT * FROM maintenance_monthly_bonuses;

DROP TABLE IF EXISTS maintenance_monthly_bonuses;