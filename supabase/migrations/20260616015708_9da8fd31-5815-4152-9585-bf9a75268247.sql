
-- 1) Split commission fields out of order_timeline into admin-only table
CREATE TABLE IF NOT EXISTS public.order_timeline_commission (
  timeline_id uuid PRIMARY KEY REFERENCES public.order_timeline(id) ON DELETE CASCADE,
  commission_statement_sent_at timestamptz,
  commission_payout_currency text,
  commission_payout_cents bigint,
  commission_fx_rate numeric,
  commission_fx_source text,
  commission_fx_locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_timeline_commission TO authenticated;
GRANT ALL ON public.order_timeline_commission TO service_role;

ALTER TABLE public.order_timeline_commission ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage commission"
  ON public.order_timeline_commission
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_updated_at_on_commission
  BEFORE UPDATE ON public.order_timeline_commission
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill any existing rows
INSERT INTO public.order_timeline_commission (
  timeline_id, commission_statement_sent_at, commission_payout_currency,
  commission_payout_cents, commission_fx_rate, commission_fx_source, commission_fx_locked_at
)
SELECT id, commission_statement_sent_at, commission_payout_currency,
       commission_payout_cents, commission_fx_rate, commission_fx_source, commission_fx_locked_at
FROM public.order_timeline
WHERE commission_statement_sent_at IS NOT NULL
   OR commission_payout_currency IS NOT NULL
   OR commission_payout_cents IS NOT NULL
   OR commission_fx_rate IS NOT NULL
   OR commission_fx_source IS NOT NULL
   OR commission_fx_locked_at IS NOT NULL
ON CONFLICT (timeline_id) DO NOTHING;

ALTER TABLE public.order_timeline
  DROP COLUMN commission_statement_sent_at,
  DROP COLUMN commission_payout_currency,
  DROP COLUMN commission_payout_cents,
  DROP COLUMN commission_fx_rate,
  DROP COLUMN commission_fx_source,
  DROP COLUMN commission_fx_locked_at;

-- 2) Restrict client_contacts SELECT to editors+ (viewers no longer see PII)
DROP POLICY IF EXISTS "Studio members view contacts" ON public.client_contacts;
CREATE POLICY "Studio editors view contacts"
  ON public.client_contacts
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_contacts.client_id
      AND public.can_edit_studio(auth.uid(), c.studio_id)
  ));

-- 3) profiles UPDATE: add WITH CHECK + trigger blocking self-escalation
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.prevent_profile_tier_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.trade_tier IS DISTINCT FROM OLD.trade_tier
     OR NEW.trade_tier_suggested IS DISTINCT FROM OLD.trade_tier_suggested
     OR NEW.trade_tier_12mo_spend_cents IS DISTINCT FROM OLD.trade_tier_12mo_spend_cents
     OR NEW.trade_tier_computed_at IS DISTINCT FROM OLD.trade_tier_computed_at THEN
    RAISE EXCEPTION 'Only admins can modify trade_tier fields';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_tier_self_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_tier_self_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_tier_self_escalation();

-- 4) DB-level rate limit on concierge_leads inserts
CREATE OR REPLACE FUNCTION public.enforce_concierge_lead_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _key text;
  _count_1m int;
  _count_1h int;
BEGIN
  _key := COALESCE(NEW.user_id::text, NEW.session_id, NEW.referrer, 'anon');

  SELECT count(*) INTO _count_1m
  FROM public.concierge_leads
  WHERE COALESCE(user_id::text, session_id, referrer, 'anon') = _key
    AND created_at > now() - interval '1 minute';

  IF _count_1m >= 3 THEN
    RAISE EXCEPTION 'Rate limit: too many concierge leads (per minute)';
  END IF;

  SELECT count(*) INTO _count_1h
  FROM public.concierge_leads
  WHERE COALESCE(user_id::text, session_id, referrer, 'anon') = _key
    AND created_at > now() - interval '1 hour';

  IF _count_1h >= 20 THEN
    RAISE EXCEPTION 'Rate limit: too many concierge leads (per hour)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_concierge_lead_rate_limit ON public.concierge_leads;
CREATE TRIGGER trg_enforce_concierge_lead_rate_limit
  BEFORE INSERT ON public.concierge_leads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_concierge_lead_rate_limit();
