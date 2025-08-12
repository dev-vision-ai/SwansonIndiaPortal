-- =====================================================
-- SAFETY INCIDENTS RLS POLICIES
-- Swanson India Portal - Row Level Security Implementation
-- =====================================================

-- =====================================================
-- DROP EXISTING POLICIES FIRST
-- =====================================================

-- Drop existing policies for safety_incident_form table
DROP POLICY IF EXISTS "Users can view their own safety incidents" ON public.safety_incident_form;
DROP POLICY IF EXISTS "Users can create their own safety incidents" ON public.safety_incident_form;
DROP POLICY IF EXISTS "Users can update their own safety incidents" ON public.safety_incident_form;
DROP POLICY IF EXISTS "Admins can view all safety incidents" ON public.safety_incident_form;
DROP POLICY IF EXISTS "Users can view their department incidents" ON public.safety_incident_form;
DROP POLICY IF EXISTS "Admins can update any safety incident" ON public.safety_incident_form;
DROP POLICY IF EXISTS "Admins can delete any safety incident" ON public.safety_incident_form;
DROP POLICY IF EXISTS "Users cannot delete safety incidents" ON public.safety_incident_form;

-- Drop existing policies for safety_incident_draft table
DROP POLICY IF EXISTS "Users can view their own draft safety incidents" ON public.safety_incident_draft;
DROP POLICY IF EXISTS "Users can create their own draft safety incidents" ON public.safety_incident_draft;
DROP POLICY IF EXISTS "Users can update their own draft safety incidents" ON public.safety_incident_draft;
DROP POLICY IF EXISTS "Users can delete their own draft safety incidents" ON public.safety_incident_draft;
DROP POLICY IF EXISTS "Admins can view all draft safety incidents" ON public.safety_incident_draft;
DROP POLICY IF EXISTS "Admins can delete any draft safety incident" ON public.safety_incident_draft;

-- =====================================================
-- ENABLE RLS
-- =====================================================

-- Enable RLS on safety_incident_form table
ALTER TABLE public.safety_incident_form ENABLE ROW LEVEL SECURITY;

-- Enable RLS on safety_incident_draft table
ALTER TABLE public.safety_incident_draft ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SAFETY_INCIDENT_FORM TABLE POLICIES
-- =====================================================

-- Policy 1: Users can view their own incidents
CREATE POLICY "Users can view their own safety incidents" ON public.safety_incident_form
FOR SELECT USING (
    auth.uid() = user_id
);

-- Policy 2: Users can create their own incidents
CREATE POLICY "Users can create their own safety incidents" ON public.safety_incident_form
FOR INSERT WITH CHECK (
    auth.uid() = user_id
);

-- Policy 3: Users can update their own incidents only if in draft status
CREATE POLICY "Users can update their own safety incidents" ON public.safety_incident_form
FOR UPDATE USING (
    auth.uid() = user_id AND 
    (status_action IS NULL OR status_action = 'Draft')
);

-- Policy 4: Admins can view all safety incidents
CREATE POLICY "Admins can view all safety incidents" ON public.safety_incident_form
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- Policy 5: Users can view incidents for their department (if they have department info)
CREATE POLICY "Users can view their department incidents" ON public.safety_incident_form
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.department = department
    )
);

-- Policy 6: Admins can update any incident (for processing)
CREATE POLICY "Admins can update any safety incident" ON public.safety_incident_form
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- Policy 7: Admins can delete any incident
CREATE POLICY "Admins can delete any safety incident" ON public.safety_incident_form
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- Policy 8: Users cannot delete safety incidents (only admins can)
CREATE POLICY "Users cannot delete safety incidents" ON public.safety_incident_form
FOR DELETE USING (false);

-- =====================================================
-- SAFETY_INCIDENT_DRAFT TABLE POLICIES
-- =====================================================

-- Policy 1: Users can view their own draft incidents
CREATE POLICY "Users can view their own draft safety incidents" ON public.safety_incident_draft
FOR SELECT USING (
    auth.uid() = user_id
);

-- Policy 2: Users can create their own draft incidents
CREATE POLICY "Users can create their own draft safety incidents" ON public.safety_incident_draft
FOR INSERT WITH CHECK (
    auth.uid() = user_id
);

-- Policy 3: Users can update their own draft incidents
CREATE POLICY "Users can update their own draft safety incidents" ON public.safety_incident_draft
FOR UPDATE USING (
    auth.uid() = user_id
);

-- Policy 4: Users can delete their own draft incidents
CREATE POLICY "Users can delete their own draft safety incidents" ON public.safety_incident_draft
FOR DELETE USING (
    auth.uid() = user_id
);

-- Policy 5: Admins can view all draft incidents
CREATE POLICY "Admins can view all draft safety incidents" ON public.safety_incident_draft
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- Policy 6: Admins can delete any draft incident
CREATE POLICY "Admins can delete any draft safety incident" ON public.safety_incident_draft
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.is_admin = true
    )
);

-- =====================================================
-- ADDITIONAL SECURITY MEASURES
-- =====================================================

-- Create a function to check if user is admin (reuse existing function)
-- Note: This function should already exist from quality alerts RLS
-- If not, uncomment the following:
/*
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
*/

-- =====================================================
-- NO AUDIT TABLES - MINIMAL RLS ONLY
-- =====================================================

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_safety_incident_form_user_id ON public.safety_incident_form(user_id);
CREATE INDEX IF NOT EXISTS idx_safety_incident_form_department ON public.safety_incident_form(department);
CREATE INDEX IF NOT EXISTS idx_safety_incident_form_status_action ON public.safety_incident_form(status_action);
CREATE INDEX IF NOT EXISTS idx_safety_incident_form_incident_date ON public.safety_incident_form(incident_date);
CREATE INDEX IF NOT EXISTS idx_safety_incident_form_severity ON public.safety_incident_form(severity);

CREATE INDEX IF NOT EXISTS idx_safety_incident_draft_user_id ON public.safety_incident_draft(user_id);
CREATE INDEX IF NOT EXISTS idx_safety_incident_draft_created_at ON public.safety_incident_draft(created_at);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.safety_incident_form IS 'Safety incidents with RLS enabled for user-based access control';
COMMENT ON TABLE public.safety_incident_draft IS 'Draft safety incidents with RLS enabled for user-based access control';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if RLS is enabled
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename IN ('safety_incident_form', 'safety_incident_draft');

-- Check policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual FROM pg_policies WHERE tablename IN ('safety_incident_form', 'safety_incident_draft');

-- =====================================================
-- END OF SAFETY INCIDENTS RLS POLICIES
-- =====================================================
