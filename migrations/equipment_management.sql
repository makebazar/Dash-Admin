-- Migration: Comprehensive Equipment Management System
-- This extends the basic PC maintenance to a full equipment tracking system

-- =====================================================
-- 1. WORKPLACES (club_workstations)
-- =====================================================
-- Create table if not exists
CREATE TABLE IF NOT EXISTS club_workstations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    zone TEXT DEFAULT 'General',
    type TEXT DEFAULT 'PC',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for club filtering
CREATE INDEX IF NOT EXISTS idx_workstations_club_id ON club_workstations(club_id);
CREATE INDEX IF NOT EXISTS idx_workstations_type ON club_workstations(type);

-- =====================================================
-- 2. EQUIPMENT (individual items with tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    workstation_id UUID REFERENCES club_workstations(id) ON DELETE SET NULL,
    
    -- Identification
    type TEXT NOT NULL DEFAULT 'OTHER',
    name TEXT NOT NULL,
    identifier TEXT,           -- IMEI, serial number, inventory number
    brand TEXT,
    model TEXT,
    
    -- Warranty
    purchase_date DATE,
    warranty_expires DATE,
    receipt_url TEXT,          -- URL to receipt document
    
    -- Maintenance
    cleaning_interval_days INTEGER DEFAULT 30,
    last_cleaned_at TIMESTAMPTZ,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Equipment type enum values reference:
-- PC, MONITOR, KEYBOARD, MOUSE, MOUSEPAD, HEADSET, CONSOLE, GAMEPAD, VR_HEADSET, CONTROLLER, TV, OTHER

CREATE INDEX IF NOT EXISTS idx_equipment_club ON equipment(club_id);
CREATE INDEX IF NOT EXISTS idx_equipment_workstation ON equipment(workstation_id);
CREATE INDEX IF NOT EXISTS idx_equipment_type ON equipment(type);
CREATE INDEX IF NOT EXISTS idx_equipment_warranty ON equipment(warranty_expires) WHERE warranty_expires IS NOT NULL;

-- =====================================================
-- 3. EQUIPMENT ISSUES (problem reporting)
-- =====================================================
CREATE TABLE IF NOT EXISTS equipment_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
    reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT DEFAULT 'MEDIUM',    -- LOW, MEDIUM, HIGH, CRITICAL
    status TEXT DEFAULT 'OPEN',        -- OPEN, IN_PROGRESS, RESOLVED, CLOSED
    
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_issues_equipment ON equipment_issues(equipment_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON equipment_issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_reporter ON equipment_issues(reported_by);

-- =====================================================
-- 4. EQUIPMENT MAINTENANCE TASKS (flexible scheduling)
-- =====================================================
CREATE TABLE IF NOT EXISTS equipment_maintenance_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    task_type TEXT DEFAULT 'CLEANING',  -- CLEANING, REPAIR, INSPECTION, REPLACEMENT
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'PENDING',      -- PENDING, IN_PROGRESS, COMPLETED, SKIPPED
    
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    
    -- KPI integration
    kpi_points INTEGER DEFAULT 1,
    bonus_earned DECIMAL(10,2),
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate tasks for same equipment on same day
    UNIQUE(equipment_id, due_date, task_type)
);

CREATE INDEX IF NOT EXISTS idx_maint_tasks_equipment ON equipment_maintenance_tasks(equipment_id);
CREATE INDEX IF NOT EXISTS idx_maint_tasks_user ON equipment_maintenance_tasks(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_maint_tasks_status ON equipment_maintenance_tasks(status);
CREATE INDEX IF NOT EXISTS idx_maint_tasks_due ON equipment_maintenance_tasks(due_date);

-- =====================================================
-- 5. EQUIPMENT MOVEMENT HISTORY
-- =====================================================
CREATE TABLE IF NOT EXISTS equipment_moves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
    from_workstation_id UUID REFERENCES club_workstations(id) ON DELETE SET NULL,
    to_workstation_id UUID REFERENCES club_workstations(id) ON DELETE SET NULL,
    moved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    moved_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_moves_equipment ON equipment_moves(equipment_id);
CREATE INDEX IF NOT EXISTS idx_moves_date ON equipment_moves(moved_at);

-- =====================================================
-- 6. MAINTENANCE KPI CONFIGURATION
-- =====================================================
CREATE TABLE IF NOT EXISTS maintenance_kpi_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE UNIQUE,  -- One config per club
    
    enabled BOOLEAN DEFAULT FALSE,
    assignment_mode TEXT DEFAULT 'BOTH',  -- FIXED, FREE_POOL, BOTH
    
    -- Points configuration
    points_per_cleaning INTEGER DEFAULT 1,
    points_per_issue_resolved INTEGER DEFAULT 3,
    bonus_per_point DECIMAL(10,2) DEFAULT 50.00,
    
    -- Multipliers
    on_time_multiplier DECIMAL(3,2) DEFAULT 1.0,
    late_penalty_multiplier DECIMAL(3,2) DEFAULT 0.5,
    
    -- Integration with salary
    include_in_salary BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 7. UPDATE TRIGGER for updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
DROP TRIGGER IF EXISTS update_equipment_updated_at ON equipment;
CREATE TRIGGER update_equipment_updated_at
    BEFORE UPDATE ON equipment
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_maint_kpi_config_updated_at ON maintenance_kpi_config;
CREATE TRIGGER update_maint_kpi_config_updated_at
    BEFORE UPDATE ON maintenance_kpi_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. DEFAULT EQUIPMENT TYPES TABLE (for UI dropdowns)
-- =====================================================
CREATE TABLE IF NOT EXISTS equipment_types (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    name_ru TEXT NOT NULL,
    default_cleaning_interval INTEGER DEFAULT 30,
    icon TEXT,
    sort_order INTEGER DEFAULT 0
);

-- Insert default equipment types
INSERT INTO equipment_types (code, name, name_ru, default_cleaning_interval, icon, sort_order)
VALUES 
    ('PC', 'PC Tower', 'Системный блок', 30, 'monitor', 1),
    ('MONITOR', 'Monitor', 'Монитор', 14, 'monitor', 2),
    ('KEYBOARD', 'Keyboard', 'Клавиатура', 7, 'keyboard', 3),
    ('MOUSE', 'Mouse', 'Мышь', 7, 'mouse', 4),
    ('MOUSEPAD', 'Mousepad', 'Коврик', 14, 'square', 5),
    ('HEADSET', 'Headset', 'Наушники', 7, 'headphones', 6),
    ('CONSOLE', 'Console', 'Игровая консоль', 30, 'gamepad-2', 7),
    ('GAMEPAD', 'Gamepad', 'Геймпад', 3, 'gamepad', 8),
    ('VR_HEADSET', 'VR Headset', 'VR шлем', 1, 'glasses', 9),
    ('TV', 'TV/Display', 'Телевизор/Дисплей', 14, 'tv', 10),
    ('OTHER', 'Other', 'Другое', 30, 'box', 99)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    name_ru = EXCLUDED.name_ru,
    default_cleaning_interval = EXCLUDED.default_cleaning_interval,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order;

-- =====================================================
-- DONE!
-- =====================================================
