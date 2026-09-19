
-- ============================================================================
-- Security fixes from the supabase_lov scan
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. featured_studios — hide contact_email + owner_user_id from anon
-- ----------------------------------------------------------------------------
-- RLS still controls *which rows* anon can see (only is_published = true);
-- column-level GRANTs control *which columns* anon can read on those rows.
-- Authenticated users keep full column access.
REVOKE SELECT ON public.featured_studios FROM anon;
GRANT SELECT (
  id, slug, name, tagline, bio,
  founded_year, team_size, location, country,
  website_url, instagram_handle,
  logo_url, hero_image_url, gallery_images,
  disciplines, project_types, notable_projects,
  is_featured, is_published, sort_order,
  created_at, updated_at
) ON public.featured_studios TO anon;
-- contact_email and owner_user_id intentionally NOT granted to anon.

-- ----------------------------------------------------------------------------
-- 2. axonometric_gallery — add trade_user / admin guard to UPDATE + DELETE
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own gallery drafts" ON public.axonometric_gallery;
CREATE POLICY "Users can update own gallery drafts"
  ON public.axonometric_gallery
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND is_published = false
    AND (
      public.has_role(auth.uid(), 'trade_user'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND is_published = false
    AND (
      public.has_role(auth.uid(), 'trade_user'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

DROP POLICY IF EXISTS "Users can delete own gallery drafts" ON public.axonometric_gallery;
CREATE POLICY "Users can delete own gallery drafts"
  ON public.axonometric_gallery
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND is_published = false
    AND (
      public.has_role(auth.uid(), 'trade_user'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- ----------------------------------------------------------------------------
-- 3. studio_invites — restrict SELECT to studio admins (raw token + email are
--    sensitive; viewer-role members should not see them).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view invites" ON public.studio_invites;
CREATE POLICY "Studio admins can view invites"
  ON public.studio_invites
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_studio_role(auth.uid(), studio_id, 'admin'::studio_role)
  );
