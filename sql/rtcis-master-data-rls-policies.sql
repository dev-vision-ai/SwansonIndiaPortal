-- =====================================================
-- RTCIS MASTER DATA RLS POLICIES
-- Swanson India Portal - Row Level Security Implementation
-- =====================================================

-- =====================================================
-- DROP EXISTING POLICIES FIRST
-- =====================================================

-- Drop existing policies for rtcis_master_data table
DROP POLICY IF EXISTS "Users can view RTCIS master data" ON public.rtcis_master_data;
DROP POLICY IF EXISTS "Users can create RTCIS master data" ON public.rtcis_master_data;
DROP POLICY IF EXISTS "Users can update RTCIS master data" ON public.rtcis_master_data;
DROP POLICY IF EXISTS "Users can delete RTCIS master data" ON public.rtcis_master_data;
DROP POLICY IF EXISTS "Admins can view all RTCIS master data" ON public.rtcis_master_data;
DROP POLICY IF EXISTS "Admins can create RTCIS master data" ON public.rtcis_master_data;
DROP POLICY IF EXISTS "Admins can update RTCIS master data" ON public.rtcis_master_data;
DROP POLICY IF EXISTS "Admins can delete RTCIS master data" ON public.rtcis_master_data;

-- =====================================================
-- ENABLE RLS
-- =====================================================

-- Enable RLS on rtcis_master_data table
ALTER TABLE public.rtcis_master_data ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RTCIS_MASTER_DATA TABLE POLICIES
-- =====================================================

-- Policy 1: All authenticated users can view RTCIS master data (read-only access)
CREATE POLICY "Users can view RTCIS master data" ON public.rtcis_master_data
FOR SELECT USING (
    auth.uid() IS NOT NULL
);

-- Policy 2: Only admins can create new RTCIS master data
CREATE POLICY "Admins can create RTCIS master data" ON public.rtcis_master_data
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- Policy 3: Only admins can update RTCIS master data
CREATE POLICY "Admins can update RTCIS master data" ON public.rtcis_master_data
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- Policy 4: Only admins can delete RTCIS master data
CREATE POLICY "Admins can delete RTCIS master data" ON public.rtcis_master_data
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
CREATE INDEX IF NOT EXISTS idx_rtcis_master_data_irms_gcas ON public.rtcis_master_data(irms_gcas);
CREATE INDEX IF NOT EXISTS idx_rtcis_master_data_mrms_no ON public.rtcis_master_data(mrms_no);
CREATE INDEX IF NOT EXISTS idx_rtcis_master_data_product_code ON public.rtcis_master_data(product_code);
CREATE INDEX IF NOT EXISTS idx_rtcis_master_data_created_at ON public.rtcis_master_data(created_at);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.rtcis_master_data IS 'RTCIS master data with RLS enabled for admin-based access control';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if RLS is enabled
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename = 'rtcis_master_data';

-- Check policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual FROM pg_policies WHERE tablename = 'rtcis_master_data';

-- =====================================================
-- END OF RTCIS MASTER DATA RLS POLICIES
-- =====================================================
