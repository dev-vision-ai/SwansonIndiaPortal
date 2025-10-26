-- Goods Received Notes (GRN) Schema
-- This file contains the database schema for the GRN system

-- Users table (matches the existing user management system)
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_code VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(200) NOT NULL,
    department VARCHAR(100) NOT NULL,
    designation VARCHAR(100),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_id ON users(id);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
CREATE INDEX IF NOT EXISTS idx_users_employee_code ON users(employee_code);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can view all user records (for department checking), but only edit their own
CREATE POLICY "Users can view all user records" ON users
    FOR SELECT USING (true);

CREATE POLICY "Users can update own record" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can insert users" ON users
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.is_admin = true
        )
    );

CREATE POLICY "Admins can update any user" ON users
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.is_admin = true
        )
    );

CREATE POLICY "Admins can delete users" ON users
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.is_admin = true
        )
    );

-- Trigger for updated_at on users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Main GRN table
CREATE TABLE IF NOT EXISTS goods_received_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    grn_number VARCHAR(50) UNIQUE NOT NULL,
    grn_date DATE NOT NULL,
    receipt_date TIMESTAMP NOT NULL,
    received_by VARCHAR(100) NOT NULL,
    po_number VARCHAR(50) NOT NULL,
    po_date DATE NOT NULL,
    supplier_name VARCHAR(200) NOT NULL,
    supplier_code VARCHAR(50),
    supplier_invoice VARCHAR(100) NOT NULL,
    invoice_date DATE NOT NULL,
    delivery_challan VARCHAR(100) NOT NULL,
    vehicle_number VARCHAR(50),
    quality_status VARCHAR(50) NOT NULL CHECK (quality_status IN ('Good', 'Damaged', 'Partial')),
    currency VARCHAR(10) DEFAULT 'INR',
    total_amount DECIMAL(12,2) DEFAULT 0,
    document_urls JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE
);

-- GRN Items table (for line items)
CREATE TABLE IF NOT EXISTS grn_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    grn_id UUID REFERENCES goods_received_notes(id) ON DELETE CASCADE,
    item_code VARCHAR(100) NOT NULL,
    item_description TEXT NOT NULL,
    quantity_ordered DECIMAL(12,3) DEFAULT 0,
    quantity_received DECIMAL(12,3) NOT NULL,
    quantity_accepted DECIMAL(12,3) DEFAULT 0,
    quantity_rejected DECIMAL(12,3) DEFAULT 0,
    uom VARCHAR(20) NOT NULL,
    unit_price DECIMAL(12,2) DEFAULT 0,
    batch_number VARCHAR(100),
    expiry_date DATE,
    mfg_date DATE,
    storage_location VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GRN Drafts table (for saving drafts)
CREATE TABLE IF NOT EXISTS grn_drafts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    grn_number VARCHAR(50),
    grn_date DATE,
    receipt_date TIMESTAMP,
    received_by VARCHAR(100),
    po_number VARCHAR(50),
    po_date DATE,
    supplier_name VARCHAR(200),
    supplier_code VARCHAR(50),
    supplier_invoice VARCHAR(100),
    invoice_date DATE,
    delivery_challan VARCHAR(100),
    vehicle_number VARCHAR(50),
    quality_status VARCHAR(50) CHECK (quality_status IN ('Good', 'Damaged', 'Partial')),
    currency VARCHAR(10) DEFAULT 'INR',
    total_amount DECIMAL(12,2) DEFAULT 0,
    items JSONB DEFAULT '[]'::jsonb,
    document_urls JSONB DEFAULT '[]'::jsonb,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    drafted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_grn_grn_number ON goods_received_notes(grn_number);
CREATE INDEX IF NOT EXISTS idx_grn_po_number ON goods_received_notes(po_number);
CREATE INDEX IF NOT EXISTS idx_grn_supplier_name ON goods_received_notes(supplier_name);
CREATE INDEX IF NOT EXISTS idx_grn_user_id ON goods_received_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_grn_status ON goods_received_notes(status);
CREATE INDEX IF NOT EXISTS idx_grn_created_at ON goods_received_notes(created_at);
CREATE INDEX IF NOT EXISTS idx_grn_items_grn_id ON grn_items(grn_id);
CREATE INDEX IF NOT EXISTS idx_grn_drafts_user_id ON grn_drafts(user_id);

-- Storage bucket for GRN documents (to be created in Supabase dashboard)
-- Bucket name: grn-documents
-- Public access: true (for document viewing)

-- RLS (Row Level Security) Policies
ALTER TABLE goods_received_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE grn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE grn_drafts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own GRNs (Warehouse only)
CREATE POLICY "Warehouse users can view own GRNs" ON goods_received_notes
    FOR SELECT USING (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.department = 'Warehouse'
        )
    );

