-- Migration to add Cases and Player Inventory

-- 1. Create promo_cases table
CREATE TABLE IF NOT EXISTS promo_cases (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price_bonus NUMERIC(10, 2) NOT NULL DEFAULT 100.00,
    rtp NUMERIC(5, 2) NOT NULL DEFAULT 80.00,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_cases_club ON promo_cases(club_id) WHERE is_active = TRUE;

-- 2. Create promo_case_items table
CREATE TABLE IF NOT EXISTS promo_case_items (
    id SERIAL PRIMARY KEY,
    case_id INTEGER NOT NULL REFERENCES promo_cases(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    reward_type VARCHAR(50) NOT NULL, -- 'bonus_limitless', 'bonus_standard', 'bar_item', 'club_time', 'xp_boost', 'bp_xp'
    reward_value NUMERIC(10, 2) NOT NULL,
    bar_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    image_url TEXT,
    weight INTEGER NOT NULL DEFAULT 100,
    is_rare BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_case_items_case ON promo_case_items(case_id);

-- 3. Create promo_player_inventory table
CREATE TABLE IF NOT EXISTS promo_player_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES promo_players(id) ON DELETE CASCADE,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES promo_case_items(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'acquired', -- 'acquired', 'activated', 'claimed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activated_at TIMESTAMP WITH TIME ZONE,
    claimed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_promo_inventory_player ON promo_player_inventory(player_id, club_id);
CREATE INDEX IF NOT EXISTS idx_promo_inventory_status ON promo_player_inventory(status);

-- 4. Alter promo_player_balances to add extra_withdraw_limit
ALTER TABLE promo_player_balances 
ADD COLUMN IF NOT EXISTS extra_withdraw_limit NUMERIC(10, 2) NOT NULL DEFAULT 0.00;

-- 5. Alter promo_prize_queue to link to player inventory
ALTER TABLE promo_prize_queue 
ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES promo_player_inventory(id) ON DELETE SET NULL;
