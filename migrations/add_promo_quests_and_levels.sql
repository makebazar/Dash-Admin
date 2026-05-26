-- PROMO QUESTS AND LEVELS SYSTEM MIGRATION

-- 1. PROMO LEVELS (XP Thresholds)
CREATE TABLE IF NOT EXISTS promo_levels (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    level_number INTEGER NOT NULL CHECK (level_number >= 1),
    xp_required INTEGER NOT NULL DEFAULT 0,
    UNIQUE(club_id, level_number)
);

CREATE INDEX IF NOT EXISTS idx_promo_levels_club ON promo_levels(club_id, xp_required);

-- 2. UPDATE PROMO PRIZES (Level filtering)
ALTER TABLE promo_prizes ADD COLUMN IF NOT EXISTS min_level INTEGER DEFAULT 1;
ALTER TABLE promo_prizes ADD COLUMN IF NOT EXISTS max_level INTEGER DEFAULT 999;

-- 3. PROMO QUESTS (Definitions)
CREATE TABLE IF NOT EXISTS promo_quests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Triggers & Conditions
    trigger_type VARCHAR(50) NOT NULL DEFAULT 'receipt_item', -- receipt_item, receipt_total, service_award, checkin
    target_entity_id VARCHAR(255), -- product_id or service_rule_id, depending on trigger_type
    target_value DECIMAL(12, 2) NOT NULL DEFAULT 1, -- e.g., 2 items, 1000 rubles, 3 service awards

    -- Rewards
    reward_xp INTEGER DEFAULT 0,
    reward_tickets INTEGER DEFAULT 0,
    reward_bonus_balance DECIMAL(12, 2) DEFAULT 0,
    reward_prize_id INTEGER REFERENCES promo_prizes(id),

    -- Mechanics
    is_randomizable BOOLEAN DEFAULT FALSE,
    lifetime_minutes INTEGER, -- For check-in quests (e.g., 120 mins)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_quests_club_active ON promo_quests(club_id, is_active);

-- 4. PROMO PLAYER QUESTS (Progress tracking)
CREATE TABLE IF NOT EXISTS promo_player_quests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES promo_players(id) ON DELETE CASCADE,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    quest_id UUID NOT NULL REFERENCES promo_quests(id) ON DELETE CASCADE,

    current_progress DECIMAL(12, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active', -- active, completed, claimed, expired

    assigned_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP, -- Calculated from lifetime_minutes
    completed_at TIMESTAMP,
    claimed_at TIMESTAMP,

    UNIQUE(player_id, club_id, quest_id, assigned_at) -- Allows re-assigning the same quest later if needed
);

CREATE INDEX IF NOT EXISTS idx_ppq_player_status ON promo_player_quests(player_id, status);
CREATE INDEX IF NOT EXISTS idx_ppq_club_quest ON promo_player_quests(club_id, quest_id);
