-- Finance Management System Migration
-- Comprehensive financial tracking with categories, transactions, recurring payments, credits, and reminders

-- ============================================
-- 1. FINANCE CATEGORIES
-- ============================================

CREATE TABLE IF NOT EXISTS finance_categories (
    id SERIAL PRIMARY KEY,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    icon VARCHAR(50) DEFAULT '💰',
    color VARCHAR(20) DEFAULT '#3b82f6',
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(club_id, name, type)
);

CREATE INDEX IF NOT EXISTS idx_finance_categories_club ON finance_categories(club_id);
CREATE INDEX IF NOT EXISTS idx_finance_categories_type ON finance_categories(club_id, type, is_active);

-- Insert system categories
INSERT INTO finance_categories (club_id, name, type, icon, color, is_system) VALUES
(NULL, 'Выручка клуба', 'income', '💵', '#10b981', TRUE),
(NULL, 'Прочие доходы', 'income', '📈', '#3b82f6', TRUE),
(NULL, 'Аренда помещения', 'expense', '🏢', '#ef4444', TRUE),
(NULL, 'Коммунальные услуги', 'expense', '⚡', '#f59e0b', TRUE),
(NULL, 'Зарплата сотрудников', 'expense', '👥', '#8b5cf6', TRUE),
(NULL, 'Обслуживание оборудования', 'expense', '🔧', '#06b6d4', TRUE),
(NULL, 'Закупка товаров', 'expense', '📦', '#ec4899', TRUE),
(NULL, 'Маркетинг и реклама', 'expense', '📢', '#f97316', TRUE),
(NULL, 'Налоги и сборы', 'expense', '🏛️', '#6366f1', TRUE),
(NULL, 'Прочие расходы', 'expense', '💸', '#64748b', TRUE)
ON CONFLICT (club_id, name, type) DO NOTHING;

COMMENT ON TABLE finance_categories IS 'Категории доходов и расходов';
COMMENT ON COLUMN finance_categories.is_system IS 'Системные категории нельзя удалить';

