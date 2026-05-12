
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Admins can read backups" ON storage.objects;
CREATE POLICY "Admins can read backups"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can write backups" ON storage.objects;
CREATE POLICY "Admins can write backups"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete backups" ON storage.objects;
CREATE POLICY "Admins can delete backups"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view suppressed emails" ON public.suppressed_emails;
CREATE POLICY "Admins can view suppressed emails"
  ON public.suppressed_emails FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

REVOKE SELECT ON public.designer_curator_picks FROM anon;
GRANT SELECT (
  id, designer_id, image_url, hover_image_url, title, subtitle, category, subcategory,
  tags, materials, dimensions, description, edition, photo_credit, pdf_url, pdf_filename,
  pdf_urls, sort_order, created_at, currency, lead_time, price_prefix, gallery_images,
  origin, size_variants, variant_placeholder, base_axis_label, top_axis_label,
  variant_image_map, is_hidden
) ON public.designer_curator_picks TO anon;

ALTER FUNCTION public.tg_set_updated_at() SET search_path = public;

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.handle_new_user()',
    'public.auto_assign_admin_role()',
    'public.auto_accept_studio_invites()',
    'public.notify_admins_new_registration()',
    'public.notify_admins_custom_request()',
    'public.sync_curator_pick_to_trade_product()',
    'public.log_sample_request_status_change()',
    'public.log_custom_request_activity()',
    'public.log_designers_change()',
    'public.log_curator_picks_change()',
    'public.log_trade_documents_change()',
    'public.tg_set_updated_at()',
    'public.tms_set_updated_at()',
    'public.update_updated_at_column()',
    'public.admin_onboarding_stats()',
    'public.admin_reset_onboarding_for_user(uuid)',
    'public.get_admin_user_ids()',
    'public.get_brand_engagement_users(text, timestamptz)',
    'public.get_designer_engagement(timestamptz)',
    'public.recompute_trade_tier_suggestions()',
    'public.notify_admins_production_render(text, text, text)',
    'public.enqueue_email(text, jsonb)',
    'public.delete_email(text, bigint)',
    'public.read_email_batch(text, integer, integer)',
    'public.move_to_dlq(text, text, bigint, jsonb)'
  ]
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, public', fn);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skip %: %', fn, SQLERRM;
    END;
  END LOOP;
END $$;
