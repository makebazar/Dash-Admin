-- Create promo_frag_matches table for CS2 and Dota 2 tracking
CREATE TABLE IF NOT EXISTS promo_frag_matches (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES promo_players(id) ON DELETE CASCADE,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    game VARCHAR(20) NOT NULL,
    map VARCHAR(100) NOT NULL,
    score VARCHAR(50) NOT NULL,
    kills INTEGER NOT NULL DEFAULT 0,
    deaths INTEGER NOT NULL DEFAULT 0,
    assists INTEGER NOT NULL DEFAULT 0,
    headshots INTEGER NOT NULL DEFAULT 0,
    last_hits INTEGER NOT NULL DEFAULT 0,
    earned NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
    events JSONB NOT NULL DEFAULT '[]'::jsonb,
    played_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promo_frag_matches_player_club ON promo_frag_matches(player_id, club_id);
