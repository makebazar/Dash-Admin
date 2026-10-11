-- Add finished_at column to club_tournaments if it does not exist
ALTER TABLE club_tournaments ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP WITH TIME ZONE;
