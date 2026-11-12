CREATE TABLE public.trade_sidebar_preferences (
  user_id uuid PRIMARY KEY,
  sidebar_order jsonb NOT NULL DEFAULT '{}'::jsonb,
  reordered boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_sidebar_preferences TO authenticated;
GRANT ALL ON public.trade_sidebar_preferences TO service_role;
ALTER TABLE public.trade_sidebar_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own sidebar order" ON public.trade_sidebar_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sidebar order" ON public.trade_sidebar_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sidebar order" ON public.trade_sidebar_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own sidebar order" ON public.trade_sidebar_preferences FOR DELETE TO authenticated USING (auth.uid() = user_id);