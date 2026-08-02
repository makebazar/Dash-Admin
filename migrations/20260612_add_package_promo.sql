-- Add package and visit loyalty tracking
CREATE TABLE IF NOT EXISTS promo_package_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES promo_players(id) ON DELETE CASCADE,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    accumulated_packages INTEGER NOT NULL DEFAULT 0,
    accumulated_visits INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    last_visit_date DATE,
    last_purchase_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(player_id, club_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_package_progress_player_club ON promo_package_progress(player_id, club_id);

-- Alter promo_prize_queue to allow custom rewards
ALTER TABLE promo_prize_queue ADD COLUMN IF NOT EXISTS custom_reward_name VARCHAR(255);
ALTER TABLE promo_prize_queue ADD COLUMN IF NOT EXISTS loyalty_type VARCHAR(50);
ALTER TABLE promo_prize_queue ADD COLUMN IF NOT EXISTS reward_type VARCHAR(50);
ALTER TABLE promo_prize_queue ADD COLUMN IF NOT EXISTS reward_value DECIMAL(12, 2) DEFAULT 0;
