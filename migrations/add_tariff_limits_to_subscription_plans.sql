-- Добавляем поля лимитов в subscription_plans для полноценного управления тарифами
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_clubs INTEGER;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_employees_per_club INTEGER;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_shifts_per_month INTEGER;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_storage_gb INTEGER;

-- Создаём таблицу для модулей/фич тарифа (раширенные возможности)
CREATE TABLE IF NOT EXISTS tariff_features (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER REFERENCES subscription_plans(id) ON DELETE CASCADE,
    feature_key VARCHAR(100) NOT NULL,
    feature_label VARCHAR(255) NOT NULL,
    feature_icon VARCHAR(50),
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tariff_features_plan ON tariff_features(plan_id, display_order);

-- Устанавливаем дефолтные лимиты для существующих планов
UPDATE subscription_plans SET 
    max_clubs = CASE code 
        WHEN 'new_user' THEN 1
        WHEN 'starter' THEN 1
        WHEN 'pro' THEN 3
        WHEN 'enterprise' THEN NULL  -- безлимит
        ELSE 1
    END,
    max_employees_per_club = CASE code
        WHEN 'new_user' THEN 3
        WHEN 'starter' THEN 15
        WHEN 'pro' THEN 50
        WHEN 'enterprise' THEN NULL  -- безлимит
        ELSE 3
    END,
    max_shifts_per_month = CASE code
        WHEN 'new_user' THEN 100
        WHEN 'starter' THEN 500
        WHEN 'pro' THEN 2000
        WHEN 'enterprise' THEN NULL  -- безлимит
        ELSE 100
    END,
    max_storage_gb = CASE code
        WHEN 'new_user' THEN 1
        WHEN 'starter' THEN 5
        WHEN 'pro' THEN 20
        WHEN 'enterprise' THEN 100
        ELSE 1
    END
WHERE max_clubs IS NULL;

-- Создаём дефолтные фичи для каждого плана (если ещё нет)
INSERT INTO tariff_features (plan_id, feature_key, feature_label, feature_icon, is_enabled, display_order)
SELECT 
    sp.id,
    tf.feature_key,
    tf.feature_label,
    tf.feature_icon,
    tf.is_enabled,
    tf.display_order
FROM subscription_plans sp
CROSS JOIN (
    VALUES 
        ('clubs_management', 'Управление клубами', 'Building2', TRUE, 10),
        ('employees', 'Сотрудники', 'Users', TRUE, 20),
        ('shifts', 'Смены', 'Clock', TRUE, 30),
        ('payroll', 'Расчёт зарплат', 'Calculator', TRUE, 40),
        ('kpi', 'KPI и аналитика', 'BarChart3', TRUE, 50),
        ('inventory', 'Склад и инвентарь', 'Package', FALSE, 60),
        ('evaluations', 'Оценки сотрудников', 'ClipboardCheck', FALSE, 70),
        ('equipment', 'Оборудование', 'Wrench', FALSE, 80),
        ('reports', 'Отчёты', 'FileText', FALSE, 90),
        ('api_access', 'API доступ', 'Code', FALSE, 100),
        ('white_label', 'White Label', 'Palette', FALSE, 110),
        ('priority_support', 'Приоритетная поддержка', 'Headphones', FALSE, 120)
) AS tf(feature_key, feature_label, feature_icon, is_enabled, display_order)
WHERE NOT EXISTS (
    SELECT 1 FROM tariff_features tf2 
    WHERE tf2.plan_id = sp.id AND tf2.feature_key = tf.feature_key
)
ON CONFLICT DO NOTHING;