CREATE POLICY "Warehouse users can insert own GRNs" ON goods_received_notes
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.department = 'Warehouse'
        )
    );

CREATE POLICY "Warehouse users can update own GRNs" ON goods_received_notes
    FOR UPDATE USING (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.department = 'Warehouse'
        )
    );

CREATE POLICY "Warehouse users can delete own GRNs" ON goods_received_notes
    FOR DELETE USING (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.department = 'Warehouse'
        )
    );

-- Users can only see their own GRN items (Warehouse only)
CREATE POLICY "Warehouse users can view own GRN items" ON grn_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM goods_received_notes
            WHERE goods_received_notes.id = grn_items.grn_id
            AND goods_received_notes.user_id = auth.uid()
            AND EXISTS (
                SELECT 1 FROM users
                WHERE users.id = auth.uid()
                AND users.department = 'Warehouse'
            )
        )
    );

CREATE POLICY "Warehouse users can insert own GRN items" ON grn_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM goods_received_notes
            WHERE goods_received_notes.id = grn_items.grn_id
            AND goods_received_notes.user_id = auth.uid()
            AND EXISTS (
                SELECT 1 FROM users
                WHERE users.id = auth.uid()
                AND users.department = 'Warehouse'
            )
        )
    );

-- Users can only see their own drafts (Warehouse only)
CREATE POLICY "Warehouse users can view own GRN drafts" ON grn_drafts
    FOR SELECT USING (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.department = 'Warehouse'
        )
    );

CREATE POLICY "Warehouse users can insert own GRN drafts" ON grn_drafts
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.department = 'Warehouse'
        )
    );

CREATE POLICY "Warehouse users can update own GRN drafts" ON grn_drafts
    FOR UPDATE USING (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.department = 'Warehouse'
        )
    );

CREATE POLICY "Warehouse users can delete own GRN drafts" ON grn_drafts
    FOR DELETE USING (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.department = 'Warehouse'
        )
    );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_goods_received_notes_updated_at
    BEFORE UPDATE ON goods_received_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grn_drafts_updated_at
    BEFORE UPDATE ON grn_drafts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate next GRN number
CREATE OR REPLACE FUNCTION get_next_grn_number()
RETURNS VARCHAR AS $$
DECLARE
    current_year VARCHAR(4);
    current_month VARCHAR(2);
    prefix VARCHAR(9);
    next_number INTEGER;
    next_grn_number VARCHAR(50);
BEGIN
    -- Get current year and month
    current_year := EXTRACT(YEAR FROM NOW())::VARCHAR;
    current_month := LPAD(EXTRACT(MONTH FROM NOW())::VARCHAR, 2, '0');
    prefix := 'GRN-' || current_year || current_month;

    -- Find the highest existing number for this month
    SELECT COALESCE(
        MAX(CAST(SPLIT_PART(grn_number, '-', 3) AS INTEGER)),
        0
    ) + 1
    INTO next_number
    FROM goods_received_notes
    WHERE grn_number LIKE prefix || '-%';

    -- Format the number with leading zeros
    next_grn_number := prefix || '-' || LPAD(next_number::VARCHAR, 3, '0');

    RETURN next_grn_number;
END;
$$ LANGUAGE plpgsql;

-- View for GRN with items (combined view)
CREATE OR REPLACE VIEW grn_with_items AS
SELECT
    grn.*,
    json_agg(
        json_build_object(
            'item_code', gi.item_code,
            'item_description', gi.item_description,
            'quantity_ordered', gi.quantity_ordered,
            'quantity_received', gi.quantity_received,
            'quantity_accepted', gi.quantity_accepted,
            'quantity_rejected', gi.quantity_rejected,
            'uom', gi.uom,
            'unit_price', gi.unit_price,
            'batch_number', gi.batch_number,
            'expiry_date', gi.expiry_date,
            'mfg_date', gi.mfg_date,
            'storage_location', gi.storage_location
        )
    ) as items
FROM goods_received_notes grn
LEFT JOIN grn_items gi ON grn.id = gi.grn_id
GROUP BY grn.id;

-- Sample data (optional - for testing)
-- INSERT INTO goods_received_notes (grn_number, grn_date, receipt_date, received_by, po_number, po_date, supplier_name, supplier_invoice, invoice_date, delivery_challan, user_id, status)
-- VALUES ('GRN-202412-001', '2024-12-01', '2024-12-01 10:30:00', 'John Doe', 'PO-202412-001', '2024-11-28', 'ABC Suppliers', 'INV-001', '2024-12-01', 'DC-001', 'user-uuid-here', 'submitted');

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON goods_received_notes TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON grn_items TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON grn_drafts TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_next_grn_number() TO authenticated;
