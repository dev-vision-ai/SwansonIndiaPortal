-- QC Equipments Table
-- This table stores quality control equipment information with their unique identification numbers

CREATE TABLE IF NOT EXISTS qc_equipments (
    id SERIAL PRIMARY KEY,
    equipment_type VARCHAR(50) NOT NULL,
    equipment_id VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment to table
COMMENT ON TABLE qc_equipments IS 'Quality Control Equipment inventory with unique identification numbers';

-- Add comments to columns
COMMENT ON COLUMN qc_equipments.id IS 'Primary key - auto-incrementing ID';
COMMENT ON COLUMN qc_equipments.equipment_type IS 'Type of QC equipment (Glossmeter, X-RITE, Weigh Scale, etc.)';
COMMENT ON COLUMN qc_equipments.equipment_id IS 'Unique equipment identification number';
COMMENT ON COLUMN qc_equipments.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN qc_equipments.updated_at IS 'Record last update timestamp';

-- Create index on equipment_type for faster queries
CREATE INDEX IF NOT EXISTS idx_qc_equipments_equipment_type ON qc_equipments(equipment_type);

-- Create index on equipment_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_qc_equipments_equipment_id ON qc_equipments(equipment_id);

-- Insert QC Equipment data from the image
INSERT INTO qc_equipments (equipment_type, equipment_id) VALUES
-- Glossmeter
('Glossmeter', 'GLS-IN-01-06A-0001'),

-- X-RITE
('X-RITE', 'XRE-IN-01-06A-0001'),
('X-RITE', 'XRE-IN-01-06A-0002'),

-- Weigh Scale
('Weigh Scale', 'WHS-IN-01-06A-0001'),

-- Spectrophotometer
('Spectrophotometer', 'STM-IN-01-06A-0001'),

-- Instron
('Instron', 'UTM-IN-01-06A-0001'),

-- Dial Gauge
('Dial Gauge', 'DTG-IN-01-06A-0020'),
('Dial Gauge', 'DTG-IN-01-06A-0021'),
('Dial Gauge', 'DTG-IN-01-06A-0022'),
('Dial Gauge', 'DTG-IN-01-06A-0023'),
('Dial Gauge', 'DTG-IN-01-06A-0024'),

-- Steel Ruler
('Steel Ruler', 'STL-IN-01-06A-0004'),
('Steel Ruler', 'STL-IN-01-06A-0005'),
('Steel Ruler', 'STL-IN-01-06A-0006'),
('Steel Ruler', 'STL-IN-01-06A-0007'),
('Steel Ruler', 'STL-IN-01-06A-0008'),
('Steel Ruler', 'STL-IN-01-06A-0009');

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_qc_equipments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at on row updates
CREATE TRIGGER trigger_update_qc_equipments_updated_at
    BEFORE UPDATE ON qc_equipments
    FOR EACH ROW
    EXECUTE FUNCTION update_qc_equipments_updated_at();
