-- Masked view of client_contacts: full PII for editors, masked email/phone for viewers.
-- Underlying table SELECT policy stays editor-only; the view runs as definer
-- and applies its own access check via can_view_studio.

CREATE OR REPLACE VIEW public.client_contacts_safe
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  cc.id,
  cc.client_id,
  cc.first_name,
  cc.last_name,
  cc.role_title,
  CASE
    WHEN public.can_edit_studio(auth.uid(), c.studio_id) THEN cc.email
    WHEN cc.email IS NULL OR cc.email = '' THEN cc.email
    ELSE regexp_replace(cc.email, '(^.).*(@.*$)', '\1•••\2')
  END AS email,
  CASE
    WHEN public.can_edit_studio(auth.uid(), c.studio_id) THEN cc.phone
    WHEN cc.phone IS NULL OR cc.phone = '' THEN cc.phone
    ELSE regexp_replace(cc.phone, '.(?=.{2})', '•', 'g')
  END AS phone,
  cc.is_primary,
  CASE
    WHEN public.can_edit_studio(auth.uid(), c.studio_id) THEN cc.notes
    ELSE NULL
  END AS notes,
  cc.created_at,
  cc.updated_at,
  public.can_edit_studio(auth.uid(), c.studio_id) AS can_edit
FROM public.client_contacts cc
JOIN public.clients c ON c.id = cc.client_id
WHERE public.can_view_studio(auth.uid(), c.studio_id);

REVOKE ALL ON public.client_contacts_safe FROM PUBLIC, anon;
GRANT SELECT ON public.client_contacts_safe TO authenticated;