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
    default_kpi_settings JSONB DEFAULT '{}',
    employee_access_settings JSONB DEFAULT '{}'
);

-- Role Permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    permission_key VARCHAR(100) NOT NULL,
    is_allowed BOOLEAN DEFAULT FALSE,
    UNIQUE(role_id, club_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_club ON role_permissions(role_id, club_id);
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
    subscription_plan VARCHAR(50) DEFAULT 'new_user',
    subscription_status VARCHAR(30) DEFAULT 'trialing',
    subscription_started_at TIMESTAMP DEFAULT NOW(),
    subscription_ends_at TIMESTAMP,
    subscription_canceled_at TIMESTAMP,
    is_super_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

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

-- CLUBS
CREATE TABLE IF NOT EXISTS clubs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    owner_id UUID NOT NULL REFERENCES users(id),
    timezone VARCHAR(50) DEFAULT 'Europe/Moscow',
    day_start_hour INTEGER DEFAULT 9,
    night_start_hour INTEGER DEFAULT 21,
    default_monthly_shifts INTEGER DEFAULT 20,
    inventory_required BOOLEAN DEFAULT FALSE,
    inventory_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- CLUB_EMPLOYEES (link users to clubs)
CREATE TABLE IF NOT EXISTS club_employees (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    hired_at TIMESTAMP DEFAULT NOW(),
    dismissed_at TIMESTAMP,
    show_in_schedule BOOLEAN DEFAULT TRUE,
    UNIQUE(club_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_employees_club ON club_employees(club_id);

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
    report_mode VARCHAR(20) DEFAULT 'FULL_REPORT',
    actor_role_id_snapshot INTEGER,
    actor_role_name_snapshot VARCHAR(50),
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
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    planned_shifts INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(club_id, user_id, month, year)
);
CREATE INDEX IF NOT EXISTS idx_ess_club_period ON employee_shift_schedules(club_id, month, year);

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
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'CASH', -- CASH, CARD, BANK_TRANSFER
    payment_type VARCHAR(20) DEFAULT 'salary',
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(club_id, user_id, month, year, created_at)
);
CREATE INDEX IF NOT EXISTS idx_payments_club_user ON payments(club_id, user_id);
CREATE INDEX IF NOT EXISTS idx_payments_period ON payments(year, month);

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

-- WORK SCHEDULES (New Interactive Grid)
CREATE TABLE IF NOT EXISTS work_schedules (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    shift_type VARCHAR(20) NOT NULL, -- 'DAY', 'NIGHT'
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(club_id, user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_work_schedules_club_date ON work_schedules(club_id, date);
-- WAREHOUSE SYSTEM

-- CATEGORIES
CREATE TABLE IF NOT EXISTS warehouse_categories (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_warehouse_categories_club ON warehouse_categories(club_id);

-- PRODUCTS
CREATE TABLE IF NOT EXISTS warehouse_products (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES warehouse_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    selling_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    current_stock INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_warehouse_products_club ON warehouse_products(club_id);

-- SUPPLIES (INCOMING STOCK)
CREATE TABLE IF NOT EXISTS warehouse_supplies (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    supplier_name VARCHAR(255),
    notes TEXT,
    total_cost DECIMAL(10, 2) DEFAULT 0,
    created_by UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'COMPLETED', -- COMPLETED, DRAFT
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_warehouse_supplies_club ON warehouse_supplies(club_id);

CREATE TABLE IF NOT EXISTS warehouse_supply_items (
    id SERIAL PRIMARY KEY,
    supply_id INTEGER NOT NULL REFERENCES warehouse_supplies(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES warehouse_products(id),
    quantity INTEGER NOT NULL,
    cost_price DECIMAL(10, 2) NOT NULL, -- Snapshot of cost at that time
    total_cost DECIMAL(10, 2)
);
CREATE INDEX IF NOT EXISTS idx_warehouse_supply_items_supply ON warehouse_supply_items(supply_id);

-- INVENTORIES (BLIND CHECK)
CREATE TABLE IF NOT EXISTS warehouse_inventories (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    closed_by UUID REFERENCES users(id),
    canceled_by UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'OPEN', -- OPEN, CLOSED
    started_at TIMESTAMP DEFAULT NOW(),
    closed_at TIMESTAMP,
    canceled_at TIMESTAMP,
    target_metric_key VARCHAR(50), -- The metric key from system_metrics to compare against (e.g. 'bar_revenue')
    sales_capture_mode_snapshot VARCHAR(20),
    reported_revenue DECIMAL(10, 2), -- The value of that metric entered by admin
    calculated_revenue DECIMAL(10, 2), -- Calculated from stock difference
    revenue_difference DECIMAL(10, 2), -- reported - calculated
    notes TEXT,
    warehouse_id INTEGER REFERENCES warehouses(id)
);
CREATE INDEX IF NOT EXISTS idx_warehouse_inventories_club ON warehouse_inventories(club_id);

CREATE TABLE IF NOT EXISTS warehouse_inventory_items (
    id SERIAL PRIMARY KEY,
    inventory_id INTEGER NOT NULL REFERENCES warehouse_inventories(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES warehouse_products(id),
    expected_stock INTEGER NOT NULL, -- Snapshot before count
    actual_stock INTEGER, -- Filled by admin
    adjusted_expected_stock INTEGER,
    stock_before_close INTEGER,
    applied_stock_delta INTEGER,
    difference INTEGER, -- actual - expected (negative means loss/sold)
    cost_price_snapshot DECIMAL(10, 2),
    selling_price_snapshot DECIMAL(10, 2),
    calculated_revenue DECIMAL(10, 2),
    added_manually BOOLEAN NOT NULL DEFAULT FALSE,
    counted_by UUID REFERENCES users(id),
    counted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_items_inventory ON warehouse_inventory_items(inventory_id);

CREATE TABLE IF NOT EXISTS inventory_post_close_corrections (
    id BIGSERIAL PRIMARY KEY,
    inventory_id INTEGER NOT NULL REFERENCES warehouse_inventories(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES warehouse_products(id),
    old_actual_stock INTEGER NOT NULL,
    new_actual_stock INTEGER NOT NULL,
    difference_before INTEGER,
    difference_after INTEGER NOT NULL,
    stock_delta INTEGER NOT NULL,
    reason TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_post_close_corrections_inventory ON inventory_post_close_corrections(inventory_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_post_close_corrections_product ON inventory_post_close_corrections(product_id, created_at DESC);

ALTER TABLE warehouse_inventories
ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS canceled_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS sales_capture_mode_snapshot VARCHAR(20);

ALTER TABLE warehouse_inventory_items
ADD COLUMN IF NOT EXISTS adjusted_expected_stock INTEGER,
ADD COLUMN IF NOT EXISTS stock_before_close INTEGER,
ADD COLUMN IF NOT EXISTS applied_stock_delta INTEGER,
ADD COLUMN IF NOT EXISTS added_manually BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS counted_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS counted_at TIMESTAMP;

ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS shift_zone_key VARCHAR(20),
ADD COLUMN IF NOT EXISTS shift_accountability_enabled BOOLEAN NOT NULL DEFAULT FALSE;
-- WAREHOUSE EXPANSION

-- 1. Expand Categories
ALTER TABLE warehouse_categories 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES warehouse_categories(id) ON DELETE SET NULL;

-- Ensure unique category name per club
CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouse_categories_unique_name_per_club 
ON warehouse_categories(club_id, name);

-- 2. Create Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    type VARCHAR(50) DEFAULT 'GENERAL', -- GENERAL, COLD_STORAGE, KITCHEN, BAR
    shift_zone_key VARCHAR(20), -- BAR, FRIDGE, SHOWCASE, BACKROOM
    shift_accountability_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    responsible_user_id UUID REFERENCES users(id),
    contact_info TEXT,
    characteristics JSONB DEFAULT '{}', -- area, temperature, etc.
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_warehouses_club ON warehouses(club_id);

-- 3. Warehouse Stock (Per-warehouse inventory)
CREATE TABLE IF NOT EXISTS warehouse_stock (
    id SERIAL PRIMARY KEY,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES warehouse_products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(warehouse_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_warehouse ON warehouse_stock(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_product ON warehouse_stock(product_id);

CREATE TABLE IF NOT EXISTS shift_zone_snapshots (
    id BIGSERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES users(id),
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    snapshot_type VARCHAR(10) NOT NULL, -- OPEN, CLOSE
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(shift_id, warehouse_id, snapshot_type)
);
CREATE INDEX IF NOT EXISTS idx_shift_zone_snapshots_shift ON shift_zone_snapshots(shift_id, snapshot_type);
CREATE INDEX IF NOT EXISTS idx_shift_zone_snapshots_warehouse ON shift_zone_snapshots(warehouse_id, snapshot_type);

CREATE TABLE IF NOT EXISTS shift_zone_snapshot_items (
    id BIGSERIAL PRIMARY KEY,
    snapshot_id BIGINT NOT NULL REFERENCES shift_zone_snapshots(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES warehouse_products(id) ON DELETE CASCADE,
    counted_quantity INTEGER NOT NULL,
    system_quantity INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(snapshot_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_shift_zone_snapshot_items_snapshot ON shift_zone_snapshot_items(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_shift_zone_snapshot_items_product ON shift_zone_snapshot_items(product_id);

-- 4. Operation Logs
CREATE TABLE IF NOT EXISTS operation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL, -- CREATE_CATEGORY, CREATE_WAREHOUSE, UPDATE_STOCK
    entity_type VARCHAR(50) NOT NULL, -- CATEGORY, WAREHOUSE, PRODUCT
    entity_id VARCHAR(50),
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_operation_logs_club ON operation_logs(club_id);

-- 5. Add Inventory Settings & Warehouse ID to Inventories (Migration)
ALTER TABLE clubs 
ADD COLUMN IF NOT EXISTS inventory_settings JSONB DEFAULT '{}';

ALTER TABLE warehouse_inventories 
ADD COLUMN IF NOT EXISTS warehouse_id INTEGER REFERENCES warehouses(id);

-- Add calculated_revenue to inventory_items
ALTER TABLE warehouse_inventory_items 
ADD COLUMN IF NOT EXISTS calculated_revenue DECIMAL(10, 2);

-- ============================================
-- RECRUITMENT (CANDIDATE APPLICATIONS)
-- ============================================

CREATE TABLE IF NOT EXISTS recruitment_form_templates (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    position VARCHAR(80),
    schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    public_token VARCHAR(64) UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruitment_form_templates_club ON recruitment_form_templates(club_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_form_templates_token ON recruitment_form_templates(public_token);

CREATE TABLE IF NOT EXISTS recruitment_applications (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    template_id INTEGER NOT NULL REFERENCES recruitment_form_templates(id) ON DELETE CASCADE,
    candidate_name TEXT,
    candidate_phone TEXT,
    candidate_email TEXT,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    auto_score INTEGER,
    manual_score INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'new',
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruitment_applications_club ON recruitment_applications(club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recruitment_applications_template ON recruitment_applications(template_id, created_at DESC);

-- Recruitment tests (separate from form)
CREATE TABLE IF NOT EXISTS recruitment_test_templates (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruitment_test_templates_club ON recruitment_test_templates(club_id);

CREATE TABLE IF NOT EXISTS recruitment_form_template_tests (
    template_id INTEGER NOT NULL REFERENCES recruitment_form_templates(id) ON DELETE CASCADE,
    test_id INTEGER NOT NULL REFERENCES recruitment_test_templates(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (template_id, test_id)
);

CREATE INDEX IF NOT EXISTS idx_recruitment_form_template_tests_template ON recruitment_form_template_tests(template_id, sort_order);

CREATE TABLE IF NOT EXISTS recruitment_application_tests (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES recruitment_applications(id) ON DELETE CASCADE,
    test_id INTEGER NOT NULL REFERENCES recruitment_test_templates(id) ON DELETE CASCADE,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    auto_score INTEGER,
    max_score INTEGER,
    score_percent INTEGER,
    result JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(application_id, test_id)
);

CREATE INDEX IF NOT EXISTS idx_recruitment_application_tests_application ON recruitment_application_tests(application_id, created_at DESC);

ALTER TABLE recruitment_applications
    ALTER COLUMN status SET DEFAULT 'in_progress';
