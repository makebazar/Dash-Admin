-- Migration: Add multiple barcodes support to warehouse products
-- Adds a barcodes array column to store multiple GTINs/SKUs for a single product.

ALTER TABLE warehouse_products 
ADD COLUMN IF NOT EXISTS barcodes TEXT[] DEFAULT '{}';

-- Create a GIN index for efficient searching in the barcodes array
CREATE INDEX IF NOT EXISTS idx_warehouse_products_barcodes ON warehouse_products USING GIN (barcodes);

-- Migrate existing single barcode to the new barcodes array
UPDATE warehouse_products 
SET barcodes = ARRAY[barcode] 
WHERE barcode IS NOT NULL AND barcode != '' AND (barcodes IS NULL OR array_length(barcodes, 1) IS NULL);
