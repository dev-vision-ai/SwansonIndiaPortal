-- Transfer data from old table to new table
-- This script extracts data from inspection_data JSONB and populates individual columns

-- Step 1: Copy basic columns (non-JSONB)
INSERT INTO inline_inspection_form_master_2 (
    id,
    traceability_code,
    lot_letter,
    customer,
    production_no,
    prod_code,
    spec,
    production_date,
    emboss_type,
    printed,
    non_printed,
    ct,
    year,
    month,
    date,
    mc_no,
    shift,
    supervisor,
    supervisor2,
    line_leader,
    line_leader2,
    operator,
    operator2,
    qc_inspector,
    qc_inspector2,
    inspected_by,
    accepted_rolls,
    rejected_rolls,
    rework_rolls,
    kiv_rolls,
    rejected_weight,
    rework_weight,
    kiv_weight,
    accepted_weight,
    total_rolls,
    status,
    created_at,
    updated_at
)
SELECT 
    id,
    traceability_code,
    lot_letter,
    customer,
    production_no,
    prod_code,
    spec,
    production_date,
    emboss_type,
    printed,
    non_printed,
    ct,
    year,
    month,
    date,
    mc_no,
    shift,
    supervisor,
    supervisor2,
    line_leader,
    line_leader2,
    operator,
    operator2,
    qc_inspector,
    qc_inspector2,
    inspected_by,
    accepted_rolls,
    rejected_rolls,
    rework_rolls,
    kiv_rolls,
    rejected_weight,
    rework_weight,
    kiv_weight,
    accepted_weight,
    total_rolls,
    status,
    created_at,
    updated_at
FROM inline_inspection_form_master;

