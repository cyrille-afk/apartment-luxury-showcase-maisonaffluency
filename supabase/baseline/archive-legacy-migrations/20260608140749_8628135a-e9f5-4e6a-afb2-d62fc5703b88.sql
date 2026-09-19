
DROP POLICY IF EXISTS "Anon can view non-hidden curator picks" ON public.designer_curator_picks;
REVOKE SELECT ON public.designer_curator_picks FROM anon;

DROP FUNCTION IF EXISTS public.get_board_by_token(text);
DROP FUNCTION IF EXISTS public.get_board_items_by_token(text);
DROP FUNCTION IF EXISTS public.get_board_comments_by_token(text);

CREATE FUNCTION public.get_board_by_token(_token text)
RETURNS TABLE (
  id uuid,
  title text,
  client_name text,
  status text,
  studio_logo_url text,
  studio_name text,
  hide_maison_branding boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT b.id, b.title, b.client_name, b.status::text,
         b.studio_logo_url, b.studio_name, b.hide_maison_branding
  FROM public.client_boards b
  WHERE b.share_token = _token
    AND b.status != 'draft'
    AND (b.token_expires_at IS NULL OR b.token_expires_at > now())
  LIMIT 1;
$$;

CREATE FUNCTION public.get_board_items_by_token(_token text)
RETURNS TABLE (
  id uuid,
  board_id uuid,
  product_id uuid,
  sort_order integer,
  notes text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT bi.id, bi.board_id, bi.product_id, bi.sort_order, bi.notes, bi.created_at
  FROM public.client_board_items bi
  INNER JOIN public.client_boards b ON b.id = bi.board_id
  WHERE b.share_token = _token
    AND b.status != 'draft'
    AND (b.token_expires_at IS NULL OR b.token_expires_at > now())
  ORDER BY bi.sort_order;
$$;

CREATE FUNCTION public.get_board_comments_by_token(_token text)
RETURNS TABLE (
  id uuid,
  board_id uuid,
  item_id uuid,
  author_name text,
  is_client boolean,
  content text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT bc.id, bc.board_id, bc.item_id, bc.author_name, bc.is_client, bc.content, bc.created_at
  FROM public.client_board_comments bc
  INNER JOIN public.client_boards b ON b.id = bc.board_id
  WHERE b.share_token = _token
    AND b.status != 'draft'
    AND (b.token_expires_at IS NULL OR b.token_expires_at > now())
  ORDER BY bc.created_at;
$$;

GRANT EXECUTE ON FUNCTION public.get_board_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_board_items_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_board_comments_by_token(text) TO anon, authenticated;

CREATE POLICY "Owners can insert their presentation slides"
  ON public.presentation_slides FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.presentations p
    WHERE p.id = presentation_slides.presentation_id AND p.created_by = auth.uid()
  ));

CREATE POLICY "Owners can update their presentation slides"
  ON public.presentation_slides FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.presentations p
    WHERE p.id = presentation_slides.presentation_id AND p.created_by = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.presentations p
    WHERE p.id = presentation_slides.presentation_id AND p.created_by = auth.uid()
  ));

CREATE POLICY "Owners can delete their presentation slides"
  ON public.presentation_slides FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.presentations p
    WHERE p.id = presentation_slides.presentation_id AND p.created_by = auth.uid()
  ));

CREATE POLICY "Owners can insert comments on their presentations"
  ON public.presentation_comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.presentations p
      WHERE p.id = presentation_comments.presentation_id AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Studio members can read cad-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Studio members can upload cad-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Studio members can delete cad-uploads" ON storage.objects;

CREATE POLICY "Studio members can read cad-uploads"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'cad-uploads'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR EXISTS (
        SELECT 1 FROM public.studios s
        WHERE (s.id)::text = (storage.foldername(name))[1]
          AND public.can_view_studio(auth.uid(), s.id)
      )
    )
  );

CREATE POLICY "Studio members can upload cad-uploads"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cad-uploads'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR EXISTS (
        SELECT 1 FROM public.studios s
        WHERE (s.id)::text = (storage.foldername(name))[1]
          AND public.can_view_studio(auth.uid(), s.id)
      )
    )
  );

CREATE POLICY "Studio members can delete cad-uploads"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'cad-uploads'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR EXISTS (
        SELECT 1 FROM public.studios s
        WHERE (s.id)::text = (storage.foldername(name))[1]
          AND public.can_view_studio(auth.uid(), s.id)
      )
    )
  );
