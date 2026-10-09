-- ============================================
-- PROMO TOURNAMENTS
-- ============================================

ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS steam_link VARCHAR(255);
ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS steam_id VARCHAR(50);
ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_link VARCHAR(255);

CREATE TABLE IF NOT EXISTS promo_teams (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    captain_phone VARCHAR(50) NOT NULL,
    join_code VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_team_members (
    team_id INTEGER NOT NULL REFERENCES promo_teams(id) ON DELETE CASCADE,
    phone VARCHAR(50) NOT NULL,
    role VARCHAR(20) DEFAULT 'player',
    joined_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (team_id, phone)
);

CREATE TABLE IF NOT EXISTS promo_tournaments (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'registration',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_tournament_participants (
    tournament_id INTEGER NOT NULL REFERENCES promo_tournaments(id) ON DELETE CASCADE,
    team_id INTEGER NOT NULL REFERENCES promo_teams(id) ON DELETE CASCADE,
    registered_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (tournament_id, team_id)
);

CREATE TABLE IF NOT EXISTS promo_tournament_matches (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES promo_tournaments(id) ON DELETE CASCADE,
    round INTEGER NOT NULL DEFAULT 1,
    team1_id INTEGER REFERENCES promo_teams(id) ON DELETE SET NULL,
    team2_id INTEGER REFERENCES promo_teams(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'scheduled',
    winner_id INTEGER REFERENCES promo_teams(id) ON DELETE SET NULL,
    map VARCHAR(100),
    veto_state JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);
