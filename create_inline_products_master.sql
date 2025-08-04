-- SQL to create inline_products_master table
-- Based on the table structure shown in the image with columns: customer, prod_code, spec, location

CREATE TABLE IF NOT EXISTS inline_products_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer TEXT NOT NULL,
    prod_code TEXT NOT NULL,
    spec TEXT NOT NULL,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Add comments to describe the table and columns
COMMENT ON TABLE inline_products_master IS 'Master table for inline products with customer, product code, specification, and location';
COMMENT ON COLUMN inline_products_master.customer IS 'Customer name or identifier';
COMMENT ON COLUMN inline_products_master.prod_code IS 'Product code identifier';
COMMENT ON COLUMN inline_products_master.spec IS 'Product specification details';
COMMENT ON COLUMN inline_products_master.location IS 'Location or facility information';
COMMENT ON COLUMN inline_products_master.is_active IS 'Flag to indicate if the record is active';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_inline_products_master_customer ON inline_products_master(customer);
CREATE INDEX IF NOT EXISTS idx_inline_products_master_prod_code ON inline_products_master(prod_code);
CREATE INDEX IF NOT EXISTS idx_inline_products_master_active ON inline_products_master(is_active);

-- Create a unique constraint to prevent duplicate product entries
-- (assuming combination of customer, prod_code, and spec should be unique)
ALTER TABLE inline_products_master 
ADD CONSTRAINT unique_product_combination 
UNIQUE (customer, prod_code, spec);

-- Create a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_inline_products_master_updated_at 
    BEFORE UPDATE ON inline_products_master 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Optional: Insert some sample data for testing
-- INSERT INTO inline_products_master (customer, prod_code, spec, location) VALUES
--     ('Customer A', 'PROD001', '16 GSM Kranti Film', 'Factory A'),
--     ('Customer B', 'PROD002', '20 GSM Standard Film', 'Factory B'),
--     ('Customer C', 'PROD003', '25 GSM Premium Film', 'Factory A');

-- Verify the table structure
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns 
-- WHERE table_name = 'inline_products_master'
-- ORDER BY ordinal_position; 