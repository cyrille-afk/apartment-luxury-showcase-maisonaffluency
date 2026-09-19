
-- Onboarding flow config (singleton row id='default') + tour steps
CREATE TABLE IF NOT EXISTS public.onboarding_flow_config (
  id text PRIMARY KEY DEFAULT 'default',
  greeting_template text NOT NULL DEFAULT 'Welcome to Maison Affluency{first_name_comma} — I''m {concierge_name}. Want a quick tour, or shall we start from a brief?

_Tip: you can rename me any time — I''ll answer to whatever feels right._',
  buttons jsonb NOT NULL DEFAULT '[
    {"label":"Start Quick Tour","prompt":"__concierge:start_tour__","primary":true},
    {"label":"Start from a brief","prompt":"__concierge:start_brief__"},
    {"label":"Rename {concierge_name}","prompt":"__concierge:rename__"}
  ]'::jsonb,
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.onboarding_flow_config (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.onboarding_flow_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read onboarding config"
  ON public.onboarding_flow_config FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage onboarding config"
  ON public.onboarding_flow_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_onboarding_flow_config_updated_at
  BEFORE UPDATE ON public.onboarding_flow_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tour steps
CREATE TABLE IF NOT EXISTS public.onboarding_tour_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_key text NOT NULL UNIQUE,
  title text NOT NULL,
  body text NOT NULL,
  path text NOT NULL,
  icon text NOT NULL DEFAULT 'MapPin',
  cta_label text NOT NULL DEFAULT 'Next',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_tour_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read tour steps"
  ON public.onboarding_tour_steps FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage tour steps"
  ON public.onboarding_tour_steps FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_onboarding_tour_steps_updated_at
  BEFORE UPDATE ON public.onboarding_tour_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults matching current hard-coded steps
INSERT INTO public.onboarding_tour_steps (step_key, title, body, path, icon, cta_label, sort_order) VALUES
  ('showroom', '1. Browse the Showroom',
   'Start here to explore curated rooms in situ. Click any hotspot on a photo to open the piece, see specs, trade pricing and add it to a tearsheet.',
   '/trade/showroom', 'MapPin', 'Next: Designers', 10),
  ('designers', '2. Discover Designers & Ateliers',
   'Filter 274 designers across 32 ateliers by category, country or material. Open any designer to read their biography and shop their pieces.',
   '/trade/designers', 'Users', 'Next: Brief setup', 20),
  ('brief', '3. Set up a brief',
   'Build a tearsheet or quote for your client. You can also ask the AI Concierge to start from a brief — it will scope your project and propose pieces automatically.',
   '/trade/quotes', 'FileText', 'Finish tour', 30)
ON CONFLICT (step_key) DO NOTHING;

-- Admin helper: reset onboarding for one user
CREATE OR REPLACE FUNCTION public.admin_reset_onboarding_for_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can reset onboarding';
  END IF;
  UPDATE public.profiles SET has_seen_trade_intro = false WHERE id = _user_id;
END;
$$;

-- Admin helper: completion stats
CREATE OR REPLACE FUNCTION public.admin_onboarding_stats()
RETURNS TABLE(total_users bigint, completed bigint, pending bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    COUNT(*)::bigint                                              AS total_users,
    COUNT(*) FILTER (WHERE has_seen_trade_intro IS TRUE)::bigint  AS completed,
    COUNT(*) FILTER (WHERE has_seen_trade_intro IS FALSE OR has_seen_trade_intro IS NULL)::bigint AS pending
  FROM public.profiles
  WHERE public.has_role(auth.uid(), 'admin'::app_role);
$$;
