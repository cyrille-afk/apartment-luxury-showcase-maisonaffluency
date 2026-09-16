ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS assigned_tier text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS rolling_12m_spend_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eligible_tier text,
  ADD COLUMN IF NOT EXISTS eligible_for_upgrade boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tier_computed_at timestamptz;

CREATE OR REPLACE FUNCTION public.tier_rank(_tier text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(coalesce(_tier, 'standard'))
    WHEN 'platinum' THEN 3
    WHEN 'gold' THEN 2
    WHEN 'silver' THEN 1
    ELSE 0
  END
$$;

CREATE OR REPLACE FUNCTION public.recompute_client_tier_eligibility(_client_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gold_min bigint;
  plat_min bigint;
BEGIN
  SELECT coalesce(min_spend_cents, 5000000)::bigint INTO gold_min FROM public.trade_tier_config WHERE tier = 'gold';
  SELECT coalesce(min_spend_cents, 20000000)::bigint INTO plat_min FROM public.trade_tier_config WHERE tier = 'platinum';
  gold_min := coalesce(gold_min, 5000000);
  plat_min := coalesce(plat_min, 20000000);

  WITH spend AS (
    SELECT q.client_id,
           coalesce(sum(i.quantity * i.unit_price_cents), 0)::bigint AS cents
    FROM public.trade_quotes q
    JOIN public.trade_quote_items i ON i.quote_id = q.id
    WHERE q.client_id IS NOT NULL
      AND (q.status IN ('confirmed', 'accepted', 'ordered') OR q.confirmed_at IS NOT NULL)
      AND coalesce(q.confirmed_at, q.updated_at, q.created_at) >= now() - interval '12 months'
    GROUP BY q.client_id
  )
  UPDATE public.clients c
  SET rolling_12m_spend_cents = coalesce(s.cents, 0),
      eligible_tier = CASE
        WHEN coalesce(s.cents, 0) >= plat_min THEN 'platinum'
        WHEN coalesce(s.cents, 0) >= gold_min THEN 'gold'
        ELSE NULL
      END,
      eligible_for_upgrade = CASE
        WHEN coalesce(s.cents, 0) >= plat_min THEN public.tier_rank('platinum') > public.tier_rank(c.assigned_tier)
        WHEN coalesce(s.cents, 0) >= gold_min THEN public.tier_rank('gold') > public.tier_rank(c.assigned_tier)
        ELSE false
      END,
      tier_computed_at = now()
  FROM (SELECT id FROM public.clients WHERE _client_id IS NULL OR id = _client_id) t
  LEFT JOIN spend s ON s.client_id = t.id
  WHERE c.id = t.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_client_tier_eligibility(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tier_rank(text) TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.trg_recompute_client_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF OLD.client_id IS NOT NULL THEN
      PERFORM public.recompute_client_tier_eligibility(OLD.client_id);
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.client_id IS NOT NULL THEN
    PERFORM public.recompute_client_tier_eligibility(NEW.client_id);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.client_id IS NOT NULL AND OLD.client_id IS DISTINCT FROM NEW.client_id THEN
    PERFORM public.recompute_client_tier_eligibility(OLD.client_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trade_quotes_client_tier ON public.trade_quotes;
CREATE TRIGGER trade_quotes_client_tier
AFTER INSERT OR UPDATE OF status, confirmed_at, client_id OR DELETE ON public.trade_quotes
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_client_tier();

CREATE OR REPLACE FUNCTION public.trg_recompute_client_tier_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid uuid;
BEGIN
  SELECT client_id INTO cid FROM public.trade_quotes WHERE id = coalesce(NEW.quote_id, OLD.quote_id);
  IF cid IS NOT NULL THEN
    PERFORM public.recompute_client_tier_eligibility(cid);
  END IF;
  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trade_quote_items_client_tier ON public.trade_quote_items;
CREATE TRIGGER trade_quote_items_client_tier
AFTER INSERT OR UPDATE OR DELETE ON public.trade_quote_items
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_client_tier_items();

SELECT public.recompute_client_tier_eligibility(NULL);