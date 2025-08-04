-- SQL to insert data into inline_products_master table
-- Based on the table data shown in the image

-- Insert P&G products (first 9 rows - removed duplicate)
INSERT INTO inline_products_master (customer, prod_code, spec) VALUES
    ('P&G', 'APE-102(18)C', '18gsmx102mmx5000m'),
    ('P&G', 'APE-168(18)C', '18gsmx168mmx4700m'),
    ('P&G', 'APE-168(18)CP(KRANTI)', '18gsmx168mmx4700m'),
    ('P&G', 'WHITE-214(18)', '18gsmx214mmx6500m'),
    ('P&G', 'WHITE-234(18)', '18gsmx234mmx7000m'),
    ('P&G', 'APE-176(18)CP(LCC+WW)BS', '18gsmx176mmx9000m'),
    ('P&G', 'UWF3-WHITE-214(18)-WW', '18gsmx214mmx6500m'),
    ('P&G', 'APE-168(16)C', '16gsmx168mmx5000m'),
    ('P&G', 'APE-168(16)CP(KRANTI)', '16gsmx168mmx5000m');

-- Insert Unicharm products (last 5 rows)
INSERT INTO inline_products_master (customer, prod_code, spec) VALUES
    ('Unicharm', 'INUE1C18-250P(AB-QR)', '18gsmx250mmx6000m'),
    ('Unicharm', 'INUE1C18-290P(AB-QR)', '18gsmx290mmx6000m'),
    ('Unicharm', 'INUE1C18-250W(BF-QR)', '18gsmx250mmx6000m'),
    ('Unicharm', 'INUE1C18-210W(BF-QR)', '18gsmx210mmx6000m'),
    ('Unicharm', 'INUE1C18-290NP(AB-QR)', '18gsmx290mmx6000m');

-- Verify the insertion
SELECT COUNT(*) as total_records FROM inline_products_master;

-- Show all inserted data
SELECT customer, prod_code, spec, created_at 
FROM inline_products_master 
ORDER BY customer, prod_code;

-- Show summary by customer
SELECT 
    customer, 
    COUNT(*) as product_count,
    STRING_AGG(DISTINCT spec, ', ') as specifications
FROM inline_products_master 
GROUP BY customer 
ORDER BY customer; 