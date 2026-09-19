CREATE OR REPLACE VIEW public.designer_curator_picks_public AS
SELECT category, created_at, currency, description, designer_id, dimensions, edition,
       hover_image_url, id, image_url, lead_time, origin, materials, pdf_filename,
       pdf_url, pdf_urls, photo_credit, sort_order, subcategory, subtitle, tags, title,
       gallery_images, size_variants
FROM public.designer_curator_picks;