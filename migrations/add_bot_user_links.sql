CREATE TABLE IF NOT EXISTS bot_user_links (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    messenger_type VARCHAR(50) NOT NULL, -- e.g., 'MAX', 'TELEGRAM'
    messenger_user_id VARCHAR(255) NOT NULL,
    linking_code VARCHAR(10),
    linking_code_expires_at TIMESTAMPTZ,
    current_club_id INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, messenger_type),
    UNIQUE(messenger_type, messenger_user_id)
);

-- Create or replace the function to avoid errors on re-run
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists, then create it to ensure it's up-to-date
DO $$
BEGIN
   IF NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgname = 'trigger_set_updated_at' AND tgrelid = 'bot_user_links'::regclass
   ) THEN
       CREATE TRIGGER trigger_set_updated_at
       BEFORE UPDATE ON bot_user_links
       FOR EACH ROW
       EXECUTE FUNCTION set_updated_at_timestamp();
   END IF;
END;
$$;
