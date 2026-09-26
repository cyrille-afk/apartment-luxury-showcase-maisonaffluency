CREATE OR REPLACE FUNCTION public.public_micmac_gallery_pins()
RETURNS TABLE (id uuid, image_identifier text, x_percent numeric, y_percent numeric, product_name text, designer_name text, product_image_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT h.id, h.image_identifier, h.x_percent, h.y_percent, h.product_name, h.designer_name, h.product_image_url
  FROM public.gallery_hotspots h
  WHERE h.id IN ('77e534f4-c405-4708-b6b7-20726c50ae3a'::uuid, 'a0c6691b-3424-49b6-97b4-35b67a6b276c'::uuid)
    AND h.product_name = 'Bronze MicMac Chandelier'
    AND h.designer_id = '663b02b3-3c00-48ad-80f4-bb4d3e05836c'::uuid
    AND h.image_identifier IN ('A Masterful Suite', 'A Venitian Cocoon');
$$;
REVOKE ALL ON FUNCTION public.public_micmac_gallery_pins() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_micmac_gallery_pins() TO anon, authenticated, service_role;