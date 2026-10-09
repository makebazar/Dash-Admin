-- AI Manager Tables: Chat Messages & Permanent Memory

CREATE TABLE IF NOT EXISTS ai_chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    role VARCHAR(20) NOT NULL, -- 'user' | 'assistant' | 'system'
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_club ON ai_chat_messages(club_id, created_at ASC);

CREATE TABLE IF NOT EXISTS ai_club_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    category VARCHAR(50) DEFAULT 'general', -- 'finance', 'staff', 'inventory', 'general'
    memory_key VARCHAR(255),
    memory_value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_club_memories_club ON ai_club_memories(club_id);
