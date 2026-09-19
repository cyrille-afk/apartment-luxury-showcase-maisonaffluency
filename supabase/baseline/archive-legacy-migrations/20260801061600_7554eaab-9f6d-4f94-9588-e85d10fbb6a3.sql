ALTER TABLE public.trade_products ADD COLUMN IF NOT EXISTS public_rrp_visible boolean NOT NULL DEFAULT false;

UPDATE public.trade_products
SET public_rrp_visible = true
WHERE brand_name ILIKE '%apparatus%' AND coalesce(rrp_price_cents,0) > 0;

CREATE OR REPLACE VIEW public.trade_products_public_rrp
WITH (security_invoker = off) AS
SELECT id, source_pick_id, rrp_price_cents, currency, price_unit, price_prefix
FROM public.trade_products
WHERE is_active AND public_rrp_visible AND coalesce(rrp_price_cents,0) > 0;

GRANT SELECT ON public.trade_products_public_rrp TO anon, authenticated;