CREATE OR REPLACE VIEW public.designer_curator_picks_public AS
SELECT category, created_at, currency, description, designer_id, dimensions, edition, hover_image_url, id, image_url, materials, pdf_filename, pdf_url, pdf_urls, photo_credit, sort_order, subcategory, subtitle, tags, title
FROM designer_curator_picks;