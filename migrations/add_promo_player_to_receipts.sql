-- Add promo_player_id to shift_receipts to link sales to promo players
ALTER TABLE shift_receipts ADD COLUMN IF NOT EXISTS promo_player_id UUID REFERENCES promo_players(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_shift_receipts_promo_player ON shift_receipts(promo_player_id);

-- Add welcome_bonus_awarded to prevent double bonuses
ALTER TABLE promo_player_balances ADD COLUMN IF NOT EXISTS welcome_bonus_awarded BOOLEAN DEFAULT FALSE;
