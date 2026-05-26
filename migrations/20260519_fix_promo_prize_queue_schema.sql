-- Fix promo_prize_queue schema discrepancies
-- 1. Add withdraw_amount for bonus balance withdrawals
ALTER TABLE promo_prize_queue ADD COLUMN IF NOT EXISTS withdraw_amount DECIMAL(12, 2);

-- 2. Make prize_id nullable because balance withdrawals don't have a prize_id
ALTER TABLE promo_prize_queue ALTER COLUMN prize_id DROP NOT NULL;

-- 3. Make history_id nullable to allow two-step insertion if needed (though not ideal)
ALTER TABLE promo_prize_queue ALTER COLUMN history_id DROP NOT NULL;
