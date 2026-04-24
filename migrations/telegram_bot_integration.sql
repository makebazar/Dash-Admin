CREATE TABLE IF NOT EXISTS telegram_link_codes (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    created_by UUID REFERENCES users(id),
    telegram_chat_id TEXT,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_club ON telegram_link_codes(club_id);
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_code ON telegram_link_codes(code);

CREATE TABLE IF NOT EXISTS club_telegram_chats (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    telegram_chat_id TEXT NOT NULL UNIQUE,
    linked_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_club_telegram_chats_club ON club_telegram_chats(club_id);
