-- Add club_id to shifts
ALTER TABLE shifts ADD COLUMN club_id INTEGER REFERENCES clubs(id);

-- Optional: Clean up orphan shifts or assign to first club (for dev env)
-- UPDATE shifts SET club_id = (SELECT id FROM clubs LIMIT 1) WHERE club_id IS NULL;
