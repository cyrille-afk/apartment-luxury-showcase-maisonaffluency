-- Add a human-friendly Trade ID to profiles and a secure resolver so the
-- trade sign-in field can accept "Trade ID or Email Address" as labelled.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trade_id text;

-- Backfill existing trade members with a stable MA-XXXXXX id derived from their uuid.
UPDATE public.profiles
SET trade_id = 'MA-' || upper(substr(replace(id::text, '-', ''), 1, 6))
WHERE trade_id IS NULL;

-- Default for future rows.
CREATE OR REPLACE FUNCTION public.assign_trade_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.trade_id IS NULL THEN
    NEW.trade_id := 'MA-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 6));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_assign_trade_id ON public.profiles;
CREATE TRIGGER profiles_assign_trade_id
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.assign_trade_id();

CREATE UNIQUE INDEX IF NOT EXISTS profiles_trade_id_key ON public.profiles (trade_id);

-- Resolve a Trade ID (or email) to the account email. Security definer so
-- unauthenticated sign-in attempts can resolve without exposing profiles.
-- Returns NULL for unknown identifiers; only approved trade members resolve
-- via Trade ID so the id cannot be used to enumerate public accounts.
CREATE OR REPLACE FUNCTION public.resolve_trade_email(p_identifier text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.email
  FROM public.profiles p
  WHERE p.trade_status = 'approved'
    AND (
      upper(p.trade_id) = upper(trim(p_identifier))
      OR lower(p.email) = lower(trim(p_identifier))
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_trade_email(text) TO anon, authenticated;