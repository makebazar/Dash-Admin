CREATE TABLE IF NOT EXISTS shift_zone_discrepancy_resolutions (
    id BIGSERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES warehouse_products(id) ON DELETE CASCADE,
    resolution_type VARCHAR(30) NOT NULL CHECK (resolution_type IN ('SALARY_DEDUCTION', 'LOSS')),
    resolution_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    discrepancy_quantity INTEGER NOT NULL DEFAULT 0,
    unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    salary_payment_id INTEGER REFERENCES salary_payments(id) ON DELETE SET NULL,
    finance_transaction_id INTEGER REFERENCES finance_transactions(id) ON DELETE SET NULL,
    resolved_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    resolved_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (shift_id, warehouse_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_shift_zone_resolutions_shift
    ON shift_zone_discrepancy_resolutions(shift_id);

CREATE INDEX IF NOT EXISTS idx_shift_zone_resolutions_club
    ON shift_zone_discrepancy_resolutions(club_id, resolved_at DESC);
