-- =====================================================
-- INLINE INSPECTION FORM MASTER 2 RLS POLICIES
-- Swanson India Portal - Row Level Security Implementation
-- =====================================================

-- =====================================================
-- DROP EXISTING POLICIES FIRST
-- =====================================================

-- Drop existing policies for inline_inspection_form_master_2 table
DROP POLICY IF EXISTS "Users can view inline inspection forms" ON public.inline_inspection_form_master_2;
DROP POLICY IF EXISTS "Users can create inline inspection forms" ON public.inline_inspection_form_master_2;
DROP POLICY IF EXISTS "Users can update inline inspection forms" ON public.inline_inspection_form_master_2;
DROP POLICY IF EXISTS "Users can delete inline inspection forms" ON public.inline_inspection_form_master_2;
DROP POLICY IF EXISTS "Admins can view all inline inspection forms" ON public.inline_inspection_form_master_2;
DROP POLICY IF EXISTS "Admins can create inline inspection forms" ON public.inline_inspection_form_master_2;
DROP POLICY IF EXISTS "Admins can update inline inspection forms" ON public.inline_inspection_form_master_2;
DROP POLICY IF EXISTS "Admins can delete inline inspection forms" ON public.inline_inspection_form_master_2;

-- =====================================================
-- ENABLE RLS
-- =====================================================

-- Enable RLS on inline_inspection_form_master_2 table
ALTER TABLE public.inline_inspection_form_master_2 ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- INLINE_INSPECTION_FORM_MASTER_2 TABLE POLICIES
-- =====================================================

-- Policy 1: Authenticated users can view inline inspection forms
CREATE POLICY "Authenticated users can view inline inspection forms" ON public.inline_inspection_form_master_2
FOR SELECT USING (
    auth.uid() IS NOT NULL
);

-- Policy 2: Only authorized departments can create new inline inspection forms
CREATE POLICY "Authorized departments can create inline inspection forms" ON public.inline_inspection_form_master_2
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Production', 'Quality Control', 'Quality Assurance')
    )
);

-- Policy 3: Only authorized departments can update inline inspection forms
CREATE POLICY "Authorized departments can update inline inspection forms" ON public.inline_inspection_form_master_2
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Production', 'Quality Control', 'Quality Assurance')
    )
);

-- Policy 4: Only authorized departments can delete inline inspection forms
CREATE POLICY "Authorized departments can delete inline inspection forms" ON public.inline_inspection_form_master_2
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Production', 'Quality Control', 'Quality Assurance')
    )
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Create indexes for better query performance (adjust based on your actual table structure)
-- Common fields that might need indexing for inline inspection forms:
-- CREATE INDEX IF NOT EXISTS idx_inline_inspection_form_master_2_form_id ON public.inline_inspection_form_master_2(form_id);
-- CREATE INDEX IF NOT EXISTS idx_inline_inspection_form_master_2_user_id ON public.inline_inspection_form_master_2(user_id);
-- CREATE INDEX IF NOT EXISTS idx_inline_inspection_form_master_2_created_at ON public.inline_inspection_form_master_2(created_at);
-- CREATE INDEX IF NOT EXISTS idx_inline_inspection_form_master_2_batch ON public.inline_inspection_form_master_2(batch);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.inline_inspection_form_master_2 IS 'Inline inspection form data with RLS enabled for authenticated user access with admin controls';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename = 'inline_inspection_form_master_2';

-- Check policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual FROM pg_policies WHERE tablename = 'inline_inspection_form_master_2';

-- =====================================================
-- END OF INLINE INSPECTION FORM RLS POLICIES
-- =====================================================
