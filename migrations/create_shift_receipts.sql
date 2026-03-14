-- Shift Receipts (POS-like checks during shift; committed to stock movements on shift close)

CREATE TABLE IF NOT EXISTS shift_receipts (
    id BIGSERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('cash', 'card', 'mixed', 'other')),
    cash_amount DECIMAL(10, 2) DEFAULT 0,
    card_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    voided_at TIMESTAMP,
    committed_at TIMESTAMP,
    committed_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_shift_receipts_club_shift ON shift_receipts(club_id, shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_receipts_shift_created ON shift_receipts(shift_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shift_receipts_open ON shift_receipts(shift_id) WHERE committed_at IS NULL AND voided_at IS NULL;

CREATE TABLE IF NOT EXISTS shift_receipt_items (
    id BIGSERIAL PRIMARY KEY,
    receipt_id BIGINT NOT NULL REFERENCES shift_receipts(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES warehouse_products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    selling_price_snapshot DECIMAL(10, 2) NOT NULL DEFAULT 0,
    cost_price_snapshot DECIMAL(10, 2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_shift_receipt_items_receipt ON shift_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_shift_receipt_items_product ON shift_receipt_items(product_id);

