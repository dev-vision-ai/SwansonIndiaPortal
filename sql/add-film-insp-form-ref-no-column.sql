-- Add film_insp_form_ref_no column to 168_16cp_kranti table
-- This column will store the film inspection form reference number

ALTER TABLE "168_16cp_kranti" 
ADD COLUMN film_insp_form_ref_no VARCHAR(255);

-- Add a comment to describe the column
COMMENT ON COLUMN "168_16cp_kranti".film_insp_form_ref_no IS 'Film inspection form reference number';

-- Optional: Add an index for better query performance
CREATE INDEX IF NOT EXISTS idx_168_16cp_kranti_film_insp_form_ref_no 
ON "168_16cp_kranti"(film_insp_form_ref_no);
