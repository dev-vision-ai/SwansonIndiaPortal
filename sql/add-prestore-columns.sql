-- Add Pre-store Inspection Done By and Remarks columns to 168_16cp_kranti table
-- Execute these commands in your PostgreSQL database

-- Add prestore_done_by column
ALTER TABLE public."168_16cp_kranti" 
ADD COLUMN prestore_done_by character varying(200) NULL;

-- Add remarks column
ALTER TABLE public."168_16cp_kranti" 
ADD COLUMN remarks text NULL;

-- Optional: Add comments to document the columns
COMMENT ON COLUMN public."168_16cp_kranti".prestore_done_by IS 'Name of the person who performed the pre-store inspection';
COMMENT ON COLUMN public."168_16cp_kranti".remarks IS 'Additional remarks or notes for the pre-store inspection';