-- ============================================
-- 2. FINANCE TRANSACTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS finance_transactions (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES finance_categories(id),
    amount DECIMAL(12, 2) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    payment_method VARCHAR(30) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'other')),
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('planned', 'pending', 'completed', 'cancelled')),
    transaction_date DATE NOT NULL,
    description TEXT,
    notes TEXT,
    attachment_url TEXT,
    
    -- Links to other entities
    related_payment_id INTEGER REFERENCES payments(id),
    related_shift_report_id BIGINT REFERENCES shift_reports(id),
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_club ON finance_transactions(club_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_date ON finance_transactions(club_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_category ON finance_transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_status ON finance_transactions(club_id, status);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_type ON finance_transactions(club_id, type);

COMMENT ON TABLE finance_transactions IS 'Все финансовые транзакции клуба';
COMMENT ON COLUMN finance_transactions.payment_method IS 'Способ оплаты: cash, card, bank_transfer, other';
COMMENT ON COLUMN finance_transactions.status IS 'Статус: planned=запланировано, pending=ожидает, completed=выполнено, cancelled=отменено';

-- ============================================
-- 3. RECURRING PAYMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS recurring_payments (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES finance_categories(id),
    name VARCHAR(200) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    
    -- Recurrence settings
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    interval INTEGER DEFAULT 1, -- every N days/weeks/months/years
    day_of_month INTEGER, -- for monthly: 1-31, NULL для daily/weekly
    day_of_week INTEGER, -- for weekly: 0=Sunday, 6=Saturday
    
    -- Advanced split payments (for rent with advance)
    has_split BOOLEAN DEFAULT FALSE,
    split_config JSONB, -- [{amount: 25000, day: 1}, {amount: 25000, day: 15}]
    
    payment_method VARCHAR(30) DEFAULT 'cash',
    start_date DATE NOT NULL,
    payment_method VARCHAR(30) DEFAULT 'cash',
    start_date DATE NOT NULL,
    end_date DATE,

    -- Consumption settings
    account_id INTEGER REFERENCES finance_accounts(id),
    is_consumption_based BOOLEAN DEFAULT FALSE,
    consumption_unit VARCHAR(20),
    default_unit_price DECIMAL(12, 2),

    is_active BOOLEAN DEFAULT TRUE,
    last_generated_date DATE,
    next_generation_date DATE,
    
    description TEXT,
    notes TEXT,
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_payments_club ON recurring_payments(club_id);
CREATE INDEX IF NOT EXISTS idx_recurring_payments_active ON recurring_payments(club_id, is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_payments_next_gen ON recurring_payments(next_generation_date);

COMMENT ON TABLE recurring_payments IS 'Шаблоны повторяющихся платежей';
COMMENT ON COLUMN recurring_payments.split_config IS 'Конфигурация для разделенных платежей (аренда с авансом)';
COMMENT ON COLUMN recurring_payments.interval IS 'Интервал повторения (каждые N дней/недель/месяцев)';

-- ============================================
-- 4. FINANCE CREDITS (Loans)
-- ============================================

CREATE TABLE IF NOT EXISTS finance_credits (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    
    -- Credit details
    name VARCHAR(200) NOT NULL,
    creditor VARCHAR(200) NOT NULL, -- кредитор/заимодавец
    total_amount DECIMAL(12, 2) NOT NULL,
    remaining_amount DECIMAL(12, 2) NOT NULL,
    interest_rate DECIMAL(5, 2) DEFAULT 0, -- процентная ставка %
    
    -- Payment schedule
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    payment_day INTEGER, -- день месяца для платежа
    monthly_payment DECIMAL(12, 2), -- ежемесячный платеж
    
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paid', 'cancelled')),
    
    description TEXT,
    notes TEXT,
    contract_number VARCHAR(100),
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_credits_club ON finance_credits(club_id);
CREATE INDEX IF NOT EXISTS idx_finance_credits_status ON finance_credits(club_id, status);

-- Credit payment history
CREATE TABLE IF NOT EXISTS finance_credit_payments (
    id SERIAL PRIMARY KEY,
    credit_id INTEGER NOT NULL REFERENCES finance_credits(id) ON DELETE CASCADE,
    transaction_id INTEGER REFERENCES finance_transactions(id),
    
    payment_date DATE NOT NULL,
    principal_amount DECIMAL(12, 2) NOT NULL, -- основной долг
    interest_amount DECIMAL(12, 2) DEFAULT 0, -- проценты
    total_amount DECIMAL(12, 2) NOT NULL,
    
    remaining_balance DECIMAL(12, 2) NOT NULL,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_payments_credit ON finance_credit_payments(credit_id);

COMMENT ON TABLE finance_credits IS 'Учет кредитов и займов';
COMMENT ON TABLE finance_credit_payments IS 'История платежей по кредитам';

-- ============================================
-- 5. FINANCE REMINDERS
-- ============================================

CREATE TABLE IF NOT EXISTS finance_reminders (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    
    -- What to remind about
    reminder_type VARCHAR(20) NOT NULL CHECK (reminder_type IN ('transaction', 'recurring', 'credit')),
    related_transaction_id INTEGER REFERENCES finance_transactions(id) ON DELETE CASCADE,
    related_recurring_id INTEGER REFERENCES recurring_payments(id) ON DELETE CASCADE,
    related_credit_id INTEGER REFERENCES finance_credits(id) ON DELETE CASCADE,
    
    title VARCHAR(200) NOT NULL,
    description TEXT,
    amount DECIMAL(12, 2),
    
    -- When to remind
    remind_date DATE NOT NULL,
    days_before INTEGER DEFAULT 3, -- напомнить за N дней
    
    -- Notification settings
    notify_email BOOLEAN DEFAULT FALSE,
    notify_push BOOLEAN DEFAULT TRUE,
    notify_telegram BOOLEAN DEFAULT FALSE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'viewed', 'completed', 'dismissed')),
    sent_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_reminders_club ON finance_reminders(club_id);
CREATE INDEX IF NOT EXISTS idx_finance_reminders_date ON finance_reminders(remind_date, status);
CREATE INDEX IF NOT EXISTS idx_finance_reminders_status ON finance_reminders(club_id, status);

COMMENT ON TABLE finance_reminders IS 'Напоминания о предстоящих платежах';
COMMENT ON COLUMN finance_reminders.days_before IS 'За сколько дней напомнить до события';

-- ============================================
-- 6. SALARY ADVANCE REQUESTS
-- ============================================

CREATE TABLE IF NOT EXISTS salary_advance_requests (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    requested_amount DECIMAL(10, 2) NOT NULL,
    approved_amount DECIMAL(10, 2),
    
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
    
    request_date TIMESTAMP DEFAULT NOW(),
    approved_date TIMESTAMP,
    paid_date TIMESTAMP,
    
    approved_by UUID REFERENCES users(id),
    payment_id INTEGER REFERENCES payments(id),
    transaction_id INTEGER REFERENCES finance_transactions(id),
    
    reason TEXT,
    admin_notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advance_requests_club ON salary_advance_requests(club_id);
CREATE INDEX IF NOT EXISTS idx_advance_requests_employee ON salary_advance_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_advance_requests_status ON salary_advance_requests(club_id, status);

COMMENT ON TABLE salary_advance_requests IS 'Запросы сотрудников на аванс';
COMMENT ON COLUMN salary_advance_requests.status IS 'pending=ожидает, approved=одобрен, rejected=отклонен, paid=выплачен';

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to relevant tables
DROP TRIGGER IF EXISTS update_finance_transactions_updated_at ON finance_transactions;
CREATE TRIGGER update_finance_transactions_updated_at BEFORE UPDATE ON finance_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recurring_payments_updated_at ON recurring_payments;
CREATE TRIGGER update_recurring_payments_updated_at BEFORE UPDATE ON recurring_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_finance_credits_updated_at ON finance_credits;
CREATE TRIGGER update_finance_credits_updated_at BEFORE UPDATE ON finance_credits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
