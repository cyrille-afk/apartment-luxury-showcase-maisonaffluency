CREATE TABLE public.email_portal_links (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  recipient_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  first_clicked_at timestamptz,
  last_clicked_at timestamptz,
  click_count integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.email_portal_links TO authenticated;
GRANT ALL ON public.email_portal_links TO service_role;
ALTER TABLE public.email_portal_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read portal link clicks" ON public.email_portal_links FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX email_portal_links_recipient_idx ON public.email_portal_links (lower(recipient_email));

CREATE OR REPLACE FUNCTION public.record_email_portal_click(p_ref uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.email_portal_links
  SET click_count = click_count + 1,
      first_clicked_at = coalesce(first_clicked_at, now()),
      last_clicked_at = now()
  WHERE token = p_ref AND created_at > now() - interval '180 days';
$$;
REVOKE ALL ON FUNCTION public.record_email_portal_click(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.record_email_portal_click(uuid) TO anon, authenticated;