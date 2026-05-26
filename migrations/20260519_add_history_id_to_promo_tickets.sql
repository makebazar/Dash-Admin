-- Add history_id to promo_tickets to link tickets to their accrual event
ALTER TABLE promo_tickets ADD COLUMN IF NOT EXISTS history_id UUID REFERENCES promo_history(id) ON DELETE CASCADE;

-- Add index for performance when querying tickets by history_id
CREATE INDEX IF NOT EXISTS idx_promo_tickets_history_id ON promo_tickets(history_id);
