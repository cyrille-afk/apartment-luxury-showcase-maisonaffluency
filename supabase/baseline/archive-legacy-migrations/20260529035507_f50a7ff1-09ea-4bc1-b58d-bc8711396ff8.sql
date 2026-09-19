-- Per-line shipping fields on trade_quote_items.
-- Lets each product carry its own origin country, shipping mode, packing volume
-- and weight so multi-origin quotes can compute a separate shipment per origin
-- and present an aggregated recap. All nullable: rows fall back to the product
-- catalogue origin and the panel-level defaults when unset.

ALTER TABLE public.trade_quote_items
  ADD COLUMN IF NOT EXISTS ship_origin_country text,
  ADD COLUMN IF NOT EXISTS ship_mode           text,
  ADD COLUMN IF NOT EXISTS ship_cbm            numeric(8,3),
  ADD COLUMN IF NOT EXISTS ship_weight_kg      numeric(10,2);

-- Sanity: shipping mode must be one of the estimator-supported values when set.
ALTER TABLE public.trade_quote_items
  DROP CONSTRAINT IF EXISTS trade_quote_items_ship_mode_check;
ALTER TABLE public.trade_quote_items
  ADD CONSTRAINT trade_quote_items_ship_mode_check
  CHECK (ship_mode IS NULL OR ship_mode IN ('sea_lcl','sea_fcl','air','road','courier'));

COMMENT ON COLUMN public.trade_quote_items.ship_origin_country IS
  'ISO-2 origin country for this line. Overrides trade_products.origin for shipping grouping.';
COMMENT ON COLUMN public.trade_quote_items.ship_mode IS
  'Shipping mode for this line (sea_lcl|sea_fcl|air|road|courier). NULL = auto.';
COMMENT ON COLUMN public.trade_quote_items.ship_cbm IS
  'Per-line packing volume in cubic metres.';
COMMENT ON COLUMN public.trade_quote_items.ship_weight_kg IS
  'Per-line gross weight in kilograms.';