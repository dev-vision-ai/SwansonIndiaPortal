-- =====================================================
-- FILM INSPECTION FORMS RLS POLICIES
-- Swanson India Portal - Row Level Security Implementation
-- =====================================================

-- =====================================================
-- FILM INSPECTION TABLES TO SECURE
-- =====================================================

-- List of all film inspection form tables that need RLS policies:
-- 102_18c_micro_white
-- 168_16c_white
-- 168_16cp_kranti
-- 168_18c_white
-- 168_18c_white_jeddah
-- 176_18cp_ww
-- 214_18_micro_white
-- 234_18_micro_white

-- =====================================================
-- DROP EXISTING POLICIES FIRST
-- =====================================================

-- Drop existing policies for all film inspection form tables
DROP POLICY IF EXISTS "Authorized departments can view 102_18c_micro_white" ON public."102_18c_micro_white";
DROP POLICY IF EXISTS "Authorized departments can create 102_18c_micro_white" ON public."102_18c_micro_white";
DROP POLICY IF EXISTS "Authorized departments can update 102_18c_micro_white" ON public."102_18c_micro_white";
DROP POLICY IF EXISTS "Authorized departments can delete 102_18c_micro_white" ON public."102_18c_micro_white";

DROP POLICY IF EXISTS "Authorized departments can view 168_16c_white" ON public."168_16c_white";
DROP POLICY IF EXISTS "Authorized departments can create 168_16c_white" ON public."168_16c_white";
DROP POLICY IF EXISTS "Authorized departments can update 168_16c_white" ON public."168_16c_white";
DROP POLICY IF EXISTS "Authorized departments can delete 168_16c_white" ON public."168_16c_white";

DROP POLICY IF EXISTS "Authorized departments can view 168_16cp_kranti" ON public."168_16cp_kranti";
DROP POLICY IF EXISTS "Authorized departments can create 168_16cp_kranti" ON public."168_16cp_kranti";
DROP POLICY IF EXISTS "Authorized departments can update 168_16cp_kranti" ON public."168_16cp_kranti";
DROP POLICY IF EXISTS "Authorized departments can delete 168_16cp_kranti" ON public."168_16cp_kranti";

DROP POLICY IF EXISTS "Authorized departments can view 168_18c_white" ON public."168_18c_white";
DROP POLICY IF EXISTS "Authorized departments can create 168_18c_white" ON public."168_18c_white";
DROP POLICY IF EXISTS "Authorized departments can update 168_18c_white" ON public."168_18c_white";
DROP POLICY IF EXISTS "Authorized departments can delete 168_18c_white" ON public."168_18c_white";

DROP POLICY IF EXISTS "Authorized departments can view 168_18c_white_jeddah" ON public."168_18c_white_jeddah";
DROP POLICY IF EXISTS "Authorized departments can create 168_18c_white_jeddah" ON public."168_18c_white_jeddah";
DROP POLICY IF EXISTS "Authorized departments can update 168_18c_white_jeddah" ON public."168_18c_white_jeddah";
DROP POLICY IF EXISTS "Authorized departments can delete 168_18c_white_jeddah" ON public."168_18c_white_jeddah";

DROP POLICY IF EXISTS "Authorized departments can view 176_18cp_ww" ON public."176_18cp_ww";
DROP POLICY IF EXISTS "Authorized departments can create 176_18cp_ww" ON public."176_18cp_ww";
DROP POLICY IF EXISTS "Authorized departments can update 176_18cp_ww" ON public."176_18cp_ww";
DROP POLICY IF EXISTS "Authorized departments can delete 176_18cp_ww" ON public."176_18cp_ww";

DROP POLICY IF EXISTS "Authorized departments can view 214_18_micro_white" ON public."214_18_micro_white";
DROP POLICY IF EXISTS "Authorized departments can create 214_18_micro_white" ON public."214_18_micro_white";
DROP POLICY IF EXISTS "Authorized departments can update 214_18_micro_white" ON public."214_18_micro_white";
DROP POLICY IF EXISTS "Authorized departments can delete 214_18_micro_white" ON public."214_18_micro_white";

DROP POLICY IF EXISTS "Authorized departments can view 234_18_micro_white" ON public."234_18_micro_white";
DROP POLICY IF EXISTS "Authorized departments can create 234_18_micro_white" ON public."234_18_micro_white";
DROP POLICY IF EXISTS "Authorized departments can update 234_18_micro_white" ON public."234_18_micro_white";
DROP POLICY IF EXISTS "Authorized departments can delete 234_18_micro_white" ON public."234_18_micro_white";

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

-- Enable RLS on all film inspection form tables
ALTER TABLE public."102_18c_micro_white" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."168_16c_white" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."168_16cp_kranti" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."168_18c_white" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."168_18c_white_jeddah" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."176_18cp_ww" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."214_18_micro_white" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."234_18_micro_white" ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE POLICIES FOR EACH TABLE
-- =====================================================

-- Policy for 102_18c_micro_white
CREATE POLICY "Authenticated users can view 102_18c_micro_white" ON public."102_18c_micro_white"
FOR SELECT USING (
    auth.uid() IS NOT NULL
);

CREATE POLICY "Authorized departments can create 102_18c_micro_white" ON public."102_18c_micro_white"
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

CREATE POLICY "Authorized departments can update 102_18c_micro_white" ON public."102_18c_micro_white"
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

CREATE POLICY "Authorized departments can delete 102_18c_micro_white" ON public."102_18c_micro_white"
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

-- Policy for 168_16c_white
CREATE POLICY "Authenticated users can view 168_16c_white" ON public."168_16c_white"
FOR SELECT USING (
    auth.uid() IS NOT NULL
);

