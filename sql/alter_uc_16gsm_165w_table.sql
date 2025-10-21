-- Alter table to remove columns that were removed from HTML form
-- Page 1: Remove Wettability and COF (C-C) columns
ALTER TABLE public."uc-16gsm-165w" DROP COLUMN IF EXISTS page1_wettability;
ALTER TABLE public."uc-16gsm-165w" DROP COLUMN IF EXISTS page1_cof_cc;

-- Page 3: Remove Base Film White column (since we reduced to 4 columns)
ALTER TABLE public."uc-16gsm-165w" DROP COLUMN IF EXISTS page3_base_film_pink;

-- Note: All other columns remain as they match the current HTML structure
-- Page 1: basis_weight, thickness, cof_rr, tensile_break, elongation, modulus
-- Page 2: tensile_break, cd_elongation, modulus, opacity, roll_width, diameter
-- Page 3: colour_l, colour_a, colour_b, delta_e
