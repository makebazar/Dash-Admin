-- Add is_super_admin flag to users
ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE;

-- Create system_metrics table
CREATE TABLE system_metrics (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) NOT NULL UNIQUE, -- e.g., 'revenue_cash'
    label VARCHAR(100) NOT NULL,     -- e.g., 'Выручка наличными'
    description TEXT,
    type VARCHAR(20) NOT NULL,       -- 'MONEY', 'NUMBER', 'TEXT', 'BOOLEAN'
    category VARCHAR(50) NOT NULL,   -- 'FINANCE', 'OPERATIONS', 'MARKETING'
    is_required BOOLEAN DEFAULT FALSE, -- Should this metric be required by default?
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed initial basic metrics
INSERT INTO system_metrics (key, label, type, category, is_required, description) VALUES
('cash_income', 'Выручка (Наличные)', 'MONEY', 'FINANCE', true, 'Сумма наличных в кассе за смену'),
('card_income', 'Выручка (Безнал)', 'MONEY', 'FINANCE', true, 'Сумма по терминалу за смену'),
('expenses_cash', 'Расходы (Наличные)', 'MONEY', 'FINANCE', false, 'Расходы из кассы (такси, вода и т.д.)'),
('shift_comment', 'Комментарий к смене', 'TEXT', 'OPERATIONS', false, 'Текстовый отчет администратора');

-- Make user 1 (you) super admin for testing
UPDATE users SET is_super_admin = TRUE WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1);
