-- Add equipment_used column to 168_16cp_kranti table
-- This column will store the selected QC equipment for each testing page

ALTER TABLE "168_16cp_kranti" 
ADD COLUMN equipment_used JSONB DEFAULT '{}';

-- Add a comment to describe the column
COMMENT ON COLUMN "168_16cp_kranti".equipment_used IS 'JSONB object storing selected QC equipment IDs for each testing page';

-- Optional: Add an index for better query performance on equipment data
CREATE INDEX IF NOT EXISTS idx_168_16cp_kranti_equipment_used 
ON "168_16cp_kranti" USING GIN (equipment_used);

-- Verify the column was added successfully
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = '168_16cp_kranti' 
AND column_name = 'equipment_used';
