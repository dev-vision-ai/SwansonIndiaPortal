-- Migration: add columns to match frontend JS fields for pd_material_consumption_data
-- Run this on your Postgres / Supabase database
-- Migration: add only missing `accepted_*` columns to match frontend fields
-- Run this on your Postgres / Supabase database

ALTER TABLE public.pd_material_consumption_data
  ADD COLUMN IF NOT EXISTS accepted_rolls_nos numeric NULL,
  ADD COLUMN IF NOT EXISTS accepted_rolls_actual numeric NULL,
  ADD COLUMN IF NOT EXISTS accepted_rolls_std numeric NULL;

-- Notes:
-- Existing DB already contains produced/rejected/scrap columns (e.g. produced_rolls, produced_kgs_actual,
-- produced_kgs_std, rejected_rolls, rejected_kgs_actual, rejected_kgs_std, total_scrap). We add only the
-- missing `accepted_*` columns to avoid duplicate fields. After running this migration, update server/frontend
-- mappings as needed so the frontend fields map to the correct DB columns.
