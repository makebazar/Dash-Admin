CREATE TABLE IF NOT EXISTS club_tournaments (
    id BIGSERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    local_mode BOOLEAN NOT NULL DEFAULT TRUE,
    venue TEXT,
    starts_at TIMESTAMPTZ,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_tournaments_club_id ON club_tournaments(club_id);
CREATE INDEX IF NOT EXISTS idx_club_tournaments_club_id_status ON club_tournaments(club_id, status);

CREATE TABLE IF NOT EXISTS tournament_competitors (
    id BIGSERIAL PRIMARY KEY,
    tournament_id BIGINT NOT NULL REFERENCES club_tournaments(id) ON DELETE CASCADE,
    type VARCHAR(16) NOT NULL,
    display_name TEXT NOT NULL,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_competitors_tournament_id ON tournament_competitors(tournament_id);

CREATE TABLE IF NOT EXISTS tournament_entries (
    id BIGSERIAL PRIMARY KEY,
    tournament_id BIGINT NOT NULL REFERENCES club_tournaments(id) ON DELETE CASCADE,
    competitor_id BIGINT NOT NULL REFERENCES tournament_competitors(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_PAYMENT',
    seed INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tournament_id, competitor_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_entries_tournament_id ON tournament_entries(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_entries_tournament_id_status ON tournament_entries(tournament_id, status);

CREATE TABLE IF NOT EXISTS tournament_access_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    tournament_id BIGINT REFERENCES club_tournaments(id) ON DELETE CASCADE,
    competitor_id BIGINT REFERENCES tournament_competitors(id) ON DELETE CASCADE,
    kind VARCHAR(16) NOT NULL,
    code VARCHAR(12) NOT NULL,
    token UUID NOT NULL DEFAULT uuid_generate_v4(),
    label TEXT,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_access_invites_token ON tournament_access_invites(token);
CREATE INDEX IF NOT EXISTS idx_tournament_access_invites_tournament_kind ON tournament_access_invites(tournament_id, kind);
CREATE INDEX IF NOT EXISTS idx_tournament_access_invites_competitor_kind ON tournament_access_invites(competitor_id, kind);

CREATE TABLE IF NOT EXISTS tournament_matches (
    id BIGSERIAL PRIMARY KEY,
    tournament_id BIGINT NOT NULL REFERENCES club_tournaments(id) ON DELETE CASCADE,
    round INTEGER NOT NULL DEFAULT 1,
    order_in_round INTEGER NOT NULL DEFAULT 1,
    competitor_a_id BIGINT REFERENCES tournament_competitors(id) ON DELETE SET NULL,
    competitor_b_id BIGINT REFERENCES tournament_competitors(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
    scheduled_at TIMESTAMPTZ,
    result JSONB NOT NULL DEFAULT '{}'::jsonb,
    winner_competitor_id BIGINT REFERENCES tournament_competitors(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament_id ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament_round ON tournament_matches(tournament_id, round, order_in_round);

CREATE TABLE IF NOT EXISTS tournament_match_messages (
    id BIGSERIAL PRIMARY KEY,
    match_id BIGINT NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
    sender_kind VARCHAR(16) NOT NULL,
    sender_competitor_id BIGINT REFERENCES tournament_competitors(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_match_messages_match_id_created_at ON tournament_match_messages(match_id, created_at);

CREATE TABLE IF NOT EXISTS tournament_ledger_events (
    id BIGSERIAL PRIMARY KEY,
    tournament_id BIGINT NOT NULL REFERENCES club_tournaments(id) ON DELETE CASCADE,
    entry_id BIGINT REFERENCES tournament_entries(id) ON DELETE SET NULL,
    kind VARCHAR(16) NOT NULL,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'RUB',
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_ledger_events_tournament_id ON tournament_ledger_events(tournament_id);
