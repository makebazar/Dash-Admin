-- Migration to add combo triggers and progress columns for promo quests
ALTER TABLE promo_quests ADD COLUMN IF NOT EXISTS combo_triggers JSONB DEFAULT NULL;
ALTER TABLE promo_player_quests ADD COLUMN IF NOT EXISTS combo_progress JSONB DEFAULT NULL;
