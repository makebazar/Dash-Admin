-- MIGRATION: ADD SEAT NUMBER AND VISIT QUEST TYPES

-- 1. Add requires_seat_number to quests table
ALTER TABLE promo_quests ADD COLUMN IF NOT EXISTS requires_seat_number BOOLEAN DEFAULT FALSE;

-- 2. Add seat_number and last_visit_at tracking columns to player quest progress
ALTER TABLE promo_player_quests ADD COLUMN IF NOT EXISTS seat_number VARCHAR(50);
ALTER TABLE promo_player_quests ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMP;

-- 3. Create a visits table to verify and log daily employee-approved check-ins
CREATE TABLE IF NOT EXISTS promo_player_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES promo_players(id) ON DELETE CASCADE,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  seat_number VARCHAR(50),
  confirmed_by INTEGER, -- references club_employees.id, not foreign keyed directly to simplify
  confirmed_at TIMESTAMP DEFAULT NOW()
);
