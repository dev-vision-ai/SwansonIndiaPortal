-- Add verification and approval columns to 214_18_micro_white table
-- This script adds the verification and approval tracking columns to the 214_18_micro_white film inspection form table

ALTER TABLE "214_18_micro_white" 
ADD COLUMN verified_by character varying NULL,
ADD COLUMN verified_date date NULL,
ADD COLUMN approved_by character varying NULL,
ADD COLUMN approved_date date NULL;

-- Add comments to document the purpose of these columns
COMMENT ON COLUMN "214_18_micro_white".verified_by IS 'Name of the person who verified the form';
COMMENT ON COLUMN "214_18_micro_white".verified_date IS 'Date when the form was verified';
COMMENT ON COLUMN "214_18_micro_white".approved_by IS 'Name of the person who approved the form';
COMMENT ON COLUMN "214_18_micro_white".approved_date IS 'Date when the form was approved';
