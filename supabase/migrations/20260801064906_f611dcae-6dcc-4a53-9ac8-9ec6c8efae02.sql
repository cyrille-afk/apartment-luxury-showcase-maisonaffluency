CREATE OR REPLACE VIEW public.trade_products_public_rrp
WITH (security_invoker = off) AS
SELECT t.id, t.source_pick_id, t.rrp_price_cents, t.currency, t.price_unit, t.price_prefix,
       p.size_variants AS rrp_size_variants
FROM public.trade_products t
LEFT JOIN public.designer_curator_picks p ON p.id = t.source_pick_id
WHERE t.is_active AND t.public_rrp_visible AND coalesce(t.rrp_price_cents,0) > 0;

GRANT SELECT ON public.trade_products_public_rrp TO anon, authenticated;