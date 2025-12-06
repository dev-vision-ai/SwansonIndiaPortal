ALTER TABLE public.inline_inspection_form_master_2
ENABLE ROW LEVEL SECURITY;

CREATE POLICY inline_inspection_select_authenticated_master_2
ON public.inline_inspection_form_master_2
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY inline_inspection_select_registered_master_2
ON public.inline_inspection_form_master_2
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()::uuid
  )
);

CREATE POLICY inline_inspection_insert_registered_master_2
ON public.inline_inspection_form_master_2
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()::uuid
  )
);

CREATE POLICY inline_inspection_update_registered_master_2
ON public.inline_inspection_form_master_2
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()::uuid
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()::uuid
  )
);

CREATE POLICY inline_inspection_delete_registered_master_2
ON public.inline_inspection_form_master_2
FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()::uuid
  )
);
