
CREATE TABLE IF NOT EXISTS public.collector_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  occupation TEXT,
  collecting_interests TEXT,
  reference_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.collector_applications TO authenticated;
GRANT ALL ON public.collector_applications TO service_role;

ALTER TABLE public.collector_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own collector application"
  ON public.collector_applications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users create own collector application"
  ON public.collector_applications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins update collector applications"
  ON public.collector_applications FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_collector_apps_updated_at
BEFORE UPDATE ON public.collector_applications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant collector role when approved
CREATE OR REPLACE FUNCTION public.grant_collector_role_on_approve()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'collector'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_collector_apps_grant_role
BEFORE UPDATE ON public.collector_applications
FOR EACH ROW EXECUTE FUNCTION public.grant_collector_role_on_approve();

-- Helper: is the current (or given) user a verified trade pro or approved collector?
CREATE OR REPLACE FUNCTION public.has_verified_access(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('trade_user'::app_role, 'collector'::app_role, 'admin'::app_role, 'super_admin'::app_role)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_verified_access(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_verified_access(UUID) TO authenticated, service_role;
