-- =====================================================
-- 1. CLIENT PORTAL WHITE-LABELING
-- =====================================================
ALTER TABLE public.client_boards
  ADD COLUMN IF NOT EXISTS studio_logo_url text,
  ADD COLUMN IF NOT EXISTS studio_name text,
  ADD COLUMN IF NOT EXISTS hide_maison_branding boolean NOT NULL DEFAULT false;

-- Update the token-based public lookup so the client portal sees the new fields.
CREATE OR REPLACE FUNCTION public.get_board_by_token(_token text)
RETURNS SETOF public.client_boards
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT * FROM public.client_boards
  WHERE share_token = _token
    AND status != 'draft'
    AND (token_expires_at IS NULL OR token_expires_at > now())
  LIMIT 1;
$function$;

-- =====================================================
-- 2. CAD / 3D ASSETS (per product, per optional variant)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.trade_product_cad_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL,
  variant_label text,
  file_url text NOT NULL,
  file_format text NOT NULL,
  file_size_bytes bigint,
  version text,
  uploaded_by uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trade_product_cad_assets_format_chk
    CHECK (file_format IN ('dwg','dxf','3ds','skp','rfa','obj','fbx','step','iges'))
);

CREATE INDEX IF NOT EXISTS idx_cad_assets_product
  ON public.trade_product_cad_assets(product_id);
CREATE INDEX IF NOT EXISTS idx_cad_assets_product_variant
  ON public.trade_product_cad_assets(product_id, variant_label);

ALTER TABLE public.trade_product_cad_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage CAD assets"
ON public.trade_product_cad_assets
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Trade users can view active CAD assets"
ON public.trade_product_cad_assets
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (public.has_role(auth.uid(), 'trade_user'::app_role)
       OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE TRIGGER trg_cad_assets_updated_at
BEFORE UPDATE ON public.trade_product_cad_assets
FOR EACH ROW
EXECUTE FUNCTION public.tms_set_updated_at();

-- =====================================================
-- 3. CAD download tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS public.cad_asset_downloads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  cad_asset_id uuid NOT NULL,
  product_id uuid NOT NULL,
  file_format text NOT NULL,
  country text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cad_downloads_user
  ON public.cad_asset_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_cad_downloads_asset
  ON public.cad_asset_downloads(cad_asset_id);

ALTER TABLE public.cad_asset_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all CAD downloads"
ON public.cad_asset_downloads
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own CAD downloads"
ON public.cad_asset_downloads
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own CAD downloads"
ON public.cad_asset_downloads
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (public.has_role(auth.uid(), 'trade_user'::app_role)
       OR public.has_role(auth.uid(), 'admin'::app_role))
);