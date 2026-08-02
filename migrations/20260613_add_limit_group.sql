-- Add limit_group_id to promo_player_balances table to support custom limit groups
ALTER TABLE promo_player_balances ADD COLUMN IF NOT EXISTS limit_group_id VARCHAR(50) DEFAULT NULL;
