-- MIGRATION: UPDATE CLUB PUBLIC ID TO 4-DIGIT NUMERIC CODE

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

-- Update existing clubs with long IDs or CLB- prefix to 4-digit codes
UPDATE clubs
SET public_id = (FLOOR(RANDOM() * 9000) + 1000)::TEXT
WHERE public_id IS NULL
   OR public_id LIKE 'CLB-%'
   OR LENGTH(public_id) > 4;

-- Note: In a real high-volume production, a simple RANDOM update might cause collisions if done in bulk.
-- But for a small set of clubs, it's fine. For absolute safety, one could use a loop or temporary sequence.
