CREATE TABLE IF NOT EXISTS public.acquisition_test_mode (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  redirect_email text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.acquisition_test_mode TO authenticated;
GRANT ALL ON public.acquisition_test_mode TO service_role;

ALTER TABLE public.acquisition_test_mode ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read acquisition test mode" ON public.acquisition_test_mode;
CREATE POLICY "admins read acquisition test mode"
ON public.acquisition_test_mode FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "admins insert acquisition test mode" ON public.acquisition_test_mode;
CREATE POLICY "admins insert acquisition test mode"
ON public.acquisition_test_mode FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "admins update acquisition test mode" ON public.acquisition_test_mode;
CREATE POLICY "admins update acquisition test mode"
ON public.acquisition_test_mode FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.acquisition_test_mode (id, enabled, redirect_email)
VALUES (true, false, 'cyrille@maisonaffluency.com')
ON CONFLICT (id) DO NOTHING;