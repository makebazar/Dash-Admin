-- Warehouse Front/Back Stock Feature

-- 1. Add Front/Back Stock columns to Products
-- front_stock: Quantity on display (fridge, shelf)
-- back_stock: Quantity in storage
-- max_front_stock: Capacity of the display (how much fits)
-- min_front_stock: Threshold to trigger restock task
ALTER TABLE warehouse_products 
ADD COLUMN IF NOT EXISTS front_stock INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS back_stock INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_front_stock INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_front_stock INTEGER DEFAULT 0;

-- 2. Create Tasks Table for Employees (if not exists)
-- This table will hold restocking tasks and potentially other tasks
CREATE TABLE IF NOT EXISTS club_tasks (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- RESTOCK, CLEANING, CHECKLIST, etc.
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, CANCELLED
    priority VARCHAR(20) DEFAULT 'MEDIUM', -- HIGH, MEDIUM, LOW
    
    related_entity_type VARCHAR(50), -- PRODUCT
    related_entity_id INTEGER,
    
    assigned_to UUID REFERENCES users(id), -- Specific user or NULL for any employee
    created_by UUID REFERENCES users(id), -- System or Admin
    completed_by UUID REFERENCES users(id),
    
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    due_date TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_club_tasks_club ON club_tasks(club_id);
CREATE INDEX IF NOT EXISTS idx_club_tasks_status ON club_tasks(status);
