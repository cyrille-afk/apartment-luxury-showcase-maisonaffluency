
-- 1. Mobile-save provenance on board items
ALTER TABLE public.client_board_items
  ADD COLUMN IF NOT EXISTS saved_via text NOT NULL DEFAULT 'desktop',
  ADD COLUMN IF NOT EXISTS added_by uuid,
  ADD COLUMN IF NOT EXISTS seen_on_desktop_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS digest_sent_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_cbi_saved_via_unseen
  ON public.client_board_items (saved_via, seen_on_desktop_at)
  WHERE saved_via = 'mobile';

-- 2. Studio alerts (in-app + push)
CREATE TABLE IF NOT EXISTS public.studio_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'supply_update',
  title text NOT NULL,
  body text NOT NULL,
  product_id uuid,
  board_id uuid,
  project_name text,
  url text,
  read_at timestamp with time zone,
  pushed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.studio_alerts TO authenticated;
GRANT ALL ON public.studio_alerts TO service_role;
ALTER TABLE public.studio_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own alerts"
  ON public.studio_alerts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users mark their own alerts read"
  ON public.studio_alerts FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_studio_alerts_user_unread
  ON public.studio_alerts (user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_alerts_unpushed
  ON public.studio_alerts (pushed_at) WHERE pushed_at IS NULL;

-- 3. Push subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  last_success_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own push subscriptions"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_studio_alerts_updated_at ON public.studio_alerts;
CREATE TRIGGER update_studio_alerts_updated_at
  BEFORE UPDATE ON public.studio_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Supply / lead-time change fan-out to everyone who saved the product
CREATE OR REPLACE FUNCTION public.fanout_supply_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg text;
  rec record;
BEGIN
  IF NEW.is_active IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  IF (COALESCE(NEW.lead_time,'') IS DISTINCT FROM COALESCE(OLD.lead_time,''))
     OR (COALESCE(NEW.stock_status_override,'') IS DISTINCT FROM COALESCE(OLD.stock_status_override,''))
     OR (COALESCE(NEW.lead_weeks_max_override, -1) IS DISTINCT FROM COALESCE(OLD.lead_weeks_max_override, -1)) THEN

    msg := COALESCE(NEW.brand_name, 'The atelier') || ' reports updated availability for '
           || COALESCE(NEW.product_name, 'a saved piece')
           || CASE WHEN COALESCE(NEW.lead_time,'') <> '' THEN ' — lead time now ' || NEW.lead_time ELSE '' END
           || '. Review updated project lead times on your desktop dashboard.';

    FOR rec IN
      SELECT DISTINCT b.user_id, b.id AS board_id, COALESCE(b.title, 'your project') AS project_name
      FROM public.client_board_items i
      JOIN public.client_boards b ON b.id = i.board_id
      WHERE i.product_id = NEW.id AND b.user_id IS NOT NULL
    LOOP
      INSERT INTO public.studio_alerts (user_id, kind, title, body, product_id, board_id, project_name, url)
      VALUES (
        rec.user_id,
        'supply_update',
        'Update for ' || rec.project_name,
        msg,
        NEW.id,
        rec.board_id,
        rec.project_name,
        '/trade/boards'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fanout_supply_change ON public.trade_products;
CREATE TRIGGER trg_fanout_supply_change
  AFTER UPDATE ON public.trade_products
  FOR EACH ROW EXECUTE FUNCTION public.fanout_supply_change();

-- 6. Cron: studio digest 08:30 daily + push dispatch every 15 minutes
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

DO $$
DECLARE jid bigint;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname IN ('studio-sourcing-digest-daily','studio-push-dispatch-15m') LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'studio-sourcing-digest-daily',
  '30 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/send-studio-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'studio-push-dispatch-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dcrauiygaezoduwdjmsm.supabase.co/functions/v1/dispatch-studio-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
