ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS tagline VARCHAR(255);
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS features JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS badge_text VARCHAR(100);
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS badge_tone VARCHAR(30) NOT NULL DEFAULT 'default';
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS cta_text VARCHAR(100);
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS card_theme VARCHAR(30) NOT NULL DEFAULT 'light';
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 100;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE subscription_plans
SET tagline = COALESCE(tagline, '7 дней доступа'),
    description = COALESCE(description, 'Подходит для быстрого старта нового клуба'),
    features = CASE WHEN jsonb_typeof(features) = 'array' THEN features ELSE '[]'::jsonb END,
    badge_text = COALESCE(badge_text, 'Старт'),
    badge_tone = COALESCE(badge_tone, 'info'),
    cta_text = COALESCE(cta_text, 'Начать бесплатно'),
    card_theme = COALESCE(card_theme, 'light'),
    display_order = COALESCE(display_order, 10),
    is_highlighted = COALESCE(is_highlighted, FALSE)
WHERE code = 'new_user';

UPDATE subscription_plans
SET tagline = COALESCE(tagline, 'Для небольшого клуба'),
    description = COALESCE(description, 'Оптимальный тариф для стабильной работы'),
    features = CASE WHEN jsonb_typeof(features) = 'array' THEN features ELSE '[]'::jsonb END,
    badge_tone = COALESCE(badge_tone, 'default'),
    cta_text = COALESCE(cta_text, 'Выбрать Стартовый'),
    card_theme = COALESCE(card_theme, 'light'),
    display_order = COALESCE(display_order, 20),
    is_highlighted = COALESCE(is_highlighted, FALSE)
WHERE code = 'starter';

UPDATE subscription_plans
SET tagline = COALESCE(tagline, 'Для роста сети'),
    description = COALESCE(description, 'Расширенные лимиты и аналитика'),
    features = CASE WHEN jsonb_typeof(features) = 'array' THEN features ELSE '[]'::jsonb END,
    badge_text = COALESCE(badge_text, 'Популярный'),
    badge_tone = COALESCE(badge_tone, 'success'),
    cta_text = COALESCE(cta_text, 'Перейти на Про'),
    card_theme = COALESCE(card_theme, 'dark'),
    display_order = COALESCE(display_order, 30),
    is_highlighted = TRUE
WHERE code = 'pro';

UPDATE subscription_plans
SET tagline = COALESCE(tagline, 'Без ограничений'),
    description = COALESCE(description, 'Максимальные возможности для сети клубов'),
    features = CASE WHEN jsonb_typeof(features) = 'array' THEN features ELSE '[]'::jsonb END,
    badge_text = COALESCE(badge_text, 'Максимум'),
    badge_tone = COALESCE(badge_tone, 'warning'),
    cta_text = COALESCE(cta_text, 'Связаться с нами'),
    card_theme = COALESCE(card_theme, 'accent'),
    display_order = COALESCE(display_order, 40),
    is_highlighted = COALESCE(is_highlighted, FALSE)
WHERE code = 'enterprise';
