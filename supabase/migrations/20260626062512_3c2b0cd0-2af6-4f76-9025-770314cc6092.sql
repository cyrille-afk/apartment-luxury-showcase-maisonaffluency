
-- Per-atelier editable fields (sparse override; missing row = use hardcoded defaults)
CREATE TABLE public.collectible_atelier_overrides (
  slug             text PRIMARY KEY,
  name             text,
  founder          text,
  specialty        text,
  hero_image_url   text,
  website_url      text,
  instagram_url    text,
  updated_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.collectible_atelier_overrides TO anon, authenticated;
GRANT ALL    ON public.collectible_atelier_overrides TO service_role;
ALTER TABLE public.collectible_atelier_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read atelier overrides"
  ON public.collectible_atelier_overrides FOR SELECT USING (true);
CREATE POLICY "Admins manage atelier overrides"
  ON public.collectible_atelier_overrides FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_collectible_atelier_overrides_updated_at
  BEFORE UPDATE ON public.collectible_atelier_overrides
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Ordered gallery images per atelier (admin-managed, sparse: missing = use hardcoded)
CREATE TABLE public.collectible_atelier_gallery (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL,
  image_url   text NOT NULL,
  caption     text,
  position    int  NOT NULL DEFAULT 0,
  updated_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX collectible_atelier_gallery_slug_idx
  ON public.collectible_atelier_gallery(slug, position);
GRANT SELECT ON public.collectible_atelier_gallery TO anon, authenticated;
GRANT ALL    ON public.collectible_atelier_gallery TO service_role;
ALTER TABLE public.collectible_atelier_gallery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read atelier gallery"
  ON public.collectible_atelier_gallery FOR SELECT USING (true);
CREATE POLICY "Admins manage atelier gallery"
  ON public.collectible_atelier_gallery FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_collectible_atelier_gallery_updated_at
  BEFORE UPDATE ON public.collectible_atelier_gallery
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
