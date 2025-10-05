-- =====================================================
-- FIRE EXTINGUISHERS RLS POLICIES
-- Swanson India Portal - Row Level Security Implementation
-- =====================================================

-- =====================================================
-- DROP EXISTING POLICIES FIRST
-- =====================================================

-- Drop existing policies for fire_extinguishers table
DROP POLICY IF EXISTS "Users can view fire extinguishers" ON public.fire_extinguishers;
DROP POLICY IF EXISTS "Public can view fire extinguishers" ON public.fire_extinguishers;
DROP POLICY IF EXISTS "Users can create fire extinguishers" ON public.fire_extinguishers;
DROP POLICY IF EXISTS "Users can update fire extinguishers" ON public.fire_extinguishers;
DROP POLICY IF EXISTS "Users can delete fire extinguishers" ON public.fire_extinguishers;
DROP POLICY IF EXISTS "Admins can view all fire extinguishers" ON public.fire_extinguishers;
DROP POLICY IF EXISTS "Admins can create fire extinguishers" ON public.fire_extinguishers;
DROP POLICY IF EXISTS "Admins can update fire extinguishers" ON public.fire_extinguishers;
DROP POLICY IF EXISTS "Admins can delete fire extinguishers" ON public.fire_extinguishers;

-- =====================================================
-- ENABLE RLS
-- =====================================================

-- Enable RLS on fire_extinguishers table
ALTER TABLE public.fire_extinguishers ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- FIRE_EXTINGUISHERS TABLE POLICIES
-- =====================================================

-- Policy 1: Public access for viewing fire extinguishers (for QR code access)
CREATE POLICY "Public can view fire extinguishers" ON public.fire_extinguishers
FOR SELECT USING (
    true
);

-- Policy 2: Only admins can create new fire extinguishers
CREATE POLICY "Admins can create fire extinguishers" ON public.fire_extinguishers
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- Policy 3: Only admins can update fire extinguishers
CREATE POLICY "Admins can update fire extinguishers" ON public.fire_extinguishers
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- Policy 4: Only admins can delete fire extinguishers
CREATE POLICY "Admins can delete fire extinguishers" ON public.fire_extinguishers
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
CREATE INDEX IF NOT EXISTS idx_fire_extinguishers_extinguisher_no ON public.fire_extinguishers(extinguisher_no);
CREATE INDEX IF NOT EXISTS idx_fire_extinguishers_type ON public.fire_extinguishers(type_of_extinguisher);
CREATE INDEX IF NOT EXISTS idx_fire_extinguishers_location ON public.fire_extinguishers(location);
CREATE INDEX IF NOT EXISTS idx_fire_extinguishers_status ON public.fire_extinguishers(status);
CREATE INDEX IF NOT EXISTS idx_fire_extinguishers_expiry_date ON public.fire_extinguishers(expiry_date);
CREATE INDEX IF NOT EXISTS idx_fire_extinguishers_created_at ON public.fire_extinguishers(created_at);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.fire_extinguishers IS 'Fire extinguishers with RLS enabled for admin-based access control and public viewing';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if RLS is enabled
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename = 'fire_extinguishers';

-- Check policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual FROM pg_policies WHERE tablename = 'fire_extinguishers';

-- =====================================================
-- END OF FIRE EXTINGUISHERS RLS POLICIES
-- =====================================================
