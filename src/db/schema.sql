-- DashAdmin Complete Database Schema
-- This file is automatically applied on container startup
-- All statements use IF NOT EXISTS / IF EXISTS for idempotency

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE TABLES
-- ============================================

-- ROLES
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    default_kpi_settings JSONB DEFAULT '{}'
);

-- Insert default roles
INSERT INTO roles (name, default_kpi_settings) VALUES ('Админ', '{}')
ON CONFLICT (name) DO NOTHING;
INSERT INTO roles (name, default_kpi_settings) VALUES ('Управляющий', '{}')
ON CONFLICT (name) DO NOTHING;

-- USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL UNIQUE,
    role_id INTEGER REFERENCES roles(id),
    is_active BOOLEAN DEFAULT TRUE,
    password_hash VARCHAR(255),
    subscription_plan VARCHAR(50) DEFAULT 'trial',
    subscription_started_at TIMESTAMP,
    subscription_ends_at TIMESTAMP,
    is_super_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- CLUBS
CREATE TABLE IF NOT EXISTS clubs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    owner_id UUID NOT NULL REFERENCES users(id),
    timezone VARCHAR(50) DEFAULT 'Europe/Moscow',
    default_monthly_shifts INTEGER DEFAULT 20,
    created_at TIMESTAMP DEFAULT NOW()
);

-- EMPLOYEES (link users to clubs)
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(club_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_employees_club ON employees(club_id);

-- VERIFICATION CODES (Auth)
CREATE TABLE IF NOT EXISTS verification_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(50) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '5 minutes',
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- SHIFT MANAGEMENT
-- ============================================

-- SHIFT REPORTS
CREATE TABLE IF NOT EXISTS shift_reports (
    id BIGSERIAL PRIMARY KEY,
    opened_by_admin_id UUID NOT NULL REFERENCES users(id),
    closed_by_admin_id UUID REFERENCES users(id),
    opened_at TIMESTAMP DEFAULT NOW(),
    closed_at TIMESTAMP,
    revenue_cash DECIMAL(10, 2) DEFAULT 0,
    revenue_card DECIMAL(10, 2) DEFAULT 0,
    total_revenue DECIMAL(10, 2) DEFAULT 0,
    total_expenses DECIMAL(10, 2) DEFAULT 0,
    expected_balance DECIMAL(10, 2) DEFAULT 0,
    actual_balance DECIMAL(10, 2) DEFAULT 0,
    diff_balance DECIMAL(10, 2) DEFAULT 0,
    admin_comment TEXT,
    status VARCHAR(20) DEFAULT 'OPEN'
);

-- SHIFTS
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    club_id INTEGER REFERENCES clubs(id),
    check_in TIMESTAMP,
    check_out TIMESTAMP,
    total_hours DECIMAL(10, 2),
    salary_snapshot JSONB,
    final_salary_amount DECIMAL(10, 2),
    calculated_salary DECIMAL(10,2),
    salary_breakdown JSONB,
    shift_type VARCHAR(20) DEFAULT 'regular',
    report_data JSONB DEFAULT '{}',
    cash_revenue DECIMAL(10,2) DEFAULT 0,
    card_revenue DECIMAL(10,2) DEFAULT 0,
    expenses DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    shift_report_id BIGINT REFERENCES shift_reports(id)
);

-- EMPLOYEE SHIFT SCHEDULES
CREATE TABLE IF NOT EXISTS employee_shift_schedules (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    schedule_type VARCHAR(20) NOT NULL DEFAULT 'pattern',
    pattern JSONB,
    start_date DATE,
    month_target INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- SALARY MANAGEMENT
-- ============================================

-- SALARY SCHEMES
CREATE TABLE IF NOT EXISTS salary_schemes (
    id SERIAL PRIMARY KEY,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    period_bonuses JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_salary_schemes_club ON salary_schemes(club_id);

-- SALARY SCHEME VERSIONS
CREATE TABLE IF NOT EXISTS salary_scheme_versions (
    id SERIAL PRIMARY KEY,
    scheme_id INTEGER REFERENCES salary_schemes(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    formula JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(scheme_id, version)
);
CREATE INDEX IF NOT EXISTS idx_salary_scheme_versions_scheme ON salary_scheme_versions(scheme_id);

-- EMPLOYEE SALARY ASSIGNMENTS
CREATE TABLE IF NOT EXISTS employee_salary_assignments (
    id SERIAL PRIMARY KEY,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    scheme_id INTEGER REFERENCES salary_schemes(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(club_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_employee_salary_club ON employee_salary_assignments(club_id);

-- SALARY PAYMENTS
CREATE TABLE IF NOT EXISTS salary_payments (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_type VARCHAR(20) NOT NULL,
    comment TEXT,
    paid_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_salary_payments_club ON salary_payments(club_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_user ON salary_payments(user_id);

-- ============================================
-- SYSTEM METRICS
-- ============================================

CREATE TABLE IF NOT EXISTS system_metrics (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL,
    category VARCHAR(50) NOT NULL,
    is_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default metrics
INSERT INTO system_metrics (key, label, type, category, is_required, description) VALUES
('cash_income', 'Выручка (Наличные)', 'MONEY', 'FINANCE', true, 'Сумма наличных за смену'),
('card_income', 'Выручка (Безнал)', 'MONEY', 'FINANCE', true, 'Сумма по терминалу за смену'),
('expenses_cash', 'Расходы (Наличные)', 'MONEY', 'FINANCE', false, 'Расходы из кассы'),
('shift_comment', 'Комментарий к смене', 'TEXT', 'OPERATIONS', false, 'Текстовый отчет')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- REPORT TEMPLATES
-- ============================================

CREATE TABLE IF NOT EXISTS club_report_templates (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(100) DEFAULT 'Основной отчет',
    schema JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TRANSACTIONS & PRODUCTS
-- ============================================

-- TRANSACTION CATEGORIES
CREATE TABLE IF NOT EXISTS transaction_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL
);

-- TRANSACTIONS
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shift_report_id BIGINT REFERENCES shift_reports(id),
    created_at TIMESTAMP DEFAULT NOW(),
    category_id INTEGER NOT NULL REFERENCES transaction_categories(id),
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL,
    description TEXT,
    created_by_id UUID NOT NULL REFERENCES users(id)
);

-- PRODUCTS
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    cost_price DECIMAL(10, 2) NOT NULL,
    margin_percent DECIMAL(5, 2) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- PRODUCT SALES
CREATE TABLE IF NOT EXISTS product_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    sold_at_price DECIMAL(10, 2) NOT NULL
);

-- SCHEDULE SLOTS
CREATE TABLE IF NOT EXISTS schedule_slots (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    start_plan TIMESTAMP NOT NULL,
    end_plan TIMESTAMP NOT NULL,
    club_id INTEGER NOT NULL REFERENCES clubs(id)
);
