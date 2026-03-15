-- Таблица для хранения возвратов товаров из чеков
CREATE TABLE IF NOT EXISTS shift_receipt_returns (
    id SERIAL PRIMARY KEY,
    receipt_id INTEGER NOT NULL REFERENCES shift_receipts(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES shift_receipt_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    refund_amount DECIMAL(10, 2) NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_receipt_returns_receipt ON shift_receipt_returns(receipt_id);
CREATE INDEX IF NOT EXISTS idx_shift_receipt_returns_item ON shift_receipt_returns(item_id);

-- Добавим поле для хранения информации о возвратах в чек
ALTER TABLE shift_receipts 
ADD COLUMN IF NOT EXISTS total_refund_amount DECIMAL(10, 2) DEFAULT 0;
