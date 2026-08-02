-- Migration: update promo_package_progress for multi-program loyalty support
-- Adds program_id column and updates unique constraint

-- 1. Add program_id column (default 'legacy' for existing rows)
ALTER TABLE promo_package_progress
  ADD COLUMN IF NOT EXISTS program_id VARCHAR(100) NOT NULL DEFAULT 'legacy';

-- 2. Add generic current_count column (replaces accumulated_packages / accumulated_visits / current_streak)
ALTER TABLE promo_package_progress
  ADD COLUMN IF NOT EXISTS current_count INTEGER NOT NULL DEFAULT 0;

-- 3. Add generic last_event_date column (replaces last_purchase_date / last_visit_date)
ALTER TABLE promo_package_progress
  ADD COLUMN IF NOT EXISTS last_event_date DATE;

-- 4. Backfill current_count from old columns (take the max of the old fields)
UPDATE promo_package_progress
SET current_count = GREATEST(
  COALESCE(accumulated_packages, 0),
  COALESCE(accumulated_visits, 0),
  COALESCE(current_streak, 0)
)
WHERE current_count = 0;

-- 5. Backfill last_event_date from old columns
UPDATE promo_package_progress
SET last_event_date = GREATEST(last_purchase_date, last_visit_date)
WHERE last_event_date IS NULL;

-- 6. Drop old unique constraint and add new one on (player_id, club_id, program_id)
ALTER TABLE promo_package_progress DROP CONSTRAINT IF EXISTS promo_package_progress_player_id_club_id_key;
ALTER TABLE promo_package_progress
  ADD CONSTRAINT promo_package_progress_player_club_program_key
  UNIQUE (player_id, club_id, program_id);

-- 7. Update index
DROP INDEX IF EXISTS idx_promo_package_progress_player_club;
CREATE INDEX IF NOT EXISTS idx_promo_package_progress_player_club_prog
  ON promo_package_progress(player_id, club_id, program_id);

-- 8. Add prize_type to prize queue if missing
ALTER TABLE promo_prize_queue ADD COLUMN IF NOT EXISTS prize_type VARCHAR(50) DEFAULT 'free_package';
