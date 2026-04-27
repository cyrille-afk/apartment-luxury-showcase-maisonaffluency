-- Force RLS on activity table so even privileged roles respect policies
ALTER TABLE public.trade_custom_request_activity FORCE ROW LEVEL SECURITY;

-- Explicitly block client-side writes (trigger uses SECURITY DEFINER and bypasses RLS)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.trade_custom_request_activity'::regclass AND polname = 'No client inserts') THEN
    CREATE POLICY "No client inserts" ON public.trade_custom_request_activity FOR INSERT TO authenticated WITH CHECK (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.trade_custom_request_activity'::regclass AND polname = 'No client updates') THEN
    CREATE POLICY "No client updates" ON public.trade_custom_request_activity FOR UPDATE TO authenticated USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.trade_custom_request_activity'::regclass AND polname = 'No client deletes') THEN
    CREATE POLICY "No client deletes" ON public.trade_custom_request_activity FOR DELETE TO authenticated USING (false);
  END IF;
END $$;