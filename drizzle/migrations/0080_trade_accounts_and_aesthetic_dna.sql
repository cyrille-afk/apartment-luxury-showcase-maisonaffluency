CREATE TABLE public.trade_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signup_id uuid UNIQUE REFERENCES public.trade_program_signups(id) ON DELETE SET NULL,
  email text NOT NULL,
  studio_name text,
  contact_name text,
  website_or_ig text,
  business_reg_number text,
  credential_document_path text,
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','on_hold','approved','rejected')),
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX trade_accounts_email_key ON public.trade_accounts (lower(email));
CREATE INDEX trade_accounts_status_idx ON public.trade_accounts (status, created_at DESC);
GRANT SELECT, UPDATE ON public.trade_accounts TO authenticated;
GRANT ALL ON public.trade_accounts TO service_role;
ALTER TABLE public.trade_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view trade accounts" ON public.trade_accounts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins update trade accounts" ON public.trade_accounts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trade_accounts_updated_at BEFORE UPDATE ON public.trade_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.studio_aesthetic_dna (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_account_id uuid NOT NULL UNIQUE REFERENCES public.trade_accounts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','complete','failed')),
  source_url text,
  image_urls text[] NOT NULL DEFAULT '{}',
  aesthetic_label text,
  aesthetic_summary text,
  dominant_tones text[] NOT NULL DEFAULT '{}',
  historical_affinities text[] NOT NULL DEFAULT '{}',
  materials text[] NOT NULL DEFAULT '{}',
  predicted_designer_matches jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_analysis jsonb,
  model text,
  error text,
  attempts int NOT NULL DEFAULT 0,
  analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.studio_aesthetic_dna TO authenticated;
GRANT ALL ON public.studio_aesthetic_dna TO service_role;
ALTER TABLE public.studio_aesthetic_dna ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view aesthetic dna" ON public.studio_aesthetic_dna FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER studio_aesthetic_dna_updated_at BEFORE UPDATE ON public.studio_aesthetic_dna
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();