-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ROLES
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    default_kpi_settings JSONB DEFAULT '{}'
);

-- USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL UNIQUE,
    role_id INTEGER REFERENCES roles(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- CLUBS
CREATE TABLE IF NOT EXISTS clubs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    owner_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- SCHEDULE SLOTS
CREATE TABLE IF NOT EXISTS schedule_slots (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    start_plan TIMESTAMP NOT NULL,
    end_plan TIMESTAMP NOT NULL,
    club_id INTEGER NOT NULL REFERENCES clubs(id)
);

-- SHIFT REPORTS (Must be before shifts due to FK)
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
    status VARCHAR(20) DEFAULT 'OPEN' -- OPEN, CLOSED, VERIFIED
);

-- SHIFTS
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    check_in TIMESTAMP,
    check_out TIMESTAMP,
    total_hours DECIMAL(10, 2),
    
    -- SNAPSHOTS
    salary_snapshot JSONB,
    final_salary_amount DECIMAL(10, 2),
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, CLOSED, PAID
    
    shift_report_id BIGINT REFERENCES shift_reports(id)
);

-- TRANSACTION CATEGORIES
CREATE TABLE IF NOT EXISTS transaction_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL -- INCOME, EXPENSE
);

-- TRANSACTIONS
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shift_report_id BIGINT REFERENCES shift_reports(id),
    created_at TIMESTAMP DEFAULT NOW(),
    
    category_id INTEGER NOT NULL REFERENCES transaction_categories(id),
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL, -- CASH, CARD
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

-- VERIFICATION CODES (Auth)
CREATE TABLE IF NOT EXISTS verification_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(50) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '5 minutes',
    created_at TIMESTAMP DEFAULT NOW()
);
