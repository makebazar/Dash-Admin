ALTER TABLE clubs ALTER COLUMN public_id DROP NOT NULL;

UPDATE clubs
SET public_id = NULL
WHERE public_id LIKE 'CLB-%';
