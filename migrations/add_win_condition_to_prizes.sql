-- Add win_condition to promo_prizes to support game-specific logic (e.g. Dice sums)
ALTER TABLE promo_prizes ADD COLUMN IF NOT EXISTS win_condition JSONB;
