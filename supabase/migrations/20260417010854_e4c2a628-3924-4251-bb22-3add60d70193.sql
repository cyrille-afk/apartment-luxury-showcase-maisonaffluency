CREATE OR REPLACE VIEW public.designer_curator_picks_public
WITH (security_invoker=true) AS
SELECT category, created_at, currency, description, designer_id, dimensions,
       edition, hover_image_url, id, image_url, lead_time, materials,
       pdf_filename, pdf_url, pdf_urls, photo_credit, sort_order,
       subcategory, subtitle, tags, title, gallery_images
FROM public.designer_curator_picks;