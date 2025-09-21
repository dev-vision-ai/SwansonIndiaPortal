-- Add verification and approval columns to 176_18cp_ww table
-- This script adds the verification and approval tracking columns to the 176_18cp_ww film inspection form table

ALTER TABLE "176_18cp_ww" 
ADD COLUMN verified_by character varying NULL,
ADD COLUMN verified_date date NULL,
ADD COLUMN approved_by character varying NULL,
ADD COLUMN approved_date date NULL;

-- Add comments to document the purpose of these columns
COMMENT ON COLUMN "176_18cp_ww".verified_by IS 'Name of the person who verified the form';
COMMENT ON COLUMN "176_18cp_ww".verified_date IS 'Date when the form was verified';
COMMENT ON COLUMN "176_18cp_ww".approved_by IS 'Name of the person who approved the form';
COMMENT ON COLUMN "176_18cp_ww".approved_date IS 'Date when the form was approved';
