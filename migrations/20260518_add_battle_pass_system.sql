-- BATTLE PASS SYSTEM MIGRATION

-- 1. BP SEASONS
CREATE TABLE IF NOT EXISTS promo_bp_seasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_bp_seasons_club ON promo_bp_seasons(club_id, is_active);

-- 2. BP TIERS (Levels and Rewards)
CREATE TABLE IF NOT EXISTS promo_bp_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id UUID NOT NULL REFERENCES promo_bp_seasons(id) ON DELETE CASCADE,
    level_number INTEGER NOT NULL,
    xp_required INTEGER NOT NULL, -- Cumulative XP from start of season

    -- Reward fields
    reward_type VARCHAR(50) NOT NULL, -- 'bonus_balance', 'ticket', 'bar_item', 'xp_boost'
    reward_value DECIMAL(12, 2) DEFAULT 0, -- Amount of bonuses, count of tickets, or product_id
    reward_name VARCHAR(255) NOT NULL, -- Display name for the reward

    is_premium BOOLEAN DEFAULT FALSE, -- If TRUE, only players who bought BP get this

    UNIQUE(season_id, level_number, is_premium)
);

CREATE INDEX IF NOT EXISTS idx_promo_bp_tiers_season ON promo_bp_tiers(season_id, level_number);

-- 3. PLAYER PROGRESS
CREATE TABLE IF NOT EXISTS promo_bp_player_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES promo_players(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES promo_bp_seasons(id) ON DELETE CASCADE,

    current_xp INTEGER DEFAULT 0,
    has_premium BOOLEAN DEFAULT FALSE,
    activated_at TIMESTAMP,

    -- Boost fields
    boost_expires_at TIMESTAMP, -- For X2 XP boosts

    -- Track claimed rewards to prevent double-claiming
    -- JSONB array of objects: [{level: 1, type: 'free', claimed_at: '...'}, {level: 1, type: 'premium', claimed_at: '...'}]
    claimed_rewards JSONB DEFAULT '[]',

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(player_id, season_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_bp_progress_player ON promo_bp_player_progress(player_id);

-- 4. ADD BP SETTINGS TO CLUBS (Optional configuration)
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS bp_settings JSONB DEFAULT '{
    "is_enabled": false,
    "bp_price": 1000,
    "xp_per_ruble": 1
}'::jsonb;
