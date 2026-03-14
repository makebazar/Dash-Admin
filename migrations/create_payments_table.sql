-- Create payments table to track salary payments
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'CASH', -- CASH, CARD, BANK_TRANSFER
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(club_id, user_id, month, year, created_at) -- Allow multiple payments per month
);

CREATE INDEX IF NOT EXISTS idx_payments_club_user ON payments(club_id, user_id);
CREATE INDEX IF NOT EXISTS idx_payments_period ON payments(year, month);

COMMENT ON TABLE payments IS 'Records of salary payments to employees';
COMMENT ON COLUMN payments.amount IS 'Payment amount in rubles';
COMMENT ON COLUMN payments.payment_method IS 'Payment method: CASH, CARD, BANK_TRANSFER';
