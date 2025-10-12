-- Create MT Machines & Equipments Master Data Table
-- Simple master data table for equipment lookup and suggestions

CREATE TABLE IF NOT EXISTS mt_machines_and_equipments_masterdata (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Basic Equipment Information (for lookup/suggestions only)
    equipment_name VARCHAR(255) NOT NULL,
    equipment_identification_no VARCHAR(100) NOT NULL UNIQUE,
    installation_area VARCHAR(255),
    equipment_installation_date DATE,

    -- Basic audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create basic indexes for equipment lookup
CREATE INDEX IF NOT EXISTS idx_mt_machines_equipment_name ON mt_machines_and_equipments_masterdata(equipment_name);
CREATE INDEX IF NOT EXISTS idx_mt_machines_equipment_id_no ON mt_machines_and_equipments_masterdata(equipment_identification_no);
CREATE INDEX IF NOT EXISTS idx_mt_machines_installation_area ON mt_machines_and_equipments_masterdata(installation_area);

-- Simple comment for documentation
COMMENT ON TABLE mt_machines_and_equipments_masterdata IS 'Simple master data table for equipment lookup and auto-suggestions in forms';
