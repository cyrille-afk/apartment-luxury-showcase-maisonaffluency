CREATE TABLE public.trade_user_memory (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_deadline date,
  default_budget_cents bigint,
  default_currency text,
  preferred_lead_weeks_max int,
  studio_style_notes text,
  style_tags text[] NOT NULL DEFAULT '{}',
  preferred_materials text[] NOT NULL DEFAULT '{}',
  preferred_categories text[] NOT NULL DEFAULT '{}',
  preferred_designers text[] NOT NULL DEFAULT '{}',
  last_brief_summary text,
  source text NOT NULL DEFAULT 'concierge',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_user_memory TO authenticated;
GRANT ALL ON public.trade_user_memory TO service_role;

ALTER TABLE public.trade_user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own memory"
  ON public.trade_user_memory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own memory"
  ON public.trade_user_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own memory"
  ON public.trade_user_memory FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete own memory"
  ON public.trade_user_memory FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "admins read all memory"
  ON public.trade_user_memory FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trade_user_memory_updated_at
  BEFORE UPDATE ON public.trade_user_memory
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();