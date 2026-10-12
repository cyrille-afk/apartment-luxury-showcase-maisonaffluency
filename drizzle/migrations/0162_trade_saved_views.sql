CREATE TABLE public.trade_saved_views (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX trade_saved_views_user_name ON public.trade_saved_views (user_id, lower(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_saved_views TO authenticated;
GRANT ALL ON public.trade_saved_views TO service_role;
ALTER TABLE public.trade_saved_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own saved views" ON public.trade_saved_views FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);