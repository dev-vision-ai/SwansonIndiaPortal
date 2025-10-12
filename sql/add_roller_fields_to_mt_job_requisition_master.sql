-- Add Roller-Specific Fields to MT Job Requisition Master Table
-- These fields are only populated when equipment is Rubber Roller or Emboss Roller

ALTER TABLE mt_job_requisition_master
ADD COLUMN IF NOT EXISTS recoatingdate DATE,
ADD COLUMN IF NOT EXISTS regrindingdate DATE;

-- Add comments for documentation
COMMENT ON COLUMN mt_job_requisition_master.recoatingdate IS 'Date when roller was recoated (for Rubber/Emboss Roller maintenance)';
COMMENT ON COLUMN mt_job_requisition_master.regrindingdate IS 'Date when roller was regrinded (for Rubber/Emboss Roller maintenance)';

-- Optional: Add indexes for these fields if needed for querying
-- CREATE INDEX IF NOT EXISTS idx_mt_job_requisition_recoatingdate ON mt_job_requisition_master(recoatingdate);
-- CREATE INDEX IF NOT EXISTS idx_mt_job_requisition_regrindingdate ON mt_job_requisition_master(regrindingdate);
