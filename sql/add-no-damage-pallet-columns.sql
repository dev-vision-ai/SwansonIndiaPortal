-- Add new columns for "No Damage" and "Pallet" to the 168_16cp_kranti table
-- These columns will store the Accept/Reject/N/A values for the new inspection criteria

-- Add no_damage column
ALTER TABLE "168_16cp_kranti" 
ADD COLUMN IF NOT EXISTS no_damage VARCHAR(10) DEFAULT NULL;

-- Add pallet column  
ALTER TABLE "168_16cp_kranti" 
ADD COLUMN IF NOT EXISTS pallet VARCHAR(10) DEFAULT NULL;

-- Add comments to document the purpose of these columns
COMMENT ON COLUMN "168_16cp_kranti".no_damage IS 'Inspection result for No Damage criteria: Accept, Reject, or N/A';
COMMENT ON COLUMN "168_16cp_kranti".pallet IS 'Inspection result for Pallet criteria: Accept, Reject, or N/A';

-- No need to update existing records since we want NULL as default

-- Verify the columns were added successfully
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = '168_16cp_kranti' 
AND column_name IN ('no_damage', 'pallet')
ORDER BY column_name;
