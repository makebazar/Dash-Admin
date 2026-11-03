-- Add support for loyalty and standalone rewards in player inventory
ALTER TABLE promo_player_inventory
  ALTER COLUMN item_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS reward_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS reward_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS service_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS metadata JSONB;
