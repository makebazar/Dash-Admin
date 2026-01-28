-- Fix duplicate finance categories
-- This script removes duplicate system categories while preserving one copy

-- Step 1: Identify and keep only the first occurrence of each duplicate
WITH duplicates AS (
    SELECT id, 
           ROW_NUMBER() OVER (
               PARTITION BY club_id, name, type 
               ORDER BY id ASC
           ) as row_num
    FROM finance_categories
    WHERE is_system = TRUE
)
DELETE FROM finance_categories
WHERE id IN (
    SELECT id 
    FROM duplicates 
    WHERE row_num > 1
);

-- Step 2: Verify no duplicates remain
SELECT name, type, COUNT(*) as count
FROM finance_categories
WHERE club_id IS NULL AND is_system = TRUE
GROUP BY name, type
HAVING COUNT(*) > 1;

-- If the above query returns results, there are still duplicates

-- Step 3: Show final system categories count (should be 10)
SELECT COUNT(*) as total_system_categories
FROM finance_categories
WHERE club_id IS NULL AND is_system = TRUE;
