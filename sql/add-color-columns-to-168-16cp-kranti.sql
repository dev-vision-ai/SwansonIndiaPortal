-- Add Color columns to 168_16c_white table
-- These columns were added to the form but the database schema needs to be updated

ALTER TABLE "168_16c_white" 
ADD COLUMN IF NOT EXISTS page4_color_l JSONB,
ADD COLUMN IF NOT EXISTS page4_color_a JSONB,
ADD COLUMN IF NOT EXISTS page4_color_b JSONB,
ADD COLUMN IF NOT EXISTS page4_color_delta_e JSONB;

-- Add comments for documentation
COMMENT ON COLUMN "168_16c_white".page4_color_l IS 'Color L measurements (L-90.6 T-94.6 U-98.6)';
COMMENT ON COLUMN "168_16c_white".page4_color_a IS 'Color A measurements (L-(-5.1) T-(-1.1) U-2.9)';
COMMENT ON COLUMN "168_16c_white".page4_color_b IS 'Color B measurements (L-(-3.6) T-0.4 U-4.4)';
COMMENT ON COLUMN "168_16c_white".page4_color_delta_e IS 'Color Delta E measurements (T-0.00 U-5.00)';
