CREATE TABLE public."uc-18gsm-250p-abqr" (
  product_code character varying(200) NULL,
  production_order character varying(100) NULL,
  machine_no character varying(50) NULL,
  production_date date NULL,
  inspection_date date NULL,
  specification character varying(100) NULL,
  purchase_order character varying(100) NULL,
  quantity integer NULL,
  lot_no character varying(50) NULL,
  prestore_ref_no character varying(100) NULL,
  prepared_by character varying(100) NULL,

  -- Page 1 columns (Physical Properties) - 8 data columns
  page1_basis_weight jsonb NULL,      -- Film Weight (column 3)
  page1_thickness jsonb NULL,         -- Thickness (column 4)
  page1_wettability jsonb NULL,       -- Wettability (column 5)
  page1_cof_rr jsonb NULL,           -- COF (R-R) (column 6)
  page1_cof_cc jsonb NULL,           -- COF (C-C) (column 7)
  page1_tensile_break jsonb NULL,    -- Tensile Break (column 8)
  page1_elongation jsonb NULL,       -- MD Elongation Break (column 9)
  page1_modulus jsonb NULL,          -- 10% Modulus (column 10)

  -- Page 2 columns (Mechanical Properties) - 6 data columns
  page2_tensile_break jsonb NULL,     -- Tensile Break (column 3)
  page2_cd_elongation jsonb NULL,     -- CD Elongation Break (column 4)
  page2_modulus jsonb NULL,           -- 10% Modulus (column 5)
  page2_opacity jsonb NULL,           -- Opacity (column 6)
  page2_roll_width jsonb NULL,        -- Roll Cut Width (column 7)
  page2_diameter jsonb NULL,          -- Diameter (column 8)

  -- Page 3 columns (Color Measurements) - 5 data columns
  page3_colour_l jsonb NULL,         -- Colour L (column 3)
  page3_colour_a jsonb NULL,         -- Colour A (column 4)
  page3_colour_b jsonb NULL,         -- Colour B (column 5)
  page3_delta_e jsonb NULL,          -- Delta E (column 6)
  page3_base_film_pink jsonb NULL,   -- Base Film Pink (column 7)

  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  form_id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer character varying(200) NULL,
  lot_and_roll jsonb NULL DEFAULT '{}'::jsonb,
  roll_id jsonb NULL DEFAULT '{}'::jsonb,
  lot_time jsonb NULL DEFAULT '{}'::jsonb,
  location character varying(200) NULL,
  batch character varying(100) NULL,
  standard_packing character varying(100) NULL,
  pallet_size character varying(50) NULL,
  pallet_list character varying(20) NULL,
  product_label character varying(20) NULL,
  wrapping character varying(20) NULL,
  layer_pad character varying(20) NULL,
  contamination character varying(20) NULL,
  kraft_paper character varying(20) NULL,
  prestore_done_by character varying(200) NULL,
  remarks text NULL,
  no_damage character varying(10) NULL DEFAULT 'N/A'::character varying,
  pallet character varying(10) NULL DEFAULT 'N/A'::character varying,
  film_insp_form_ref_no character varying(255) NULL,
  equipment_used jsonb NULL DEFAULT '{}'::jsonb,
  verified_by character varying NULL,
  verified_date date NULL,
  approved_by character varying NULL,
  approved_date date NULL,

  CONSTRAINT "uc-18gsm-250p-abqr_pkey" PRIMARY KEY (form_id),
  CONSTRAINT "uc-18gsm-250p-abqr_lot_no_key" UNIQUE (lot_no)
) TABLESPACE pg_default;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "uc-18gsm-250p-abqr_film_insp_form_ref_no_idx" ON public."uc-18gsm-250p-abqr" USING btree (film_insp_form_ref_no) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS "uc-18gsm-250p-abqr_equipment_used_idx" ON public."uc-18gsm-250p-abqr" USING gin (equipment_used) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS "uc-18gsm-250p-abqr_form_id_idx" ON public."uc-18gsm-250p-abqr" USING btree (form_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS "uc-18gsm-250p-abqr_product_code_idx" ON public."uc-18gsm-250p-abqr" USING btree (product_code) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS "uc-18gsm-250p-abqr_machine_no_idx" ON public."uc-18gsm-250p-abqr" USING btree (machine_no) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS "uc-18gsm-250p-abqr_production_date_idx" ON public."uc-18gsm-250p-abqr" USING btree (production_date) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS "uc-18gsm-250p-abqr_created_at_idx" ON public."uc-18gsm-250p-abqr" USING btree (created_at) TABLESPACE pg_default;
