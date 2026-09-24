ALTER TABLE public.guest_inquiries
  ADD COLUMN contact_email text CHECK (contact_email IS NULL OR (char_length(contact_email) <= 254 AND contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  ADD COLUMN contact_whatsapp text CHECK (contact_whatsapp IS NULL OR contact_whatsapp ~ '^\+?[0-9 ()-]{6,24}$'),
  ADD COLUMN contact_captured_at timestamptz;

-- Guests can't read the table; this reveals only whether their own (secret, browser-held) guest_key was flagged serious.
CREATE OR REPLACE FUNCTION public.guest_inquiry_is_serious(_guest_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guest_inquiries
    WHERE guest_key = _guest_key AND status = 'bridged'
      AND created_at > now() - interval '24 hours')
$$;

CREATE OR REPLACE FUNCTION public.guest_inquiry_add_contact(_guest_key text, _email text, _whatsapp text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e text := nullif(lower(trim(_email)), '');
  w text := nullif(trim(_whatsapp), '');
  n int;
BEGIN
  IF _guest_key IS NULL OR _guest_key !~ '^[0-9a-f-]{36}$' THEN RETURN false; END IF;
  IF e IS NULL AND w IS NULL THEN RETURN false; END IF;
  IF e IS NOT NULL AND (char_length(e) > 254 OR e !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN RETURN false; END IF;
  IF w IS NOT NULL AND w !~ '^\+?[0-9 ()-]{6,24}$' THEN RETURN false; END IF;

  UPDATE public.guest_inquiries
     SET contact_email = coalesce(e, contact_email),
         contact_whatsapp = coalesce(w, contact_whatsapp),
         contact_captured_at = now()
   WHERE guest_key = _guest_key AND created_at > now() - interval '24 hours';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RETURN false; END IF;

  UPDATE public.cn_director_briefs b
     SET contact_email = coalesce(e, b.contact_email),
         contact_phone = coalesce(w, b.contact_phone),
         updated_at = now()
   WHERE b.id IN (SELECT bridged_brief_id FROM public.guest_inquiries
                  WHERE guest_key = _guest_key AND bridged_brief_id IS NOT NULL);
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.guest_inquiry_is_serious(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guest_inquiry_add_contact(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guest_inquiry_is_serious(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_inquiry_add_contact(text, text, text) TO anon, authenticated;