-- Step 2: Update JSONB columns with extracted data
UPDATE inline_inspection_form_master_2 
SET 
    -- Extract roll weights
    roll_weights = (
        SELECT jsonb_object_agg(
            COALESCE((roll->>'roll_position')::text, '0'), 
            COALESCE(roll->>'roll_weight', '')
        )
        FROM inline_inspection_form_master old,
        jsonb_array_elements(old.inspection_data->'rolls') AS roll
        WHERE old.id = inline_inspection_form_master_2.id
    ),
    
    -- Extract roll widths
    roll_widths = (
        SELECT jsonb_object_agg(
            COALESCE((roll->>'roll_position')::text, '0'), 
            COALESCE(roll->>'roll_width_mm', '')
        )
        FROM inline_inspection_form_master old,
        jsonb_array_elements(old.inspection_data->'rolls') AS roll
        WHERE old.id = inline_inspection_form_master_2.id
    ),
    
    -- Extract film weights GSM
    film_weights_gsm = (
        SELECT jsonb_object_agg(
            COALESCE((roll->>'roll_position')::text, '0'), 
            COALESCE(roll->>'film_weight_gsm', '')
        )
        FROM inline_inspection_form_master old,
        jsonb_array_elements(old.inspection_data->'rolls') AS roll
        WHERE old.id = inline_inspection_form_master_2.id
    ),
    
    -- Extract thickness data
    thickness_data = (
        SELECT jsonb_object_agg(
            COALESCE((roll->>'roll_position')::text, '0'), 
            COALESCE(roll->>'thickness', '')
        )
        FROM inline_inspection_form_master old,
        jsonb_array_elements(old.inspection_data->'rolls') AS roll
        WHERE old.id = inline_inspection_form_master_2.id
    ),
    
    -- Extract roll diameters
    roll_diameters = (
        SELECT jsonb_object_agg(
            COALESCE((roll->>'roll_position')::text, '0'), 
            COALESCE(roll->>'roll_dia', '')
        )
        FROM inline_inspection_form_master old,
        jsonb_array_elements(old.inspection_data->'rolls') AS roll
        WHERE old.id = inline_inspection_form_master_2.id
    ),
    
    -- Extract accept/reject status
    accept_reject_status = (
        SELECT jsonb_object_agg(
            COALESCE((roll->>'roll_position')::text, '0'), 
            COALESCE(roll->>'accept_reject', '')
        )
        FROM inline_inspection_form_master old,
        jsonb_array_elements(old.inspection_data->'rolls') AS roll
        WHERE old.id = inline_inspection_form_master_2.id
    ),
    
    -- Extract defect names
    defect_names = (
        SELECT jsonb_object_agg(
            COALESCE((roll->>'roll_position')::text, '0'), 
            COALESCE(roll->>'defect_name', '')
        )
        FROM inline_inspection_form_master old,
        jsonb_array_elements(old.inspection_data->'rolls') AS roll
        WHERE old.id = inline_inspection_form_master_2.id
    ),
    
    -- Extract film appearance
    film_appearance = (
        SELECT jsonb_object_agg(
            COALESCE((roll->>'roll_position')::text, '0'), 
            jsonb_build_object(
                'lines_strips', COALESCE(roll->>'lines_strips', ''),
                'glossy', COALESCE(roll->>'glossy', ''),
                'film_color', COALESCE(roll->>'film_color', ''),
                'pin_hole', COALESCE(roll->>'pin_hole', ''),
                'patch_mark', COALESCE(roll->>'patch_mark', ''),
                'odour', COALESCE(roll->>'odour', ''),
                'ct_appearance', COALESCE(roll->>'ct_appearance', '')
            )
        )
        FROM inline_inspection_form_master old,
        jsonb_array_elements(old.inspection_data->'rolls') AS roll
        WHERE old.id = inline_inspection_form_master_2.id
    ),
    
    -- Extract printing quality
    printing_quality = (
        SELECT jsonb_object_agg(
            COALESCE((roll->>'roll_position')::text, '0'), 
            jsonb_build_object(
                'print_color', COALESCE(roll->>'print_color', ''),
                'mis_print', COALESCE(roll->>'mis_print', ''),
                'dirty_print', COALESCE(roll->>'dirty_print', ''),
                'tape_test', COALESCE(roll->>'tape_test', ''),
                'centralization', COALESCE(roll->>'centralization', '')
            )
        )
        FROM inline_inspection_form_master old,
        jsonb_array_elements(old.inspection_data->'rolls') AS roll
        WHERE old.id = inline_inspection_form_master_2.id
    ),
    
    -- Extract roll appearance
    roll_appearance = (
        SELECT jsonb_object_agg(
            COALESCE((roll->>'roll_position')::text, '0'), 
            jsonb_build_object(
                'wrinkles', COALESCE(roll->>'wrinkles', ''),
                'prs', COALESCE(roll->>'prs', ''),
                'roll_curve', COALESCE(roll->>'roll_curve', ''),
                'core_misalignment', COALESCE(roll->>'core_misalignment', ''),
                'others', COALESCE(roll->>'others', '')
            )
        )
        FROM inline_inspection_form_master old,
        jsonb_array_elements(old.inspection_data->'rolls') AS roll
        WHERE old.id = inline_inspection_form_master_2.id
    ),
    
    -- Extract paper core data
    paper_core_data = (
        SELECT jsonb_object_agg(
            COALESCE((roll->>'roll_position')::text, '0'), 
            jsonb_build_object(
                'id', COALESCE(roll->>'paper_core_dia_id', ''),
                'od', COALESCE(roll->>'paper_core_dia_od', '')
            )
        )
        FROM inline_inspection_form_master old,
        jsonb_array_elements(old.inspection_data->'rolls') AS roll
        WHERE old.id = inline_inspection_form_master_2.id
    ),
    
    -- Extract time data
    time_data = (
        SELECT jsonb_object_agg(
            COALESCE((roll->>'roll_position')::text, '0'), 
            jsonb_build_object(
                'hour', COALESCE(roll->>'hour', ''),
                'minute', COALESCE(roll->>'minute', '')
            )
        )
        FROM inline_inspection_form_master old,
        jsonb_array_elements(old.inspection_data->'rolls') AS roll
        WHERE old.id = inline_inspection_form_master_2.id
    ),
    
    -- Extract remarks data
    remarks_data = (
        SELECT jsonb_object_agg(
            COALESCE((roll->>'roll_position')::text, '0'), 
            COALESCE(roll->>'remarks', '')
        )
        FROM inline_inspection_form_master old,
        jsonb_array_elements(old.inspection_data->'rolls') AS roll
        WHERE old.id = inline_inspection_form_master_2.id
    ),
    
    -- Copy summary data
    summary_data = (
        SELECT inspection_data->'summary'
        FROM inline_inspection_form_master old
        WHERE old.id = inline_inspection_form_master_2.id
    ),
    
    -- Extract header data
    header_data = jsonb_build_object(
        'inspected_by', (
            SELECT inspection_data->>'inspected_by'
            FROM inline_inspection_form_master old
            WHERE old.id = inline_inspection_form_master_2.id
        ),
        'lot_no', lot_letter,
        'arm', lot_letter
    ),
    
    -- Copy original inspection_data as backup
    inspection_data = (
        SELECT inspection_data
        FROM inline_inspection_form_master old
        WHERE old.id = inline_inspection_form_master_2.id
    );

-- Step 3: Calculate statistics data (simplified - skip for now)
UPDATE inline_inspection_form_master_2 
SET statistics_data = '{}';

-- Step 4: Verify transfer
SELECT 
    'Old table count' as info, COUNT(*) as count 
FROM inline_inspection_form_master
UNION ALL
SELECT 
    'New table count' as info, COUNT(*) as count 
FROM inline_inspection_form_master_2; 