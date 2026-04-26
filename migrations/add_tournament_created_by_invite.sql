ALTER TABLE club_tournaments
ADD COLUMN IF NOT EXISTS created_by_invite_id UUID REFERENCES tournament_access_invites(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_club_tournaments_created_by_invite_id ON club_tournaments(created_by_invite_id);
