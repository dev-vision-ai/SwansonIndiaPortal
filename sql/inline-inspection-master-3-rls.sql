-- RLS policies for inline_inspection_form_master_3
-- Created: 2025-12-03
-- Mirrors the registered/authenticated policies used for inline_inspection_form_master_1

ALTER TABLE public.inline_inspection_form_master_3 ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users
DROP POLICY IF EXISTS "inline_inspection_select_authenticated_master_3" ON public.inline_inspection_form_master_3;
CREATE POLICY "inline_inspection_select_authenticated_master_3" ON public.inline_inspection_form_master_3
    FOR SELECT
    TO public
    USING (
        (auth.uid() IS NOT NULL)
    );

-- SELECT: registered users (exist in users table)
DROP POLICY IF EXISTS "inline_inspection_select_registered_master_3" ON public.inline_inspection_form_master_3;
CREATE POLICY "inline_inspection_select_registered_master_3" ON public.inline_inspection_form_master_3
    FOR SELECT
    TO public
    USING (
        ((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1 FROM public.users u WHERE (u.id = auth.uid()) )))
    );

-- INSERT: registered users
DROP POLICY IF EXISTS "inline_inspection_insert_registered_master_3" ON public.inline_inspection_form_master_3;
CREATE POLICY "inline_inspection_insert_registered_master_3" ON public.inline_inspection_form_master_3
    FOR INSERT
    TO public
    WITH CHECK (
        ((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1 FROM public.users u WHERE (u.id = auth.uid()) )))
    );

-- UPDATE: registered users
DROP POLICY IF EXISTS "inline_inspection_update_registered_master_3" ON public.inline_inspection_form_master_3;
CREATE POLICY "inline_inspection_update_registered_master_3" ON public.inline_inspection_form_master_3
    FOR UPDATE
    TO public
    USING (
        ((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1 FROM public.users u WHERE (u.id = auth.uid()) )))
    )
    WITH CHECK (
        ((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1 FROM public.users u WHERE (u.id = auth.uid()) )))
    );

-- DELETE: registered users
DROP POLICY IF EXISTS "inline_inspection_delete_registered_master_3" ON public.inline_inspection_form_master_3;
CREATE POLICY "inline_inspection_delete_registered_master_3" ON public.inline_inspection_form_master_3
    FOR DELETE
    TO public
    USING (
        ((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1 FROM public.users u WHERE (u.id = auth.uid()) )))
    );
