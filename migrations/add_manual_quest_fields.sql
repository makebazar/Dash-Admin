-- ADD MANUAL VERIFICATION AND NEW TRIGGER SUPPORT TO PROMO QUESTS
ALTER TABLE promo_quests ADD COLUMN IF NOT EXISTS action_button_text VARCHAR(100);
ALTER TABLE promo_quests ADD COLUMN IF NOT EXISTS action_button_url TEXT;
ALTER TABLE promo_quests ADD COLUMN IF NOT EXISTS requires_photo_verification BOOLEAN DEFAULT FALSE;

-- Update player quests to support photo proof
ALTER TABLE promo_player_quests ADD COLUMN IF NOT EXISTS verification_photo_url TEXT;
ALTER TABLE promo_player_quests ADD COLUMN IF NOT EXISTS admin_comment TEXT;
ALTER TABLE promo_player_quests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE promo_player_quests ADD COLUMN IF NOT EXISTS reviewed_by INTEGER; -- user_id of admin
