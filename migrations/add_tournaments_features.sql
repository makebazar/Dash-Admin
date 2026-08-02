-- Extend tournaments schema for ELO, Team rosters, Match Veto, Check-ins, and Payouts

-- 1. Teams & Members
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    captain_id UUID NOT NULL REFERENCES promo_players(id) ON DELETE CASCADE,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_members (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES promo_players(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (team_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_teams_club ON teams(club_id);
CREATE INDEX IF NOT EXISTS idx_team_members_player ON team_members(player_id);

-- 2. Alter Competitors to link to Teams and Players
ALTER TABLE tournament_competitors ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE tournament_competitors ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES promo_players(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tournament_competitors_team ON tournament_competitors(team_id);
CREATE INDEX IF NOT EXISTS idx_tournament_competitors_player ON tournament_competitors(player_id);

-- 3. ELO ratings table
CREATE TABLE IF NOT EXISTS discipline_elo (
    player_id UUID NOT NULL REFERENCES promo_players(id) ON DELETE CASCADE,
    discipline VARCHAR(50) NOT NULL,
    elo INT DEFAULT 1000,
    matches_played INT DEFAULT 0,
    is_calibrated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (player_id, discipline)
);

CREATE INDEX IF NOT EXISTS idx_discipline_elo_discipline ON discipline_elo(discipline);

-- 4. Alter Club Tournaments for rules, fees, and prizes
ALTER TABLE club_tournaments ADD COLUMN IF NOT EXISTS entry_fee DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE club_tournaments ADD COLUMN IF NOT EXISTS club_share_pct INT DEFAULT 0;
ALTER TABLE club_tournaments ADD COLUMN IF NOT EXISTS prize_type VARCHAR(50) DEFAULT 'cash'; -- cash, bonus, items
ALTER TABLE club_tournaments ADD COLUMN IF NOT EXISTS prize_pool_mode VARCHAR(50) DEFAULT 'fixed'; -- fixed, dynamic
ALTER TABLE club_tournaments ADD COLUMN IF NOT EXISTS fixed_prize_amount DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE club_tournaments ADD COLUMN IF NOT EXISTS prize_distribution JSONB DEFAULT '{}'::jsonb;
ALTER TABLE club_tournaments ADD COLUMN IF NOT EXISTS rules TEXT;
ALTER TABLE club_tournaments ADD COLUMN IF NOT EXISTS discipline VARCHAR(50) DEFAULT 'cs2';
ALTER TABLE club_tournaments ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'solo';

-- 5. Alter Match for CS2 Server ID and Scores
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS cs2_server_id VARCHAR(100);
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS score1 INT DEFAULT 0;
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS score2 INT DEFAULT 0;

-- 6. Match Veto
CREATE TABLE IF NOT EXISTS match_veto (
    match_id BIGINT PRIMARY KEY REFERENCES tournament_matches(id) ON DELETE CASCADE,
    current_turn_competitor_id BIGINT REFERENCES tournament_competitors(id) ON DELETE SET NULL,
    banned_maps TEXT[] DEFAULT '{}',
    selected_map VARCHAR(100),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Lobby Check-In and Seat numbers (ПК)
CREATE TABLE IF NOT EXISTS lobby_checkin (
    match_id BIGINT NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES promo_players(id) ON DELETE CASCADE,
    pc_number VARCHAR(50),
    is_ready BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (match_id, player_id)
);

-- 8. Tournament Payouts
CREATE TABLE IF NOT EXISTS tournament_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id BIGINT NOT NULL REFERENCES club_tournaments(id) ON DELETE CASCADE,
    competitor_id BIGINT REFERENCES tournament_competitors(id) ON DELETE SET NULL,
    prize_type VARCHAR(50) NOT NULL, -- cash, bonus, items
    amount DECIMAL(10, 2) DEFAULT 0.00,
    item_details TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, paid
    paid_at TIMESTAMP WITH TIME ZONE,
    paid_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tournament_payouts_tournament ON tournament_payouts(tournament_id);

-- 9. Rules Templates per Discipline
CREATE TABLE IF NOT EXISTS tournament_rules_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    discipline VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    rules_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tournament_rules_templates_club ON tournament_rules_templates(club_id);
