-- MIGRATION: ADD TIME AND DAY CONSTRAINTS TO PROMO QUESTS
ALTER TABLE promo_quests ADD COLUMN IF NOT EXISTS available_days INTEGER[];
ALTER TABLE promo_quests ADD COLUMN IF NOT EXISTS time_start TIME;
ALTER TABLE promo_quests ADD COLUMN IF NOT EXISTS time_end TIME;

-- MIGRATION: ADD MANUAL VERIFICATION AND NEW TRIGGER SUPPORT
ALTER TABLE promo_quests ADD COLUMN IF NOT EXISTS action_button_text VARCHAR(100);
ALTER TABLE promo_quests ADD COLUMN IF NOT EXISTS action_button_url TEXT;
ALTER TABLE promo_quests ADD COLUMN IF NOT EXISTS requires_photo_verification BOOLEAN DEFAULT FALSE;

-- Update player quests to support photo proof
ALTER TABLE promo_player_quests ADD COLUMN IF NOT EXISTS verification_photo_url TEXT;
ALTER TABLE promo_player_quests ADD COLUMN IF NOT EXISTS admin_comment TEXT;
ALTER TABLE promo_player_quests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE promo_player_quests ADD COLUMN IF NOT EXISTS reviewed_by INTEGER;

-- MIGRATION: ADD CUMULATIVE SERVICE AND RECURRING QUEST SUPPORT
ALTER TABLE promo_quests ADD COLUMN IF NOT EXISTS reset_period VARCHAR(20) DEFAULT 'none';
ALTER TABLE promo_quests ADD COLUMN IF NOT EXISTS target_entity_id_type VARCHAR(50);

-- Update player progress to track reset
ALTER TABLE promo_player_quests ADD COLUMN IF NOT EXISTS period_start TIMESTAMP DEFAULT NOW();
