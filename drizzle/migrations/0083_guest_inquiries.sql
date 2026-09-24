CREATE TABLE public.guest_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_key text NOT NULL CHECK (guest_key ~ '^[0-9a-f-]{36}$'),
  lang text NOT NULL DEFAULT 'zh' CHECK (lang IN ('zh','en')),
  invited_name text CHECK (char_length(invited_name) <= 120),
  portal_session_hint text CHECK (char_length(portal_session_hint) <= 64),
  messages jsonb NOT NULL CHECK (jsonb_typeof(messages) = 'array' AND jsonb_array_length(messages) BETWEEN 1 AND 60 AND pg_column_size(messages) <= 60000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','bridged','low_intent','rejected')),
  bridged_brief_id uuid REFERENCES public.cn_director_briefs(id) ON DELETE SET NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guest_inquiries_status_created_idx ON public.guest_inquiries (status, created_at DESC);
CREATE INDEX guest_inquiries_guest_key_idx ON public.guest_inquiries (guest_key, created_at DESC);

GRANT INSERT ON public.guest_inquiries TO anon, authenticated;
GRANT SELECT, UPDATE ON public.guest_inquiries TO authenticated;
GRANT ALL ON public.guest_inquiries TO service_role;

ALTER TABLE public.guest_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can submit guest inquiries" ON public.guest_inquiries
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending' AND bridged_brief_id IS NULL AND processed_at IS NULL);

CREATE POLICY "Admins can read guest inquiries" ON public.guest_inquiries
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can update guest inquiries" ON public.guest_inquiries
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Force server-owned fields and throttle floods (20 per guest per hour, 500 globally per hour).
CREATE OR REPLACE FUNCTION public.guest_inquiries_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.id := gen_random_uuid();
    NEW.created_at := now();
    NEW.status := 'pending';
    NEW.bridged_brief_id := NULL;
    NEW.processed_at := NULL;
    IF (SELECT count(*) FROM public.guest_inquiries WHERE guest_key = NEW.guest_key AND created_at > now() - interval '1 hour') >= 20
       OR (SELECT count(*) FROM public.guest_inquiries WHERE created_at > now() - interval '1 hour') >= 500 THEN
      RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guest_inquiries_before_insert() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guest_inquiries_before_insert
  BEFORE INSERT ON public.guest_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.guest_inquiries_before_insert();