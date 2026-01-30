-- Production Floor Inspections Table Schema
-- This table stores daily management system inspections for the production floor

create table public.production_floor_inspections (
  id serial not null,
  user_id uuid not null,
  inspection_date date not null,
  inspection_time time without time zone not null,
  checked_by text,
  verified_by text,
  verification_date date,
  status text not null default 'Submitted'::text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint production_floor_inspections_pkey primary key (id),
  constraint production_floor_inspections_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint production_floor_inspections_status_check check (status in ('Submitted', 'Approved', 'Rejected', 'Pending', 'Verified'))
) TABLESPACE pg_default;

-- Indexes for better performance
create index IF not exists idx_production_floor_inspections_user_id on public.production_floor_inspections using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_production_floor_inspections_date on public.production_floor_inspections using btree (inspection_date) TABLESPACE pg_default;

create index IF not exists idx_production_floor_inspections_status on public.production_floor_inspections using btree (status) TABLESPACE pg_default;

create index IF not exists idx_production_floor_inspections_data on public.production_floor_inspections using gin (data) TABLESPACE pg_default;

-- Trigger to automatically update the updated_at timestamp
create trigger update_production_floor_inspections_updated_at BEFORE
update on production_floor_inspections for EACH row
execute FUNCTION update_updated_at_column ();

-- Row Level Security (RLS) - Enable RLS
ALTER TABLE public.production_floor_inspections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own records
CREATE POLICY "Users can view their own inspections" ON public.production_floor_inspections
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own records
CREATE POLICY "Users can insert their own inspections" ON public.production_floor_inspections
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own records
CREATE POLICY "Users can update their own inspections" ON public.production_floor_inspections
    FOR UPDATE USING (auth.uid() = user_id);

-- Quality Assurance/Quality Control users with level 1 can view all records
CREATE POLICY "QA/QC Level 1 can view all inspections" ON public.production_floor_inspections
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND department IN ('Quality Assurance', 'Quality Control')
            AND user_level = 1
        )
    );

-- Quality Assurance/Quality Control users with level 1 can update all records (for approval/rejection)
CREATE POLICY "QA/QC Level 1 can update all inspections" ON public.production_floor_inspections
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND department IN ('Quality Assurance', 'Quality Control')
            AND user_level = 1
        )
    );