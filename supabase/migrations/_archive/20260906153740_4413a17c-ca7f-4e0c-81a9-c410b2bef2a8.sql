CREATE TABLE public.trade_program_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  company_name text,
  website_url text,
  step smallint NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'trade-program-hero',
  user_agent text,
  referrer text,
  invite_email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX trade_program_signups_email_key ON public.trade_program_signups (lower(email));

GRANT ALL ON public.trade_program_signups TO service_role;
GRANT SELECT ON public.trade_program_signups TO authenticated;

ALTER TABLE public.trade_program_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view trade program signups"
ON public.trade_program_signups FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trade_program_signups_updated_at
BEFORE UPDATE ON public.trade_program_signups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();