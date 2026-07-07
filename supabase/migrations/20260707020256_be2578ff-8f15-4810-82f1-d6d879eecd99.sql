-- Per-size/variant 3D models for trade products.
-- Each row is one uploaded GLB keyed by a variant label (matches size_variants[].label
-- on the source curator pick when applicable). One variant per product may be marked default.
CREATE TABLE public.trade_product_glb_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.trade_products(id) ON DELETE CASCADE,
  variant_label TEXT NOT NULL,
  glb_url TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  file_size_bytes BIGINT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, variant_label)
);

CREATE INDEX idx_tpglb_product ON public.trade_product_glb_variants(product_id);
CREATE UNIQUE INDEX uniq_tpglb_default_per_product
  ON public.trade_product_glb_variants(product_id)
  WHERE is_default = true;

GRANT SELECT ON public.trade_product_glb_variants TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.trade_product_glb_variants TO authenticated;
GRANT ALL ON public.trade_product_glb_variants TO service_role;

ALTER TABLE public.trade_product_glb_variants ENABLE ROW LEVEL SECURITY;

-- Public read: 3D models are shown on trade product pages (parity with glb_url exposure).
CREATE POLICY "Anyone can view GLB variants"
  ON public.trade_product_glb_variants
  FOR SELECT
  USING (true);

-- Only admins can manage.
CREATE POLICY "Admins can insert GLB variants"
  ON public.trade_product_glb_variants
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update GLB variants"
  ON public.trade_product_glb_variants
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete GLB variants"
  ON public.trade_product_glb_variants
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_tpglb_updated_at
  BEFORE UPDATE ON public.trade_product_glb_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill: migrate every existing trade_products.glb_url into the variants table as
-- a "Default" entry. The legacy glb_url column stays populated (denormalized mirror
-- of the default variant) so existing consumers keep working during rollout.
INSERT INTO public.trade_product_glb_variants (product_id, variant_label, glb_url, is_default)
SELECT id, 'Default', glb_url, true
FROM public.trade_products
WHERE glb_url IS NOT NULL AND glb_url <> ''
ON CONFLICT (product_id, variant_label) DO NOTHING;

-- Keep trade_products.glb_url in sync with whichever variant is flagged default,
-- so pages that still read glb_url continue to show a model.
CREATE OR REPLACE FUNCTION public.sync_trade_product_default_glb()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_product UUID;
  new_default TEXT;
BEGIN
  target_product := COALESCE(NEW.product_id, OLD.product_id);

  SELECT glb_url INTO new_default
  FROM public.trade_product_glb_variants
  WHERE product_id = target_product AND is_default = true
  LIMIT 1;

  IF new_default IS NULL THEN
    SELECT glb_url INTO new_default
    FROM public.trade_product_glb_variants
    WHERE product_id = target_product
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  UPDATE public.trade_products
  SET glb_url = new_default
  WHERE id = target_product;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_tpglb_sync_default
  AFTER INSERT OR UPDATE OR DELETE ON public.trade_product_glb_variants
  FOR EACH ROW EXECUTE FUNCTION public.sync_trade_product_default_glb();