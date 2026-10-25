ALTER TABLE public.trade_documents ADD COLUMN IF NOT EXISTS legacy_public_url text;
COMMENT ON COLUMN public.trade_documents.legacy_public_url IS 'Former public link of a price list that could not be deleted automatically (e.g. external host); cleared once confirmed removed.';

CREATE OR REPLACE FUNCTION public.admin_price_list_audit()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, storage
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'records', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', d.id, 'title', d.title, 'brand_name', d.brand_name,
        'file_url', d.file_url, 'storage_path', d.storage_path,
        'legacy_public_url', d.legacy_public_url,
        'private_file_exists', d.storage_path IS NOT NULL AND EXISTS (
          SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'price-lists' AND o.name = d.storage_path),
        'cover_image_url', d.cover_image_url
      ) ORDER BY d.brand_name, d.title)
      FROM public.trade_documents d WHERE d.document_type = 'pricelist'), '[]'::jsonb),
    'public_files', COALESCE((SELECT jsonb_agg(jsonb_build_object('bucket', o.bucket_id, 'name', o.name, 'size', (o.metadata->>'size')::bigint) ORDER BY o.name)
      FROM storage.objects o JOIN storage.buckets b ON b.id = o.bucket_id
      WHERE b.public AND o.name ~* '(price[ _-]?list|pricelist|tarif|prix|preisliste|listino)'
        AND lower(o.name) !~ '\.(jpe?g|png|webp|avif)$'), '[]'::jsonb),
    'private_bucket_public', COALESCE((SELECT b.public FROM storage.buckets b WHERE b.id = 'price-lists'), true),
    'checked_at', now()
  ) INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_price_list_audit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_price_list_audit() TO authenticated;