-- Упрощаем subscription_plans: убираем лимиты, добавляем price_per_extra_club и grace_period_days
-- Удаляем таблицу tariff_features
DROP TABLE IF EXISTS tariff_features;

-- Удаляем ненужные колонки лимитов
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS max_clubs;
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS max_employees_per_club;
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS max_shifts_per_month;
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS max_storage_gb;
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS features;
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS badge_text;
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS badge_tone;
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS cta_text;
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS card_theme;
ALTER TABLE subscription_plans DROP COLUMN IF EXISTS is_highlighted;

-- Добавляем новые поля
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS price_per_extra_club DECIMAL(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS grace_period_days INTEGER NOT NULL DEFAULT 7;

-- Обновляем дефолтные тарифы
UPDATE subscription_plans SET 
    price_per_extra_club = 1500,
    grace_period_days = 7,
    period_unit = 'month',
    period_value = 1
WHERE code = 'starter';

-- Делаем годовой тариф если есть или создаём
INSERT INTO subscription_plans (code, name, tagline, description, price_amount, price_per_extra_club, period_unit, period_value, grace_period_days, display_order, is_active)
VALUES ('annual', 'Годовой', 'Выгоднее на 20%', 'Оплата за год вперёд', 27840, 14400, 'year', 1, 14, 20, TRUE)
ON CONFLICT (code) DO NOTHING;

UPDATE subscription_plans SET 
    price_per_extra_club = 14400,
    grace_period_days = 14
WHERE code = 'annual';

-- Деактивируем старые тарифы
UPDATE subscription_plans SET is_active = FALSE WHERE code IN ('new_user', 'pro', 'enterprise', 'trial');
