-- Add game_slug to promo_prizes to link prizes to specific games
ALTER TABLE promo_prizes ADD COLUMN IF NOT EXISTS game_slug VARCHAR(50);
