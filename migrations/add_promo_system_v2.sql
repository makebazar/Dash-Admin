-- PROMO GAMIFICATION SYSTEM V2
-- Multi-club support: One identity, separate balances

-- Drop old tables if they exist from previous attempt
DROP TABLE IF EXISTS promo_prize_queue CASCADE;
DROP TABLE IF EXISTS promo_history CASCADE;
DROP TABLE IF EXISTS promo_tickets CASCADE;
DROP TABLE IF EXISTS promo_players CASCADE;
DROP TABLE IF EXISTS promo_prizes CASCADE;

-- 1. GLOBAL PROMO PLAYERS (Identity shared across clubs)
CREATE TABLE IF NOT EXISTS promo_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    pin_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_players_phone ON promo_players(phone_number);

-- 2. CLUB-SPECIFIC BALANCES (Separate for each club)
CREATE TABLE IF NOT EXISTS promo_player_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES promo_players(id) ON DELETE CASCADE,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    total_xp DECIMAL(12, 2) DEFAULT 0,
    bonus_balance DECIMAL(12, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(player_id, club_id)
);

CREATE INDEX IF NOT EXISTS idx_ppb_player_club ON promo_player_balances(player_id, club_id);

-- 3. PROMO TICKETS (Club-specific attempts)
CREATE TABLE IF NOT EXISTS promo_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES promo_players(id) ON DELETE CASCADE,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'available', -- available, used, expired
    source VARCHAR(50) DEFAULT 'admin_manual',
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    used_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promo_tickets_v2 ON promo_tickets(player_id, club_id, status);

-- 4. PROMO PRIZES
CREATE TABLE IF NOT EXISTS promo_prizes (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    value DECIMAL(12, 2) DEFAULT 0,
    probability DECIMAL(5, 2) NOT NULL,
    daily_limit INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. PROMO HISTORY
CREATE TABLE IF NOT EXISTS promo_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES promo_players(id) ON DELETE CASCADE,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    game_type VARCHAR(50) NOT NULL,
    prize_id INTEGER REFERENCES promo_prizes(id),
    result_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. PROMO PRIZE QUEUE
CREATE TABLE IF NOT EXISTS promo_prize_queue (
    id BIGSERIAL PRIMARY KEY,
    history_id UUID NOT NULL REFERENCES promo_history(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES promo_players(id) ON DELETE CASCADE,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    prize_id INTEGER NOT NULL REFERENCES promo_prizes(id),
    status VARCHAR(20) DEFAULT 'pending',
    claimed_at TIMESTAMP,
    claimed_by_admin_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
