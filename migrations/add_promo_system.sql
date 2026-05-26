-- PROMO GAMIFICATION SYSTEM
-- Tables for guest loyalty and rewards

-- 1. PROMO PLAYERS (Guests)
CREATE TABLE IF NOT EXISTS promo_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    phone_number VARCHAR(50) NOT NULL,
    full_name VARCHAR(255),
    pin_hash VARCHAR(255) NOT NULL,
    total_xp DECIMAL(12, 2) DEFAULT 0,
    bonus_balance DECIMAL(12, 2) DEFAULT 0, -- Virtual money to spend in club
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(club_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_promo_players_club_phone ON promo_players(club_id, phone_number);

-- 2. PROMO TICKETS (Game attempts)
CREATE TABLE IF NOT EXISTS promo_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES promo_players(id) ON DELETE CASCADE,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'available', -- available, used, expired
    source VARCHAR(50) DEFAULT 'admin_manual', -- admin_manual, topup_auto
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    used_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promo_tickets_player ON promo_tickets(player_id, status);

-- 3. PROMO PRIZES (Configuration of rewards)
CREATE TABLE IF NOT EXISTS promo_prizes (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- physical (RedBull), virtual (Balance), bonus (XP), attempt (Ticket)
    value DECIMAL(12, 2) DEFAULT 0, -- Value of prize (rubles, XP, etc.)
    probability DECIMAL(5, 2) NOT NULL, -- 0.00 to 100.00
    daily_limit INTEGER DEFAULT 0, -- 0 for unlimited
    is_active BOOLEAN DEFAULT TRUE,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_prizes_club ON promo_prizes(club_id, is_active);

-- 4. PROMO HISTORY (Game results)
CREATE TABLE IF NOT EXISTS promo_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES promo_players(id) ON DELETE CASCADE,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    game_type VARCHAR(50) NOT NULL, -- wheel, safe, dice, cards, etc.
    prize_id INTEGER REFERENCES promo_prizes(id), -- NULL if lost
    result_data JSONB, -- For storing specifics (e.g. dice numbers [6,6])
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_history_player ON promo_history(player_id);
CREATE INDEX IF NOT EXISTS idx_promo_history_club ON promo_history(club_id, created_at DESC);

-- 5. PROMO PRIZE QUEUE (For Admin Giveaway)
CREATE TABLE IF NOT EXISTS promo_prize_queue (
    id BIGSERIAL PRIMARY KEY,
    history_id UUID NOT NULL REFERENCES promo_history(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES promo_players(id) ON DELETE CASCADE,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    prize_id INTEGER NOT NULL REFERENCES promo_prizes(id),
    status VARCHAR(20) DEFAULT 'pending', -- pending, claimed, canceled
    claimed_at TIMESTAMP,
    claimed_by_admin_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_prize_queue_club_status ON promo_prize_queue(club_id, status);

-- 6. CLUB PROMO SETTINGS
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS promo_settings JSONB DEFAULT '{
    "ticket_price": 500,
    "ticket_expiry_hours": 24,
    "enabled_games": ["wheel", "safe", "dice"],
    "is_promo_active": false
}'::jsonb;
