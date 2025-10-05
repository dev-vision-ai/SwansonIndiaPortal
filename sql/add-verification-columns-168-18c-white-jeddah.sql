-- Add verification and approval columns to 168_18c_white_jeddah table
-- This script adds the verification and approval tracking columns to the 168_18c_white_jeddah film inspection form table

ALTER TABLE "168_18c_white_jeddah" 
ADD COLUMN verified_by character varying NULL,
ADD COLUMN verified_date date NULL,
ADD COLUMN approved_by character varying NULL,
ADD COLUMN approved_date date NULL;

-- Add comments to document the purpose of these columns
COMMENT ON COLUMN "168_18c_white_jeddah".verified_by IS 'Name of the person who verified the form';
COMMENT ON COLUMN "168_18c_white_jeddah".verified_date IS 'Date when the form was verified';
COMMENT ON COLUMN "168_18c_white_jeddah".approved_by IS 'Name of the person who approved the form';
COMMENT ON COLUMN "168_18c_white_jeddah".approved_date IS 'Date when the form was approved';
