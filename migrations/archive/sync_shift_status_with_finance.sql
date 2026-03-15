-- Sync shift status with finance transactions
-- This fixes shifts that were imported before verification system was added

-- Update shifts that have finance transactions but status is not VERIFIED
UPDATE shifts
SET status = 'VERIFIED',
    verified_at = COALESCE(verified_at, NOW())
WHERE id IN (
    SELECT DISTINCT related_shift_report_id 
    FROM finance_transactions 
    WHERE related_shift_report_id IS NOT NULL
)
AND status != 'VERIFIED';

-- Show results
SELECT COUNT(*) as updated_shifts_count
FROM shifts
WHERE id IN (
    SELECT DISTINCT related_shift_report_id 
    FROM finance_transactions 
    WHERE related_shift_report_id IS NOT NULL
)
AND status = 'VERIFIED';
