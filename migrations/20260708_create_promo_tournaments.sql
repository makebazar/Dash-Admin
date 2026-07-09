-- Create promo_tournaments table for ELO/TP Frag Tournaments/Seasons
CREATE TABLE IF NOT EXISTS promo_tournaments (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    game VARCHAR(20) NOT NULL, -- 'CS2', 'Dota2', 'ALL'
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    min_matches INTEGER NOT NULL DEFAULT 5,
    prizes JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g. [{"place": 1, "reward": 5000}, {"place": 2, "reward": 3000}]
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'completed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promo_tournaments_club ON promo_tournaments(club_id);
