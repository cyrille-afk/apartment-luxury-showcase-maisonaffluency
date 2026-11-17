CREATE TABLE public.catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  designer text,
  category_role text NOT NULL,
  room_type text[] NOT NULL,
  width_m numeric(6,3) NOT NULL,
  depth_m numeric(6,3) NOT NULL,
  height_m numeric(6,3) NOT NULL,
  glb_url_compressed text NOT NULL,
  glb_url_proxy text,
  base_price_sgd numeric(10,2) NOT NULL,
  base_lead_time_weeks integer NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_items TO authenticated;
GRANT ALL ON public.catalog_items TO service_role;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved trade users and admins can view catalog items"
ON public.catalog_items
FOR SELECT
TO authenticated
USING (public.is_approved_trade_user(auth.uid()));
CREATE POLICY "Admins can manage catalog items"
ON public.catalog_items
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));