DROP FUNCTION IF EXISTS submit_consumption_batch(uuid, jsonb);
DROP FUNCTION IF EXISTS submit_consumption_batch(uuid, jsonb[]);

CREATE OR REPLACE FUNCTION submit_consumption_batch(
    p_header_id UUID,
    p_rows JSONB[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    row_data JSONB;
    v_record_id UUID;
    v_staging_uuid UUID;
    v_track_id TEXT;
    v_actual_track_id TEXT;
    v_issued_qty NUMERIC;
    v_current_consumed NUMERIC;
    v_new_consumed NUMERIC;
    v_new_balance NUMERIC;
    v_qty_used_delta NUMERIC;
    v_old_qty_used NUMERIC;
    v_old_staging_id UUID;
    v_material_id UUID;
BEGIN
    FOR row_data IN SELECT * FROM unnest(p_rows)
    LOOP
        v_track_id := row_data->>'track_id';
        v_material_id := CASE 
            WHEN row_data->>'material_id' IS NOT NULL AND (row_data->>'material_id') != '' 
            THEN (row_data->>'material_id')::uuid 
            ELSE NULL 
        END;
        v_qty_used_delta := COALESCE((row_data->>'qty_used')::numeric, 0);

        SELECT id, track_id, issued_qty, consumed_qty
        INTO v_old_staging_id, v_actual_track_id, v_issued_qty, v_current_consumed
        FROM pd_material_staging
        WHERE (id::text = v_track_id OR track_id = v_track_id)
          AND is_active = true
          AND COALESCE(is_loose, false) = COALESCE((row_data->>'is_loose')::boolean, false)
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_old_staging_id IS NULL THEN
            v_actual_track_id := COALESCE(v_track_id, gen_random_uuid()::text);
            v_issued_qty := COALESCE((row_data->>'qty_available')::numeric, 0);
            v_current_consumed := 0;
        END IF;

        IF row_data->>'id' IS NOT NULL AND (row_data->>'id') NOT LIKE 'temp-%' THEN
            v_record_id := (row_data->>'id')::uuid;
            
            SELECT qty_used INTO v_old_qty_used 
            FROM pd_material_consumption_data 
            WHERE id = v_record_id;
            
            v_qty_used_delta := COALESCE(v_old_qty_used, 0) - v_qty_used_delta;
            v_new_consumed := v_current_consumed - v_qty_used_delta;
        ELSE
            v_new_consumed := v_current_consumed + v_qty_used_delta;
            v_record_id := NULL;
        END IF;

        v_new_balance := v_issued_qty - v_new_consumed;

        IF v_record_id IS NOT NULL THEN
            UPDATE pd_material_consumption_data SET 
                material_id = v_material_id,
                material_name = row_data->>'material_name',
                material_type = row_data->>'material_type',
                is_loose = (row_data->>'is_loose')::boolean,
                track_id = v_actual_track_id,
                qty_available = COALESCE((row_data->>'qty_available')::numeric, 0),
                qty_used = (row_data->>'qty_used')::numeric,
                qty_balance = v_new_balance,
                bags_used = COALESCE((row_data->>'bags_used')::numeric, 0),
                row_index = COALESCE((row_data->>'row_index')::integer, 0),
                lot_no = row_data->>'lot_no',
                updated_at = now()
            WHERE id = v_record_id;
        ELSE
            INSERT INTO pd_material_consumption_data (
                header_id, material_id, track_id, traceability_code, material_name, material_type, is_loose,
                qty_available, qty_used, qty_balance, bags_used, row_index, lot_no, created_at, updated_at
            ) VALUES (
                p_header_id, v_material_id, v_actual_track_id, row_data->>'traceability_code', row_data->>'material_name', row_data->>'material_type',
                (row_data->>'is_loose')::boolean,
                COALESCE((row_data->>'qty_available')::numeric, 0), 
                COALESCE((row_data->>'qty_used')::numeric, 0), 
                v_new_balance, 
                COALESCE((row_data->>'bags_used')::numeric, 0),
                COALESCE((row_data->>'row_index')::integer, 0),
                row_data->>'lot_no', now(), now()
            )
            RETURNING id INTO v_record_id;
        END IF;

        IF v_old_staging_id IS NOT NULL THEN
            UPDATE pd_material_staging 
            SET 
                consumed_qty = v_new_consumed,
                balance_qty = v_new_balance,
                status = CASE 
                    WHEN v_new_balance <= 0 THEN 'Out of Stock' 
                    WHEN v_new_balance <= (v_issued_qty * 0.20) THEN 'Low Stock' 
                    ELSE 'Available' 
                END,
                is_active = true
            WHERE id = v_old_staging_id;
        ELSE
            INSERT INTO pd_material_staging (
                track_id, material_id, material_name, material_type, lot_no, 
                issued_qty, consumed_qty, balance_qty, status, is_active, issued_date, is_loose
            ) VALUES (
                v_actual_track_id, v_material_id, row_data->>'material_name', row_data->>'material_type', row_data->>'lot_no', 
                v_issued_qty, v_new_consumed, v_new_balance, 
                CASE 
                    WHEN v_new_balance <= 0 THEN 'Out of Stock' 
                    WHEN v_new_balance <= (v_issued_qty * 0.20) THEN 'Low Stock' 
                    ELSE 'Available' 
                END, 
                true, now()::date, (row_data->>'is_loose')::boolean
            )
            ON CONFLICT (track_id) DO UPDATE SET
                consumed_qty = EXCLUDED.consumed_qty,
                balance_qty = EXCLUDED.balance_qty,
                status = EXCLUDED.status,
                is_active = true;
        END IF;

    END LOOP;
END;
$$;