-- Insert sample data into MT Machines & Equipments Master Data Table

-- Insert Rubber Roller
INSERT INTO mt_machines_and_equipments_masterdata (
    equipment_name,
    equipment_identification_no,
    installation_area,
    equipment_installation_date
) VALUES (
    'Rubber Roller',
    'RBR-IN-01-01A-1001',
    'Production',
    NULL  -- NA value becomes NULL
);

-- Insert Emboss Roller
INSERT INTO mt_machines_and_equipments_masterdata (
    equipment_name,
    equipment_identification_no,
    installation_area,
    equipment_installation_date
) VALUES (
    'Emboss Roller',
    'EMB-IN-01-01A-1002',
    'Production',
    NULL  -- NA value becomes NULL
);

-- Insert Auto Blender
INSERT INTO mt_machines_and_equipments_masterdata (
    equipment_name,
    equipment_identification_no,
    installation_area,
    equipment_installation_date
) VALUES (
    'Auto Blender',
    'ABD-IN-01-01A-1001',
    'Production',
    '2011-04-15'::DATE  -- Convert dd/mm/yyyy to yyyy-mm-dd format
);

-- Verify the inserted data
SELECT
    equipment_name,
    equipment_identification_no,
    installation_area,
    equipment_installation_date,
    created_at
FROM mt_machines_and_equipments_masterdata
ORDER BY equipment_name;
