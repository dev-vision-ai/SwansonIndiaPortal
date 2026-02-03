CREATE OR REPLACE FUNCTION get_material_reconciliation_report(
    p_start_date DATE,
    p_end_date DATE,
    p_category TEXT DEFAULT 'all'
)
RETURNS TABLE (
    material_name TEXT,
    total_available NUMERIC,
    issue_qty NUMERIC,
    used_mc1 NUMERIC,
    used_mc2 NUMERIC,
    used_mc3 NUMERIC,
    loose_mc1 NUMERIC,
    loose_mc2 NUMERIC,
    loose_mc3 NUMERIC,
    closing_balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH 
    -- Get material catalog with their categories to determine UOM
    material_info AS (
        SELECT 
            c.id,
            c.material_name,
            c.material_category,
            -- Determine if this is a packing material (uses bags) or raw material (uses kgs)
            CASE 
                WHEN c.material_category IN ('Pallets', 'Corrugated Sheets', 'Paper Core', 'Kraft paper', 'Medium', 'Bubble sheets', 'Stretch Wrap', 'Tapes', 'Stickers', 'Packing')
                THEN 'packing'
                ELSE 'raw'
            END as material_type
        FROM pd_material_catalog c
        WHERE c.is_active = true
    ),
    usage_stats AS (
        SELECT 
            d.material_id,
            -- For packing materials: sum bags_used, for raw: sum qty_used
            COALESCE(SUM(CASE WHEN mi.material_type = 'packing' THEN COALESCE(d.bags_used, 0) ELSE d.qty_used END) 
                FILTER (WHERE r.machine_no IN ('1', '01') AND COALESCE(d.is_loose, false) = false), 0) as m1,
            COALESCE(SUM(CASE WHEN mi.material_type = 'packing' THEN COALESCE(d.bags_used, 0) ELSE d.qty_used END) 
                FILTER (WHERE r.machine_no IN ('2', '02') AND COALESCE(d.is_loose, false) = false), 0) as m2,
            COALESCE(SUM(CASE WHEN mi.material_type = 'packing' THEN COALESCE(d.bags_used, 0) ELSE d.qty_used END) 
                FILTER (WHERE r.machine_no IN ('3', '03') AND COALESCE(d.is_loose, false) = false), 0) as m3,
            COALESCE(SUM(CASE WHEN mi.material_type = 'packing' THEN COALESCE(d.bags_used, 0) ELSE d.qty_used END) 
                FILTER (WHERE COALESCE(d.is_loose, false) = false), 0) as total_used,
            -- Loose materials tracking
            COALESCE(SUM(CASE WHEN mi.material_type = 'packing' THEN COALESCE(d.bags_used, 0) ELSE d.qty_used END) 
                FILTER (WHERE r.machine_no IN ('1', '01') AND COALESCE(d.is_loose, false) = true), 0) as loose_m1,
            COALESCE(SUM(CASE WHEN mi.material_type = 'packing' THEN COALESCE(d.bags_used, 0) ELSE d.qty_used END) 
                FILTER (WHERE r.machine_no IN ('2', '02') AND COALESCE(d.is_loose, false) = true), 0) as loose_m2,
            COALESCE(SUM(CASE WHEN mi.material_type = 'packing' THEN COALESCE(d.bags_used, 0) ELSE d.qty_used END) 
                FILTER (WHERE r.machine_no IN ('3', '03') AND COALESCE(d.is_loose, false) = true), 0) as loose_m3,
            COALESCE(SUM(CASE WHEN mi.material_type = 'packing' THEN COALESCE(d.bags_used, 0) ELSE d.qty_used END) 
                FILTER (WHERE COALESCE(d.is_loose, false) = true), 0) as total_loose_used
        FROM pd_material_consumption_data d
        JOIN pd_material_consumption_records r ON d.header_id = r.id
        JOIN material_info mi ON d.material_id = mi.id
        WHERE r.production_date BETWEEN p_start_date AND p_end_date
        GROUP BY d.material_id
    ),
    -- For issues: packing materials use bag counts if available, otherwise qty
    issue_stats AS (
        SELECT 
            s.material_id, 
            -- For staging issues, use the appropriate unit
            COALESCE(SUM(CASE 
                WHEN mi.material_type = 'packing' AND s.bags IS NOT NULL THEN s.bags
                ELSE s.issued_qty 
            END), 0) as qty
        FROM pd_material_staging s
        JOIN material_info mi ON s.material_id = mi.id
        WHERE s.issued_date BETWEEN p_start_date AND p_end_date
        GROUP BY s.material_id
    ),
    opening_stock AS (
        SELECT 
            mi.id as material_id,
            (
                -- Opening issued
                SELECT COALESCE(SUM(CASE 
                    WHEN mi2.material_type = 'packing' AND s.bags IS NOT NULL THEN s.bags
                    ELSE s.issued_qty 
                END), 0)
                FROM pd_material_staging s
                JOIN material_info mi2 ON s.material_id = mi2.id
                WHERE s.material_id = mi.id AND s.issued_date < p_start_date
            ) - (
                -- Opening consumed (packed + loose)
                SELECT COALESCE(SUM(CASE 
                    WHEN mi3.material_type = 'packing' THEN COALESCE(d2.bags_used, 0)
                    ELSE d2.qty_used 
                END), 0)
                FROM pd_material_consumption_data d2
                JOIN pd_material_consumption_records r2 ON d2.header_id = r2.id
                JOIN material_info mi3 ON d2.material_id = mi3.id
                WHERE d2.material_id = mi.id AND r2.production_date < p_start_date
            ) as qty
        FROM material_info mi
    )
    
    SELECT 
        mi.material_name::text,
        (COALESCE(o.qty, 0) + COALESCE(i.qty, 0))::numeric as total_available,
        COALESCE(i.qty, 0)::numeric as issue_qty,
        COALESCE(u.m1, 0)::numeric as used_mc1,
        COALESCE(u.m2, 0)::numeric as used_mc2,
        COALESCE(u.m3, 0)::numeric as used_mc3,
        COALESCE(u.loose_m1, 0)::numeric as loose_mc1,
        COALESCE(u.loose_m2, 0)::numeric as loose_mc2,
        COALESCE(u.loose_m3, 0)::numeric as loose_mc3,
        ((COALESCE(o.qty, 0) + COALESCE(i.qty, 0)) - COALESCE(u.total_used, 0) - COALESCE(u.total_loose_used, 0))::numeric as closing_balance
    FROM material_info mi
    LEFT JOIN usage_stats u ON mi.id = u.material_id
    LEFT JOIN issue_stats i ON mi.id = i.material_id
    LEFT JOIN opening_stock o ON mi.id = o.material_id
    WHERE 
        -- Category filter
        (
            p_category = 'all' OR
            (p_category = 'raw' AND mi.material_category IN ('Resin', 'Intermediate', 'Retarder', 'Extender', 'Additive')) OR
            (p_category = 'packing' AND mi.material_type = 'packing') OR
            (p_category = 'printing' AND mi.material_category IN ('Ink', 'Reducer', 'Overcoat', 'Slip'))
        )
        -- Only show materials with activity
        AND (COALESCE(o.qty, 0) != 0 OR COALESCE(i.qty, 0) != 0 OR COALESCE(u.total_used, 0) != 0 OR COALESCE(u.total_loose_used, 0) != 0)
    ORDER BY mi.material_name;
END;
$$;
