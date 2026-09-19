-- Hide trade pricing from anonymous (public) visitors at the column level.
-- Public pages always render "Price upon Request"; trade users (authenticated)
-- continue to see prices via existing RLS.
REVOKE SELECT (trade_price_cents, price_per_sqm_cents)
  ON public.designer_curator_picks FROM anon;

-- Studios is only consumed by authenticated trade members; row-level access
-- is already restricted by RLS. Remove the redundant anon grant so the
-- billing_email column is not even theoretically exposed to public callers.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.studios FROM anon;