CREATE OR REPLACE FUNCTION public.moodboard_capture_lead(_email text, _reference text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(_email, '')));
BEGIN
  IF length(v_email) > 254 OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' THEN
    RAISE EXCEPTION 'invalid email';
  END IF;
  -- Throttle: max 20 moodboard captures per minute site-wide
  IF (SELECT count(*) FROM public.acquisition_leads
      WHERE discovery_node = 'moodboard_generator' AND created_at > now() - interval '1 minute') >= 20 THEN
    RAISE EXCEPTION 'rate limited';
  END IF;
  INSERT INTO public.acquisition_leads (studio_name, business_email, source_index, campaign_status, discovery_node, website_url)
  VALUES (split_part(v_email, '@', 2), v_email, 'Moodboard_Generator', 'pending_verification', 'moodboard_generator', left(_reference, 500))
  ON CONFLICT (business_email) DO NOTHING;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.moodboard_capture_lead(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.moodboard_capture_lead(text, text) TO anon, authenticated;