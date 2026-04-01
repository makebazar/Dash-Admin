CREATE TABLE IF NOT EXISTS support_tickets (
    id SERIAL PRIMARY KEY,
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    guest_name VARCHAR(255) NULL,
    guest_email VARCHAR(255) NULL,
    guest_phone VARCHAR(50) NULL,
    source VARCHAR(32) NOT NULL DEFAULT 'web',
    subject VARCHAR(255) NOT NULL,
    category VARCHAR(32) NOT NULL DEFAULT 'GENERAL',
    priority VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    description TEXT NOT NULL,
    assigned_to UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    closed_at TIMESTAMP NULL,
    last_message_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_messages (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    sender_name VARCHAR(255) NULL,
    sender_email VARCHAR(255) NULL,
    sender_phone VARCHAR(50) NULL,
    message TEXT NOT NULL,
    is_staff BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS guest_name VARCHAR(255) NULL;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255) NULL;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(50) NULL;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS source VARCHAR(32) NOT NULL DEFAULT 'web';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS assigned_to UUID NULL;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP NULL;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE support_tickets ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255) NULL;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS sender_email VARCHAR(255) NULL;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS sender_phone VARCHAR(50) NULL;
ALTER TABLE support_messages ALTER COLUMN sender_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON support_messages(ticket_id, created_at ASC);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'support_tickets'
          AND column_name = 'user_id'
          AND udt_name <> 'uuid'
    ) THEN
        ALTER TABLE support_tickets
        ALTER COLUMN user_id TYPE UUID
        USING NULLIF(user_id::text, '')::uuid;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'support_tickets'
          AND column_name = 'assigned_to'
          AND udt_name <> 'uuid'
    ) THEN
        ALTER TABLE support_tickets
        ALTER COLUMN assigned_to TYPE UUID
        USING NULLIF(assigned_to::text, '')::uuid;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'support_messages'
          AND column_name = 'sender_id'
          AND udt_name <> 'uuid'
    ) THEN
        ALTER TABLE support_messages
        ALTER COLUMN sender_id TYPE UUID
        USING NULLIF(sender_id::text, '')::uuid;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'support_tickets_user_id_fkey'
    ) THEN
        ALTER TABLE support_tickets
        ADD CONSTRAINT support_tickets_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'support_tickets_assigned_to_fkey'
    ) THEN
        ALTER TABLE support_tickets
        ADD CONSTRAINT support_tickets_assigned_to_fkey
        FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'support_messages_sender_id_fkey'
    ) THEN
        ALTER TABLE support_messages
        ADD CONSTRAINT support_messages_sender_id_fkey
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
