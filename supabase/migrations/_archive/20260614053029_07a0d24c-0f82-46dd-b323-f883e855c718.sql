REVOKE SELECT (contact_email, owner_user_id) ON public.featured_studios FROM authenticated;
REVOKE SELECT (contact_email, owner_user_id) ON public.featured_studios FROM anon;