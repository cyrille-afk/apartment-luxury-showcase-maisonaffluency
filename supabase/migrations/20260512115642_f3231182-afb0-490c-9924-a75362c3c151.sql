
-- 1) Hide featured_studios.contact_email from anonymous users via column-level GRANT
REVOKE SELECT ON public.featured_studios FROM anon;
GRANT SELECT (
  id, slug, name, tagline, bio, founded_year, team_size, location, country,
  website_url, instagram_handle, logo_url, hero_image_url, gallery_images,
  disciplines, project_types, notable_projects, is_featured, is_published,
  sort_order, created_at, updated_at, owner_user_id
) ON public.featured_studios TO anon;
GRANT SELECT ON public.featured_studios TO authenticated;

-- 2) Realtime: lock down realtime.messages so users can only subscribe to their own topic
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can subscribe to their own topic" ON realtime.messages;
CREATE POLICY "users can subscribe to their own topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() LIKE 'user:' || auth.uid()::text || '%')
  OR (realtime.topic() LIKE '%-' || auth.uid()::text)
);

DROP POLICY IF EXISTS "users can broadcast to their own topic" ON realtime.messages;
CREATE POLICY "users can broadcast to their own topic"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (realtime.topic() LIKE 'user:' || auth.uid()::text || '%')
  OR (realtime.topic() LIKE '%-' || auth.uid()::text)
);
