-- Add tournament profile fields to promo_players
ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS lft_status VARCHAR(30) DEFAULT 'none';
ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_elo INTEGER;
ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_lvl INTEGER;
ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_kd NUMERIC(5,2);
ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_winrate NUMERIC(5,2);
ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_matches INTEGER;
ALTER TABLE promo_players ADD COLUMN IF NOT EXISTS faceit_avatar TEXT;
