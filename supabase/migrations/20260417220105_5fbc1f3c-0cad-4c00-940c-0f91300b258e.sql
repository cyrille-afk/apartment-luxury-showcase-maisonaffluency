UPDATE public.designer_curator_picks
SET trade_price_cents = trade_price_cents * 100
WHERE trade_price_cents IS NOT NULL;