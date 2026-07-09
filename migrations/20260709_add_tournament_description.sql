-- Add description column to promo_tournaments table
ALTER TABLE promo_tournaments ADD COLUMN IF NOT EXISTS description TEXT;
