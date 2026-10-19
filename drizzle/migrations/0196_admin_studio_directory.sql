CREATE OR REPLACE FUNCTION public.admin_studio_directory(_search text DEFAULT '', _offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  WITH directory AS (
    SELECT s.id, s.name, s.display_name, s.slug, s.billing_email, s.created_at,
      COALESCE(NULLIF(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email, 'Unknown') AS owner_name,
      p.email AS owner_email,
      (SELECT count(*) FROM public.studio_members m WHERE m.studio_id = s.id) AS member_count
    FROM public.studios s
    LEFT JOIN public.profiles p ON p.id = COALESCE(
      (SELECT m.user_id FROM public.studio_members m WHERE m.studio_id = s.id AND m.role = 'owner' ORDER BY m.joined_at, m.id LIMIT 1), s.created_by)
  ), filtered AS (
    SELECT d.* FROM directory d WHERE NOT EXISTS (
      SELECT 1 FROM regexp_split_to_table(lower(trim(COALESCE(_search, ''))), '\s+') term
      WHERE term <> '' AND strpos(lower(concat_ws(' ', d.name, d.display_name, d.slug, d.billing_email, d.owner_name, d.owner_email)), term) = 0
    )
  ), page AS (
    SELECT * FROM filtered ORDER BY created_at DESC, id LIMIT 50 OFFSET greatest(COALESCE(_offset, 0), 0)
  )
  SELECT jsonb_build_object('studios', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC, p.id) FROM page p), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered), 'total_studios', (SELECT count(*) FROM directory)) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_studio_directory(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_studio_directory(text, integer) TO authenticated, service_role;