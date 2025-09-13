-- =====================================================
-- QUALITY ALERTS RLS POLICIES
-- Swanson India Portal - Row Level Security Implementation
-- =====================================================

-- =====================================================
-- DROP EXISTING POLICIES FIRST
-- =====================================================

-- Drop existing policies for quality_alerts table
DROP POLICY IF EXISTS "Users can view their own quality alerts" ON public.quality_alerts;
DROP POLICY IF EXISTS "Users can create their own quality alerts" ON public.quality_alerts;
DROP POLICY IF EXISTS "Users can update their own quality alerts" ON public.quality_alerts;
DROP POLICY IF EXISTS "Admins can view all quality alerts" ON public.quality_alerts;
DROP POLICY IF EXISTS "Users can view their department alerts" ON public.quality_alerts;
DROP POLICY IF EXISTS "Admins can update any quality alert" ON public.quality_alerts;
DROP POLICY IF EXISTS "Admins can delete any quality alert" ON public.quality_alerts;
DROP POLICY IF EXISTS "Users cannot delete quality alerts" ON public.quality_alerts;

-- Drop existing policies for quality_alert_drafts table
DROP POLICY IF EXISTS "Users can view their own draft alerts" ON public.quality_alert_drafts;
DROP POLICY IF EXISTS "Users can create their own draft alerts" ON public.quality_alert_drafts;
DROP POLICY IF EXISTS "Users can update their own draft alerts" ON public.quality_alert_drafts;
DROP POLICY IF EXISTS "Users can delete their own draft alerts" ON public.quality_alert_drafts;
DROP POLICY IF EXISTS "Admins can view all draft alerts" ON public.quality_alert_drafts;
DROP POLICY IF EXISTS "Admins can delete any draft alert" ON public.quality_alert_drafts;

-- =====================================================
-- ENABLE RLS
-- =====================================================

-- Enable RLS on quality_alerts table
ALTER TABLE public.quality_alerts ENABLE ROW LEVEL SECURITY;

-- Enable RLS on quality_alert_drafts table
ALTER TABLE public.quality_alert_drafts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- QUALITY_ALERTS TABLE POLICIES
-- =====================================================

-- Policy 1: Users can view their own alerts
CREATE POLICY "Users can view their own quality alerts" ON public.quality_alerts
FOR SELECT USING (
    auth.uid() = user_id
);

-- Policy 2: Users can create their own alerts
CREATE POLICY "Users can create their own quality alerts" ON public.quality_alerts
FOR INSERT WITH CHECK (
    auth.uid() = user_id
);

-- Policy 3: Users can update their own alerts only if in draft
CREATE POLICY "Users can update their own quality alerts" ON public.quality_alerts
FOR UPDATE USING (
    auth.uid() = user_id AND 
    (statusaction IS NULL OR statusaction = 'Draft')
);

-- Policy 4: Admins can view all quality alerts
CREATE POLICY "Admins can view all quality alerts" ON public.quality_alerts
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- Policy 5: Users can view alerts for their department (if they have department info)
CREATE POLICY "Users can view their department alerts" ON public.quality_alerts
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.department = responsibledept
    )
);

-- Policy 6: Admins can update any alert (for processing)
CREATE POLICY "Admins can update any quality alert" ON public.quality_alerts
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- Policy 8: Admins can delete any alert
CREATE POLICY "Admins can delete any quality alert" ON public.quality_alerts
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- Policy 7: Users cannot delete quality alerts (only admins can)
CREATE POLICY "Users cannot delete quality alerts" ON public.quality_alerts
FOR DELETE USING (false);



-- =====================================================
-- QUALITY_ALERT_DRAFTS TABLE POLICIES
-- =====================================================

-- Policy 1: Users can view their own draft alerts
CREATE POLICY "Users can view their own draft alerts" ON public.quality_alert_drafts
FOR SELECT USING (
    auth.uid() = user_id
);

-- Policy 2: Users can create their own draft alerts
CREATE POLICY "Users can create their own draft alerts" ON public.quality_alert_drafts
FOR INSERT WITH CHECK (
    auth.uid() = user_id
);

-- Policy 3: Users can update their own draft alerts
CREATE POLICY "Users can update their own draft alerts" ON public.quality_alert_drafts
FOR UPDATE USING (
    auth.uid() = user_id
);

-- Policy 4: Users can delete their own draft alerts
CREATE POLICY "Users can delete their own draft alerts" ON public.quality_alert_drafts
FOR DELETE USING (
    auth.uid() = user_id
);

-- Policy 6: Admins can delete any draft alert
CREATE POLICY "Admins can delete any draft alert" ON public.quality_alert_drafts
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- Policy 5: Admins can view all draft alerts
CREATE POLICY "Admins can view all draft alerts" ON public.quality_alert_drafts
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- =====================================================
-- ADDITIONAL SECURITY MEASURES
-- =====================================================

-- Create a function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- NO AUDIT TABLES - MINIMAL RLS ONLY
-- =====================================================

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_quality_alerts_user_id ON public.quality_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_quality_alerts_responsibledept ON public.quality_alerts(responsibledept);
CREATE INDEX IF NOT EXISTS idx_quality_alerts_statusaction ON public.quality_alerts(statusaction);
CREATE INDEX IF NOT EXISTS idx_quality_alerts_incidentdate ON public.quality_alerts(incidentdate);

CREATE INDEX IF NOT EXISTS idx_quality_alert_drafts_user_id ON public.quality_alert_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_quality_alert_drafts_drafted_at ON public.quality_alert_drafts(drafted_at);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.quality_alerts IS 'Quality alerts with RLS enabled for user-based access control';
COMMENT ON TABLE public.quality_alert_drafts IS 'Draft quality alerts with RLS enabled for user-based access control';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if RLS is enabled
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename IN ('quality_alerts', 'quality_alert_drafts');

-- Check policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual FROM pg_policies WHERE tablename IN ('quality_alerts', 'quality_alert_drafts');

-- =====================================================
-- END OF QUALITY ALERTS RLS POLICIES
-- =====================================================
