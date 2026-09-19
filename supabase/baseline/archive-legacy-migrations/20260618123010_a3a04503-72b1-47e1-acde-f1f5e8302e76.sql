-- Add product_id link to sample requests
ALTER TABLE public.trade_sample_requests
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.trade_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trade_sample_requests_product_id
  ON public.trade_sample_requests(product_id);