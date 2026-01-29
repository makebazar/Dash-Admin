-- DIAGNOSTIC QUERIES FOR IMPORT TROUBLESHOOTING
-- Run these queries to find the problem

-- ==================================================
-- 1. CHECK IF TRANSACTIONS WERE ACTUALLY CREATED
-- ==================================================
SELECT 
    COUNT(*) as total_transactions,
    SUM(amount) as total_amount,
    type,
    status
FROM finance_transactions
WHERE club_id = 1  -- REPLACE WITH YOUR CLUB_ID
  AND created_at > NOW() - INTERVAL '1 hour'  -- created in last hour
GROUP BY type, status;

-- Expected: You should see rows with type='income' status='completed'


-- ==================================================
-- 2. CHECK CATEGORY OF IMPORTED TRANSACTIONS
-- ==================================================
SELECT 
    ft.id,
    ft.amount,
    ft.type,
    ft.status,
    ft.transaction_date,
    ft.description,
    fc.name as category_name,
    fc.type as category_type
FROM finance_transactions ft
LEFT JOIN finance_categories fc ON ft.category_id = fc.id
WHERE ft.club_id = 1  -- REPLACE WITH YOUR CLUB_ID
  AND ft.created_at > NOW() - INTERVAL '1 hour'
ORDER BY ft.created_at DESC
LIMIT 10;

-- Expected: category_name should be 'Выручка клуба' and category_type should be 'income'


-- ==================================================
-- 3. CHECK IF MIGRATION WAS APPLIED
-- ==================================================
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'finance_transactions'
  AND column_name = 'related_shift_report_id';

-- Expected: data_type should be 'uuid', NOT 'bigint'


-- ==================================================
-- 4. TEST THE ANALYTICS QUERY DIRECTLY
-- ==================================================
SELECT 
    SUM(CASE WHEN type = 'income' AND status = 'completed' THEN amount ELSE 0 END) as total_income,
    SUM(CASE WHEN type = 'expense' AND status = 'completed' THEN amount ELSE 0 END) as total_expense,
    COUNT(CASE WHEN type = 'income' AND status = 'completed' THEN 1 END) as income_count
FROM finance_transactions
WHERE club_id = 1  -- REPLACE WITH YOUR CLUB_ID
  AND transaction_date BETWEEN '2026-01-01' AND '2026-01-31';  -- ADJUST DATES

-- Expected: total_income should match your import amount


-- ==================================================
-- 5. CHECK IF CATEGORY EXISTS AND IS CORRECT
-- ==================================================
SELECT 
    id,
    club_id,
    name,
    type,
    is_active
FROM finance_categories
WHERE name = 'Выручка клуба'
  AND (club_id = 1 OR club_id IS NULL)  -- REPLACE 1 WITH YOUR CLUB_ID
ORDER BY club_id DESC NULLS LAST;

-- Expected: Should return category with type='income' and is_active=true
