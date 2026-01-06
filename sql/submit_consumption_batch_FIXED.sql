CREATE OR REPLACE FUNCTION public.submit_consumption_batch(
    p_header_id uuid,
    p_rows jsonb[]
)
RETURNS void AS $$
DECLARE
    row_data jsonb;
    v_record_id uuid;
    v_staging_uuid uuid;
    v_issued_qty numeric;
    v_current_consumed numeric;
    v_new_consumed numeric;
    v_new_balance numeric;
    v_opening_balance numeric;
    v_new_status text;
    v_existing_record_id uuid;
    
    -- Variables for Lot Change Tracking
    v_old_track_id text;
    v_old_qty_used numeric;
    v_qty_used_delta numeric;
BEGIN
    FOREACH row_data IN ARRAY p_rows
    LOOP
        v_staging_uuid := (row_data->>'track_id')::uuid;  -- Cast TEXT to UUID
        v_record_id := (row_data->>'id')::uuid;  -- NULL for new rows, UUID for existing

        -- 1. LOCK THE CURRENT STAGING ROW
        SELECT issued_qty, consumed_qty 
        INTO v_issued_qty, v_current_consumed
        FROM pd_material_staging 
        WHERE id = v_staging_uuid
        FOR UPDATE;

        -- 2. CHECK IF THIS ROW ALREADY EXISTS IN CONSUMPTION DATA
        -- FIXED: Use record ID instead of row_index to avoid shifting bugs
        -- For new rows, v_record_id is NULL, so this query returns NULL
        SELECT id, track_id, qty_used 
        INTO v_existing_record_id, v_old_track_id, v_old_qty_used
        FROM pd_material_consumption_data
        WHERE id = v_record_id  -- NULL for new rows (no existing record)
        LIMIT 1;

        -- 3. CALCULATE BALANCES
        -- Opening balance is what the warehouse has BEFORE this specific row's usage
        v_opening_balance := v_issued_qty - v_current_consumed; 
        v_new_consumed := v_current_consumed + (row_data->>'qty_used')::numeric;
        v_new_balance := v_issued_qty - v_new_consumed;

        -- 4. LOGIC FOR UPDATING EXISTING RECORDS
        IF v_existing_record_id IS NOT NULL THEN
            
            -- SCENARIO A: User changed the LOT NUMBER for this row
            IF v_old_track_id <> v_staging_uuid::text THEN
                -- Refund the old lot - query by track_id (not id)
                UPDATE pd_material_staging
                SET balance_qty = balance_qty + v_old_qty_used,
                    consumed_qty = consumed_qty - v_old_qty_used,
                    status = 'Available' -- Reset status as stock is returned
                WHERE track_id = v_old_track_id;  -- Query by track_id, not id!

                -- Deduct full amount from the NEW lot
                v_qty_used_delta := (row_data->>'qty_used')::numeric;
            
            -- SCENARIO B: Same lot, just updated the quantity
            ELSE
                v_qty_used_delta := (row_data->>'qty_used')::numeric - v_old_qty_used;
            END IF;

            -- Update the consumption record
            UPDATE pd_material_consumption_data
            SET 
                material_id = (row_data->>'material_id')::uuid,
                material_name = row_data->>'material_name',
                material_type = row_data->>'material_type',
                track_id = v_staging_uuid::text,  -- Cast UUID to TEXT
                qty_available = v_opening_balance,
                qty_used = (row_data->>'qty_used')::numeric,
                qty_balance = v_new_balance,
                produced_rolls = (row_data->>'produced_rolls')::numeric,
                produced_kgs_std = (row_data->>'produced_kgs_std')::numeric,
                produced_kgs_actual = (row_data->>'produced_kgs_actual')::numeric,
                accepted_rolls_nos = (row_data->>'accepted_rolls_nos')::numeric,
                accepted_rolls_actual = (row_data->>'accepted_rolls_actual')::numeric,
                accepted_rolls_std = (row_data->>'accepted_rolls_std')::numeric,
                rejected_rolls = (row_data->>'rejected_rolls')::numeric,
                rejected_kgs_actual = (row_data->>'rejected_kgs_actual')::numeric,
                rejected_kgs_std = (row_data->>'rejected_kgs_std')::numeric,
                total_scrap = (row_data->>'total_scrap')::numeric,
                lot_no = row_data->>'lot_no',
                updated_at = now()
            WHERE id = v_existing_record_id;

            -- Apply the delta to the staging table
            UPDATE pd_material_staging
            SET 
                consumed_qty = consumed_qty + v_qty_used_delta,
                balance_qty = balance_qty - v_qty_used_delta,
                status = CASE 
                    WHEN (balance_qty - v_qty_used_delta) <= 0 THEN 'Out of Stock'
                    WHEN (balance_qty - v_qty_used_delta) <= (issued_qty * 0.20) THEN 'Low Stock'
                    ELSE 'Available'
                END
            WHERE id = v_staging_uuid;

        -- 5. LOGIC FOR INSERTING NEW RECORDS
        ELSE
            -- Deduct from staging
            UPDATE pd_material_staging
            SET 
                consumed_qty = v_new_consumed,
                balance_qty = v_new_balance,
                status = CASE 
                    WHEN v_new_balance <= 0 THEN 'Out of Stock'
                    WHEN v_new_balance <= (v_issued_qty * 0.20) THEN 'Low Stock'
                    ELSE 'Available'
                END
            WHERE id = v_staging_uuid;

            -- Insert the history record
            INSERT INTO pd_material_consumption_data (
                header_id, material_id, track_id, traceability_code, 
                material_name, material_type, 
                qty_available, qty_used, qty_balance,
                produced_rolls, produced_kgs_std, produced_kgs_actual,
                accepted_rolls_nos, accepted_rolls_actual, accepted_rolls_std,
                rejected_rolls, rejected_kgs_actual, rejected_kgs_std,
                total_scrap, lot_no, created_at, updated_at
            ) VALUES (
                p_header_id, (row_data->>'material_id')::uuid, v_staging_uuid::text,  -- Cast UUID to TEXT for track_id
                row_data->>'traceability_code', row_data->>'material_name', row_data->>'material_type',
                v_opening_balance, 
                (row_data->>'qty_used')::numeric, 
                v_new_balance,
                (row_data->>'produced_rolls')::numeric, (row_data->>'produced_kgs_std')::numeric, (row_data->>'produced_kgs_actual')::numeric,
                (row_data->>'accepted_rolls_nos')::numeric, (row_data->>'accepted_rolls_actual')::numeric, (row_data->>'accepted_rolls_std')::numeric,
                (row_data->>'rejected_rolls')::numeric, (row_data->>'rejected_kgs_actual')::numeric, (row_data->>'rejected_kgs_std')::numeric,
                (row_data->>'total_scrap')::numeric, row_data->>'lot_no',
                now(), now()
            );
        END IF;

    END LOOP;
END;
$$ LANGUAGE plpgsql;
