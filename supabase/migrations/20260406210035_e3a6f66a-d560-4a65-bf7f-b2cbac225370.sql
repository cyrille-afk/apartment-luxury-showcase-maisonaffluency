ALTER TABLE public.designer_curator_picks ADD COLUMN IF NOT EXISTS lead_time text DEFAULT NULL;

DROP VIEW IF EXISTS public.designer_curator_picks_public;

CREATE VIEW public.designer_curator_picks_public AS
  SELECT category, created_at, currency, description, designer_id, dimensions,
         edition, hover_image_url, id, image_url, materials, pdf_filename,
         pdf_url, pdf_urls, photo_credit, sort_order, subcategory, subtitle,
         tags, title, lead_time
  FROM public.designer_curator_picks;