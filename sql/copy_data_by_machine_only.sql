-- Copy data by machine only (Precise copy)
-- This script copies only the data that actually belongs to each machine
-- Avoids cross-contamination between machines

-- First, let's clear the target tables to ensure clean copy
TRUNCATE TABLE inline_inspection_form_master_mc1;
TRUNCATE TABLE inline_inspection_form_master_mc2;
TRUNCATE TABLE inline_inspection_form_master_mc3;

-- Step 1: Copy Machine 1 data ONLY
-- Copy records where mc_no = '1' AND all related lots with same traceability_code
INSERT INTO inline_inspection_form_master_mc1 (
    id, form_id, created_at, updated_at,
    customer, production_no, production_no_2, prod_code, spec, emboss_type, 
    printed, non_printed, ct,
    production_date, year, month, date, mc_no, shift,
    supervisor, supervisor2, line_leader, line_leader2, operator, operator2, 
    qc_inspector, qc_inspector2,
    time_data, lot_no, lot_letter, arm, traceability_code,
    roll_weights, roll_widths, film_weights_gsm, thickness_data, roll_diameters,
    paper_core_data,
    film_appearance, printing_quality, roll_appearance,
    accept_reject_status, defect_names,
    total_rolls, accepted_rolls, rejected_rolls, rework_rolls, kiv_rolls,
    accepted_weight, rejected_weight, rework_weight, kiv_weight,
    remarks_data, status,
    inspected_by
)
SELECT DISTINCT
    id, form_id, created_at, updated_at,
    customer, production_no, production_no_2, prod_code, spec, emboss_type,
    printed, non_printed, ct,
    production_date, year, month, date, mc_no, shift,
    supervisor, supervisor2, line_leader, line_leader2, operator, operator2,
    qc_inspector, qc_inspector2,
    time_data, lot_no, lot_letter, arm, traceability_code,
    roll_weights, roll_widths, film_weights_gsm, thickness_data, roll_diameters,
    paper_core_data,
    film_appearance, printing_quality, roll_appearance,
    accept_reject_status, defect_names,
    total_rolls, accepted_rolls, rejected_rolls, rework_rolls, kiv_rolls,
    accepted_weight, rejected_weight, rework_weight, kiv_weight,
    remarks_data, status,
    inspected_by
FROM inline_inspection_form_master_2 
WHERE traceability_code IN (
    SELECT DISTINCT traceability_code 
    FROM inline_inspection_form_master_2 
    WHERE mc_no = '1' AND traceability_code IS NOT NULL
);

-- Step 2: Copy Machine 2 data ONLY
-- Copy records where mc_no = '2' AND all related lots with same traceability_code
INSERT INTO inline_inspection_form_master_mc2 (
    id, form_id, created_at, updated_at,
    customer, production_no, production_no_2, prod_code, spec, emboss_type, 
    printed, non_printed, ct,
    production_date, year, month, date, mc_no, shift,
    supervisor, supervisor2, line_leader, line_leader2, operator, operator2, 
    qc_inspector, qc_inspector2,
    time_data, lot_no, lot_letter, arm, traceability_code,
    roll_weights, roll_widths, film_weights_gsm, thickness_data, roll_diameters,
    paper_core_data,
    film_appearance, printing_quality, roll_appearance,
    accept_reject_status, defect_names,
    total_rolls, accepted_rolls, rejected_rolls, rework_rolls, kiv_rolls,
    accepted_weight, rejected_weight, rework_weight, kiv_weight,
    remarks_data, status,
    inspected_by
)
SELECT DISTINCT
    id, form_id, created_at, updated_at,
    customer, production_no, production_no_2, prod_code, spec, emboss_type,
    printed, non_printed, ct,
    production_date, year, month, date, mc_no, shift,
    supervisor, supervisor2, line_leader, line_leader2, operator, operator2,
    qc_inspector, qc_inspector2,
    time_data, lot_no, lot_letter, arm, traceability_code,
    roll_weights, roll_widths, film_weights_gsm, thickness_data, roll_diameters,
    paper_core_data,
    film_appearance, printing_quality, roll_appearance,
    accept_reject_status, defect_names,
    total_rolls, accepted_rolls, rejected_rolls, rework_rolls, kiv_rolls,
    accepted_weight, rejected_weight, rework_weight, kiv_weight,
    remarks_data, status,
    inspected_by
FROM inline_inspection_form_master_2 
WHERE traceability_code IN (
    SELECT DISTINCT traceability_code 
    FROM inline_inspection_form_master_2 
    WHERE mc_no = '2' AND traceability_code IS NOT NULL
);

-- Step 3: Copy Machine 3 data ONLY
-- Copy records where mc_no = '3' AND all related lots with same traceability_code
INSERT INTO inline_inspection_form_master_mc3 (
    id, form_id, created_at, updated_at,
    customer, production_no, production_no_2, prod_code, spec, emboss_type, 
    printed, non_printed, ct,
    production_date, year, month, date, mc_no, shift,
    supervisor, supervisor2, line_leader, line_leader2, operator, operator2, 
    qc_inspector, qc_inspector2,
    time_data, lot_no, lot_letter, arm, traceability_code,
    roll_weights, roll_widths, film_weights_gsm, thickness_data, roll_diameters,
    paper_core_data,
    film_appearance, printing_quality, roll_appearance,
    accept_reject_status, defect_names,
    total_rolls, accepted_rolls, rejected_rolls, rework_rolls, kiv_rolls,
    accepted_weight, rejected_weight, rework_weight, kiv_weight,
    remarks_data, status,
    inspected_by
)
SELECT DISTINCT
    id, form_id, created_at, updated_at,
    customer, production_no, production_no_2, prod_code, spec, emboss_type,
    printed, non_printed, ct,
    production_date, year, month, date, mc_no, shift,
    supervisor, supervisor2, line_leader, line_leader2, operator, operator2,
    qc_inspector, qc_inspector2,
    time_data, lot_no, lot_letter, arm, traceability_code,
    roll_weights, roll_widths, film_weights_gsm, thickness_data, roll_diameters,
    paper_core_data,
    film_appearance, printing_quality, roll_appearance,
    accept_reject_status, defect_names,
    total_rolls, accepted_rolls, rejected_rolls, rework_rolls, kiv_rolls,
    accepted_weight, rejected_weight, rework_weight, kiv_weight,
    remarks_data, status,
    inspected_by
FROM inline_inspection_form_master_2 
WHERE traceability_code IN (
    SELECT DISTINCT traceability_code 
    FROM inline_inspection_form_master_2 
    WHERE mc_no = '3' AND traceability_code IS NOT NULL
);

-- Step 4: Verify data copy
SELECT 'MC1 Records' as table_name, COUNT(*) as record_count FROM inline_inspection_form_master_mc1
UNION ALL
SELECT 'MC2 Records' as table_name, COUNT(*) as record_count FROM inline_inspection_form_master_mc2
UNION ALL
SELECT 'MC3 Records' as table_name, COUNT(*) as record_count FROM inline_inspection_form_master_mc3
UNION ALL
SELECT 'Original Total' as table_name, COUNT(*) as record_count FROM inline_inspection_form_master_2
UNION ALL
SELECT 'Sum of MC Tables' as table_name, 
    (SELECT COUNT(*) FROM inline_inspection_form_master_mc1) + 
    (SELECT COUNT(*) FROM inline_inspection_form_master_mc2) + 
    (SELECT COUNT(*) FROM inline_inspection_form_master_mc3) as record_count;
