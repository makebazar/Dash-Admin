-- Migration to support DashLock integration
-- 1. Create club_players table for client database sync
CREATE TABLE IF NOT EXISTS club_players (
    id UUID PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    phone VARCHAR(50),
    full_name VARCHAR(255),
    balance DECIMAL(10, 2) DEFAULT 0.00,
    bonus_balance DECIMAL(10, 2) DEFAULT 0.00,
    total_hours DECIMAL(10, 2) DEFAULT 0.00,
    total_spent DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_players_club ON club_players(club_id);
CREATE INDEX IF NOT EXISTS idx_club_players_phone ON club_players(phone);

-- 2. Add dashlock_state JSONB column to clubs to hold real-time PC utilization/grid info
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS dashlock_state JSONB DEFAULT '{}'::jsonb;
