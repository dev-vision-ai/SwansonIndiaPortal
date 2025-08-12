-- =====================================================
-- JOB POSTINGS RLS POLICIES
-- Swanson India Portal - Row Level Security Implementation
-- =====================================================

-- =====================================================
-- DROP EXISTING POLICIES FIRST
-- =====================================================

-- Drop existing policies for job_postings table
DROP POLICY IF EXISTS "Users can view job postings" ON public.job_postings;
DROP POLICY IF EXISTS "Users can create job postings" ON public.job_postings;
DROP POLICY IF EXISTS "Users can update job postings" ON public.job_postings;
DROP POLICY IF EXISTS "Users can delete job postings" ON public.job_postings;
DROP POLICY IF EXISTS "Admins can view all job postings" ON public.job_postings;
DROP POLICY IF EXISTS "Admins can create job postings" ON public.job_postings;
DROP POLICY IF EXISTS "Admins can update job postings" ON public.job_postings;
DROP POLICY IF EXISTS "Admins can delete job postings" ON public.job_postings;

-- =====================================================
-- ENABLE RLS
-- =====================================================

-- Enable RLS on job_postings table
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- JOB_POSTINGS TABLE POLICIES
-- =====================================================

-- Policy 1: All authenticated users can view active job postings (public job board access)
CREATE POLICY "Users can view job postings" ON public.job_postings
FOR SELECT USING (
    auth.uid() IS NOT NULL AND 
    (status = 'Active' OR status = 'Open')
);

-- Policy 2: Only admins can view all job postings (including draft, closed, etc.)
CREATE POLICY "Admins can view all job postings" ON public.job_postings
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- Policy 3: Only admins can create new job postings
CREATE POLICY "Admins can create job postings" ON public.job_postings
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- Policy 4: Only admins can update job postings
CREATE POLICY "Admins can update job postings" ON public.job_postings
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- Policy 5: Only admins can delete job postings
CREATE POLICY "Admins can delete job postings" ON public.job_postings
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_job_postings_status ON public.job_postings(status);
CREATE INDEX IF NOT EXISTS idx_job_postings_department ON public.job_postings(department);
CREATE INDEX IF NOT EXISTS idx_job_postings_employment_type ON public.job_postings(employment_type);
CREATE INDEX IF NOT EXISTS idx_job_postings_apply_before ON public.job_postings(apply_before);
CREATE INDEX IF NOT EXISTS idx_job_postings_created_at ON public.job_postings(created_at);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.job_postings IS 'Job postings with RLS enabled for admin-based access control and public viewing';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if RLS is enabled
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename = 'job_postings';

-- Check policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual FROM pg_policies WHERE tablename = 'job_postings';

-- =====================================================
-- END OF JOB POSTINGS RLS POLICIES
-- =====================================================
