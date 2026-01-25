-- Fix system_metrics table and populate defaults

-- 1. Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_metrics (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) NOT NULL,
    label VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL,
    category VARCHAR(50) NOT NULL,
    is_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Ensure UNIQUE constraint exists on 'key'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_metrics_key_key') THEN
        ALTER TABLE system_metrics ADD CONSTRAINT system_metrics_key_key UNIQUE (key);
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error adding unique constraint: %', SQLERRM;
END $$;

-- 3. Insert default metrics
INSERT INTO system_metrics (key, label, type, category, is_required, description) VALUES
('cash_income', 'Выручка (Наличные)', 'MONEY', 'FINANCE', true, 'Сумма наличных за смену'),
('card_income', 'Выручка (Безнал)', 'MONEY', 'FINANCE', true, 'Сумма по терминалу за смену'),
('expenses_cash', 'Расходы (Наличные)', 'MONEY', 'FINANCE', false, 'Расходы из кассы'),
('shift_comment', 'Комментарий к смене', 'TEXT', 'OPERATIONS', false, 'Текстовый отчет')
ON CONFLICT (key) DO UPDATE SET
    label = EXCLUDED.label,
    type = EXCLUDED.type,
    category = EXCLUDED.category,
    is_required = EXCLUDED.is_required,
    description = EXCLUDED.description;
