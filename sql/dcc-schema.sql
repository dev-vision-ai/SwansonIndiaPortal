-- Document Control Change (DCC/DCN) Master Table Schema
-- This file contains the database schema for the DCC system

-- DCC Master Table (Document Change Control)
CREATE TABLE IF NOT EXISTS public.dcc_master_table (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    dcn_no CHARACTER VARYING(50) NOT NULL UNIQUE,
    document_title TEXT NOT NULL,
    document_no CHARACTER VARYING(100),
    current_revision CHARACTER VARYING(20),
    revision_no CHARACTER VARYING(20),
    issued_date DATE,
    custodian CHARACTER VARYING(100),
    requestor_name CHARACTER VARYING(100),
    requestor_dept CHARACTER VARYING(50),
    effective_date DATE,
    status CHARACTER VARYING(20) NOT NULL DEFAULT 'Draft'::CHARACTER VARYING CHECK (
        status IN ('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Obsolete')
    ),
    has_affected_docs BOOLEAN DEFAULT FALSE,
    training_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    purpose JSONB,  -- Array of purpose values: ["New Establishment", "Revision", "Obsolescence"]
    document_types JSONB,  -- Array of document types from checkboxes: ["SOP", "WI", "etc"]
    affected_documents JSONB,  -- Array of affected doc objects: [{doc_no, doc_title}, ...]
    reason JSONB,  -- Object with types array and details string: {types: [...], details: "..."}
    training JSONB,  -- Object: {required: bool, trainees: [...], justification: "..."}
    acknowledgements JSONB,  -- Array of ack objects: [{name, date, signature}, ...]
    summary_of_changes JSONB,  -- Array of changes: [{clause, type, amended_text}, ...]
    review_participants JSONB,  -- Object with department keys and participant data: {dept: {name, user_id, assigned_at}, ...}
    CONSTRAINT dcc_master_table_pkey PRIMARY KEY (id),
    CONSTRAINT dcc_master_table_dcn_no_key UNIQUE (dcn_no),
    CONSTRAINT dcc_master_table_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT dcc_master_table_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL
) TABLESPACE pg_default;

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_dcc_master_status ON public.dcc_master_table USING btree (status) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_dcc_master_dept ON public.dcc_master_table USING btree (requestor_dept) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_dcc_master_date ON public.dcc_master_table USING btree (issued_date) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_dcc_master_created_by ON public.dcc_master_table USING btree (created_by) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_dcc_master_dcn_no ON public.dcc_master_table USING btree (dcn_no) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_dcc_master_doc_types ON public.dcc_master_table USING gin (document_types) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_dcc_master_purpose ON public.dcc_master_table USING gin (purpose) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_dcc_master_affected_docs ON public.dcc_master_table USING gin (affected_documents) TABLESPACE pg_default;

-- Enable Row Level Security
ALTER TABLE public.dcc_master_table ENABLE ROW LEVEL SECURITY;

-- Function to update the updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_dcc_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on modifications
CREATE TRIGGER update_dcc_master_table_updated_at
    BEFORE UPDATE ON public.dcc_master_table
    FOR EACH ROW EXECUTE FUNCTION update_dcc_updated_at_column();

-- RLS Policies

-- Allow employees to view their own submitted DCCs, view all DCCs if they are HR/Admin, 
-- or view DCCs where they are assigned as a reviewer in review_participants
CREATE POLICY "dcc_select_policy" ON public.dcc_master_table
    FOR SELECT USING (
        auth.uid() = created_by
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid()
            AND (public.users.department IN ('Human Resource', 'Administration') OR public.users.is_admin = TRUE)
        )
        OR (
            review_participants IS NOT NULL 
            AND review_participants != 'null'::jsonb
            AND review_participants::text != '{}'
            AND (
                -- Check if user_id exists in array format
                (review_participants::jsonb @> jsonb_build_array(jsonb_build_object('user_id', auth.uid())))
                OR
                -- Check if user_id exists in object format (department keys)
                EXISTS (
                    SELECT 1 FROM jsonb_each(review_participants) AS dept(key, value)
                    WHERE value->>'user_id' = auth.uid()::text
                )
            )
        )
    );

-- Allow employees to insert new DCCs
CREATE POLICY "dcc_insert_policy" ON public.dcc_master_table
    FOR INSERT WITH CHECK (
        auth.uid() = created_by
    );

-- Allow employees to update their own DCCs, allow HR/Admin to update any DCC,
-- or allow reviewers to update their own comments in the review_participants
CREATE POLICY "dcc_update_policy" ON public.dcc_master_table
    FOR UPDATE USING (
        auth.uid() = created_by
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid()
            AND (public.users.department IN ('Human Resource', 'Administration') OR public.users.is_admin = TRUE)
        )
        OR (
            review_participants IS NOT NULL 
            AND review_participants != 'null'::jsonb
            AND review_participants::text != '{}'
            AND (
                -- Check if user_id exists in array format
                (review_participants::jsonb @> jsonb_build_array(jsonb_build_object('user_id', auth.uid())))
                OR
                -- Check if user_id exists in object format (department keys)
                EXISTS (
                    SELECT 1 FROM jsonb_each(review_participants) AS dept(key, value)
                    WHERE value->>'user_id' = auth.uid()::text
                )
            )
        )
    )
    WITH CHECK (
        auth.uid() = created_by
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid()
            AND (public.users.department IN ('Human Resource', 'Administration') OR public.users.is_admin = TRUE)
        )
        OR (
            review_participants IS NOT NULL 
            AND review_participants != 'null'::jsonb
            AND review_participants::text != '{}'
            AND (
                -- Check if user_id exists in array format
                (review_participants::jsonb @> jsonb_build_array(jsonb_build_object('user_id', auth.uid())))
                OR
                -- Check if user_id exists in object format (department keys)
                EXISTS (
                    SELECT 1 FROM jsonb_each(review_participants) AS dept(key, value)
                    WHERE value->>'user_id' = auth.uid()::text
                )
            )
        )
    );

-- Allow employees to delete their own DCCs (only in Draft state)
CREATE POLICY "dcc_delete_policy" ON public.dcc_master_table
    FOR DELETE USING (
        (auth.uid() = created_by AND status = 'Draft')
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid()
            AND (public.users.department IN ('Human Resource', 'Administration') OR public.users.is_admin = TRUE)
        )
    );

-- Comments for documentation
COMMENT ON TABLE public.dcc_master_table IS 'Document Control Change (DCC/DCN) Master Table - Stores all document change control records';
COMMENT ON COLUMN public.dcc_master_table.dcn_no IS 'Unique Document Control Number';
COMMENT ON COLUMN public.dcc_master_table.document_types IS 'JSONB array of document types selected from checkboxes';
COMMENT ON COLUMN public.dcc_master_table.purpose IS 'JSONB array of purpose types: New Establishment, Revision, Obsolescence';
COMMENT ON COLUMN public.dcc_master_table.acknowledgements IS 'JSONB array of acknowledgement entries {name, date, signature}';
COMMENT ON COLUMN public.dcc_master_table.summary_of_changes IS 'JSONB array of changes {clause, type, amended_text}';
