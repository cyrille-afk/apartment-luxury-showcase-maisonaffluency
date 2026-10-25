CREATE TABLE public.price_list_content_checks (
 target_key text PRIMARY KEY, revision text NOT NULL, kind text NOT NULL CHECK (kind IN ('public_file','cover')), verdict text NOT NULL CHECK(verdict IN ('prices_detected','possible_prices','no_prices_detected','unscanned')), evidence text NOT NULL, checked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.price_list_content_checks TO authenticated;
GRANT ALL ON public.price_list_content_checks TO service_role;
ALTER TABLE public.price_list_content_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin content checks" ON public.price_list_content_checks FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE OR REPLACE FUNCTION public.admin_price_list_content_inventory() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, storage AS $$
BEGIN
 IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN RAISE EXCEPTION 'Admins only' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
 'targets', COALESCE((SELECT jsonb_agg(t ORDER BY t->>'key') FROM (
 SELECT jsonb_build_object('key','public:'||o.bucket_id||'/'||o.name,'kind','public_file','bucket',o.bucket_id,'path',o.name,'url',null,'label',o.bucket_id||'/'||o.name,'revision',md5(o.updated_at::text||coalesce(o.metadata::text,''))) t FROM storage.objects o JOIN storage.buckets b ON b.id=o.bucket_id WHERE b.public
 UNION ALL
 SELECT jsonb_build_object('key','cover:'||d.id::text,'kind','cover','bucket',null,'path',null,'url',d.cover_image_url,'label',d.brand_name||' — '||d.title,'revision',md5(d.cover_image_url)) t FROM public.trade_documents d WHERE d.document_type='pricelist' AND nullif(d.cover_image_url,'') IS NOT NULL
 ) inventory),'[]'::jsonb),
 'checks',COALESCE((SELECT jsonb_agg(c) FROM public.price_list_content_checks c),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.admin_price_list_content_inventory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_price_list_content_inventory() TO authenticated;