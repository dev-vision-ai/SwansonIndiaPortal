-- SQL migration: restrict SELECT/UPDATE/DELETE on quality_alerts
-- Only users with user_level = 1 (from any department) may SELECT, UPDATE, DELETE
-- Drop the old admin policies (if present) and create the new policies

-- Drop any existing policies that allowed broader access
DROP POLICY IF EXISTS "Admins can view all quality alerts" ON public.quality_alerts;
DROP POLICY IF EXISTS "Admins can update any quality alert" ON public.quality_alerts;
DROP POLICY IF EXISTS "Admins can delete any quality alert" ON public.quality_alerts;
DROP POLICY IF EXISTS "QA can view quality alerts" ON public.quality_alerts;
DROP POLICY IF EXISTS "QA can update quality alerts" ON public.quality_alerts;
DROP POLICY IF EXISTS "QA can delete quality alerts" ON public.quality_alerts;

-- SELECT policy: any user with level 1 can view
CREATE POLICY "Level 1 users can view quality alerts" ON public.quality_alerts
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.user_level = 1
    )
  );

-- UPDATE policy: only QA level 1 can update
CREATE POLICY "QA can update quality alerts" ON public.quality_alerts
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.department = 'Quality Assurance'
        AND u.user_level = 1
    )
  )
  WITH CHECK (
    -- Ensure the acting user still satisfies the QA & level condition for the new row
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.department = 'Quality Assurance'
        AND u.user_level = 1
    )
  );

-- DELETE policy: only QA level 1 can delete
CREATE POLICY "QA can delete quality alerts" ON public.quality_alerts
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.department = 'Quality Assurance'
        AND u.user_level = 1
    )
  );

-- Notes:
-- 1) This assumes there is a `public.users` table containing `id` (matches auth.uid()),
--    and `user_level` (integer) column.
-- 2) Any user with user_level = 1, regardless of department, can access quality alerts.

