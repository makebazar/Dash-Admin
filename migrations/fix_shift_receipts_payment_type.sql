-- Fix shift_receipts_payment_type_check to allow 'bonus' and 'salary'
ALTER TABLE shift_receipts DROP CONSTRAINT IF EXISTS shift_receipts_payment_type_check;

ALTER TABLE shift_receipts
ADD CONSTRAINT shift_receipts_payment_type_check
CHECK (payment_type IN ('cash', 'card', 'mixed', 'other', 'bonus', 'salary'));
