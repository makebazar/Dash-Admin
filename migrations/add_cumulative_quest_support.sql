-- ADD CUMULATIVE SERVICE AND RECURRING QUEST SUPPORT
ALTER TABLE promo_quests ADD COLUMN IF NOT EXISTS reset_period VARCHAR(20) DEFAULT 'none'; -- none, weekly, monthly
ALTER TABLE promo_quests ADD COLUMN IF NOT EXISTS target_entity_id_type VARCHAR(50); -- 'product', 'service', 'game'

-- Update player progress to track reset
ALTER TABLE promo_player_quests ADD COLUMN IF NOT EXISTS period_start TIMESTAMP DEFAULT NOW();
