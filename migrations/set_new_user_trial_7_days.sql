ALTER TABLE users
ALTER COLUMN subscription_plan SET DEFAULT 'new_user';

INSERT INTO subscription_plans (code, name, price_amount, period_unit, period_value, is_active)
VALUES ('new_user', 'Новый пользователь', 0, 'day', 7, TRUE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    price_amount = EXCLUDED.price_amount,
    period_unit = EXCLUDED.period_unit,
    period_value = EXCLUDED.period_value,
    is_active = TRUE,
    updated_at = NOW();

UPDATE users
SET subscription_plan = 'new_user'
WHERE subscription_plan IS NULL OR subscription_plan = 'trial';

UPDATE users
SET subscription_status = 'trialing'
WHERE subscription_plan = 'new_user'
  AND subscription_status IN ('active', 'trialing');

UPDATE users
SET subscription_started_at = COALESCE(subscription_started_at, NOW()),
    subscription_ends_at = COALESCE(subscription_ends_at, NOW() + INTERVAL '7 days')
WHERE subscription_plan = 'new_user';

UPDATE subscription_plans
SET is_active = FALSE, updated_at = NOW()
WHERE code = 'trial';
