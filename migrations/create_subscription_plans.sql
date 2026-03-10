CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    tagline VARCHAR(255),
    description TEXT,
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    badge_text VARCHAR(100),
    badge_tone VARCHAR(30) NOT NULL DEFAULT 'default',
    cta_text VARCHAR(100),
    card_theme VARCHAR(30) NOT NULL DEFAULT 'light',
    display_order INTEGER NOT NULL DEFAULT 100,
    is_highlighted BOOLEAN NOT NULL DEFAULT FALSE,
    price_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    period_unit VARCHAR(20) NOT NULL DEFAULT 'month',
    period_value INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active, created_at DESC);

INSERT INTO subscription_plans (code, name, tagline, description, features, badge_text, badge_tone, cta_text, card_theme, display_order, is_highlighted, price_amount, period_unit, period_value, is_active)
VALUES
    ('new_user', 'Новый пользователь', '7 дней доступа', 'Подходит для быстрого старта нового клуба', '["До 1 клуба","До 3 сотрудников в клубе","Базовый доступ"]'::jsonb, 'Старт', 'info', 'Начать бесплатно', 'light', 10, FALSE, 0, 'day', 7, TRUE),
    ('starter', 'Стартовый', 'Для небольшого клуба', 'Оптимальный тариф для стабильной работы', '["До 1 клуба","До 15 сотрудников в клубе","Базовая аналитика"]'::jsonb, NULL, 'default', 'Выбрать Стартовый', 'light', 20, FALSE, 2900, 'month', 1, TRUE),
    ('pro', 'Про', 'Для роста сети', 'Расширенные лимиты и аналитика', '["До 3 клубов","До 50 сотрудников в клубе","Продвинутая аналитика"]'::jsonb, 'Популярный', 'success', 'Перейти на Про', 'dark', 30, TRUE, 7900, 'month', 1, TRUE),
    ('enterprise', 'Энтерпрайз', 'Без ограничений', 'Максимальные возможности для сети клубов', '["Безлимит клубов","Безлимит сотрудников","Приоритетная поддержка"]'::jsonb, 'Максимум', 'warning', 'Связаться с нами', 'accent', 40, FALSE, 19900, 'month', 1, TRUE)
ON CONFLICT (code) DO NOTHING;
