-- Add selected_club_id column for AI tools to track selected club per messenger
ALTER TABLE bot_user_links 
ADD COLUMN IF NOT EXISTS selected_club_id INTEGER REFERENCES clubs(id) ON DELETE SET NULL;

-- Migrate data from current_club_id if exists
UPDATE bot_user_links SET selected_club_id = current_club_id 
WHERE selected_club_id IS NULL AND current_club_id IS NOT NULL;
