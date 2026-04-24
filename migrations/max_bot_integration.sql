CREATE TABLE IF NOT EXISTS max_link_codes (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    created_by UUID REFERENCES users(id),
    max_chat_id TEXT,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_max_link_codes_club ON max_link_codes(club_id);
CREATE INDEX IF NOT EXISTS idx_max_link_codes_code ON max_link_codes(code);

CREATE TABLE IF NOT EXISTS club_max_chats (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    max_chat_id TEXT NOT NULL UNIQUE,
    linked_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_club_max_chats_club ON club_max_chats(club_id);

