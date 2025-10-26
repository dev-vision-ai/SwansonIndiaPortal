-- Migration script to add new columns to existing GRN schema
-- Run this if you already have the GRN tables created

-- Add new columns to grn_items table if they don't exist
ALTER TABLE grn_items
ADD COLUMN IF NOT EXISTS quantity_accepted DECIMAL(12,3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_rejected DECIMAL(12,3) DEFAULT 0;

-- Update the view to include new columns
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

-- Add comments for documentation
COMMENT ON COLUMN grn_items.quantity_accepted IS 'Quantity of items accepted after inspection';
COMMENT ON COLUMN grn_items.quantity_rejected IS 'Quantity of items rejected during inspection';
