DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'clubs'
          AND column_name = 'public_id'
    ) THEN
        ALTER TABLE clubs ADD COLUMN public_id VARCHAR(32);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION generate_club_public_id()
RETURNS VARCHAR AS $$
DECLARE
    generated_id VARCHAR;
BEGIN
    LOOP
        generated_id := (FLOOR(RANDOM() * 9000) + 1000)::TEXT;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM clubs WHERE public_id = generated_id);
    END LOOP;
    RETURN generated_id;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE clubs ALTER COLUMN public_id SET DEFAULT generate_club_public_id();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_clubs_public_id_unique'
    ) THEN
        CREATE UNIQUE INDEX idx_clubs_public_id_unique ON clubs(public_id);
    END IF;
END $$;