CREATE POLICY "Authorized departments can create 168_16c_white" ON public."168_16c_white"
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

CREATE POLICY "Authorized departments can update 168_16c_white" ON public."168_16c_white"
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

CREATE POLICY "Authorized departments can delete 168_16c_white" ON public."168_16c_white"
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

-- Policy for 168_16cp_kranti
CREATE POLICY "Authenticated users can view 168_16cp_kranti" ON public."168_16cp_kranti"
FOR SELECT USING (
    auth.uid() IS NOT NULL
);

CREATE POLICY "Authorized departments can create 168_16cp_kranti" ON public."168_16cp_kranti"
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

CREATE POLICY "Authorized departments can update 168_16cp_kranti" ON public."168_16cp_kranti"
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

CREATE POLICY "Authorized departments can delete 168_16cp_kranti" ON public."168_16cp_kranti"
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

-- Policy for 168_18c_white
CREATE POLICY "Authenticated users can view 168_18c_white" ON public."168_18c_white"
FOR SELECT USING (
    auth.uid() IS NOT NULL
);

CREATE POLICY "Authorized departments can create 168_18c_white" ON public."168_18c_white"
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

CREATE POLICY "Authorized departments can update 168_18c_white" ON public."168_18c_white"
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

CREATE POLICY "Authorized departments can delete 168_18c_white" ON public."168_18c_white"
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

-- Policy for 168_18c_white_jeddah
CREATE POLICY "Authenticated users can view 168_18c_white_jeddah" ON public."168_18c_white_jeddah"
FOR SELECT USING (
    auth.uid() IS NOT NULL
);

CREATE POLICY "Authorized departments can create 168_18c_white_jeddah" ON public."168_18c_white_jeddah"
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

CREATE POLICY "Authorized departments can update 168_18c_white_jeddah" ON public."168_18c_white_jeddah"
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

CREATE POLICY "Authorized departments can delete 168_18c_white_jeddah" ON public."168_18c_white_jeddah"
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

-- Policy for 176_18cp_ww
CREATE POLICY "Authenticated users can view 176_18cp_ww" ON public."176_18cp_ww"
FOR SELECT USING (
    auth.uid() IS NOT NULL
);

CREATE POLICY "Authorized departments can create 176_18cp_ww" ON public."176_18cp_ww"
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

CREATE POLICY "Authorized departments can update 176_18cp_ww" ON public."176_18cp_ww"
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

CREATE POLICY "Authorized departments can delete 176_18cp_ww" ON public."176_18cp_ww"
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

-- Policy for 214_18_micro_white
CREATE POLICY "Authenticated users can view 214_18_micro_white" ON public."214_18_micro_white"
FOR SELECT USING (
    auth.uid() IS NOT NULL
);

CREATE POLICY "Authorized departments can create 214_18_micro_white" ON public."214_18_micro_white"
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

CREATE POLICY "Authorized departments can update 214_18_micro_white" ON public."214_18_micro_white"
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

CREATE POLICY "Authorized departments can delete 214_18_micro_white" ON public."214_18_micro_white"
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

-- Policy for 234_18_micro_white
CREATE POLICY "Authenticated users can view 234_18_micro_white" ON public."234_18_micro_white"
FOR SELECT USING (
    auth.uid() IS NOT NULL
);

CREATE POLICY "Authorized departments can create 234_18_micro_white" ON public."234_18_micro_white"
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

CREATE POLICY "Authorized departments can update 234_18_micro_white" ON public."234_18_micro_white"
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

CREATE POLICY "Authorized departments can delete 234_18_micro_white" ON public."234_18_micro_white"
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.department IN ('Quality Control', 'Quality Assurance')
    )
);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public."102_18c_micro_white" IS '102 18c micro white film inspection forms - RLS enabled for Quality Control and Quality Assurance departments only';
COMMENT ON TABLE public."168_16c_white" IS '168 16c white film inspection forms - RLS enabled for Quality Control and Quality Assurance departments only';
COMMENT ON TABLE public."168_16cp_kranti" IS '168 16cp kranti film inspection forms - RLS enabled for Quality Control and Quality Assurance departments only';
COMMENT ON TABLE public."168_18c_white" IS '168 18c white film inspection forms - RLS enabled for Quality Control and Quality Assurance departments only';
COMMENT ON TABLE public."168_18c_white_jeddah" IS '168 18c white jeddah film inspection forms - RLS enabled for Quality Control and Quality Assurance departments only';
COMMENT ON TABLE public."176_18cp_ww" IS '176 18cp ww film inspection forms - RLS enabled for Quality Control and Quality Assurance departments only';
COMMENT ON TABLE public."214_18_micro_white" IS '214 18 micro white film inspection forms - RLS enabled for Quality Control and Quality Assurance departments only';
COMMENT ON TABLE public."234_18_micro_white" IS '234 18 micro white film inspection forms - RLS enabled for Quality Control and Quality Assurance departments only';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('102_18c_micro_white', '168_16c_white', '168_16cp_kranti', '168_18c_white', '168_18c_white_jeddah', '176_18cp_ww', '214_18_micro_white', '234_18_micro_white');

-- Check policies for all tables
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual FROM pg_policies
WHERE tablename IN ('102_18c_micro_white', '168_16c_white', '168_16cp_kranti', '168_18c_white', '168_18c_white_jeddah', '176_18cp_ww', '214_18_micro_white', '234_18_micro_white');

-- =====================================================
-- END OF FILM INSPECTION FORMS RLS POLICIES
-- =====================================================
