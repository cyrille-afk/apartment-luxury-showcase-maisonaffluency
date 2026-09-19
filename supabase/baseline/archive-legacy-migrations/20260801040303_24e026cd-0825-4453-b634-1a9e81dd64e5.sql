-- Column-scoped enforcement at the RLS layer (not just triggers), so no
-- self-service path can ever grant a premium tier or trade approval.
CREATE OR REPLACE FUNCTION public.profile_privileged_fields_unchanged(
  _id uuid,
  _trade_tier public.trade_tier,
  _trade_tier_suggested public.trade_tier,
  _trade_tier_locked_by_admin boolean,
  _trade_tier_12mo_spend_cents bigint,
  _trade_tier_computed_at timestamptz,
  _trade_status text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _id
      AND p.trade_tier IS NOT DISTINCT FROM _trade_tier
      AND p.trade_tier_suggested IS NOT DISTINCT FROM _trade_tier_suggested
      AND p.trade_tier_locked_by_admin IS NOT DISTINCT FROM _trade_tier_locked_by_admin
      AND p.trade_tier_12mo_spend_cents IS NOT DISTINCT FROM _trade_tier_12mo_spend_cents
      AND p.trade_tier_computed_at IS NOT DISTINCT FROM _trade_tier_computed_at
      AND p.trade_status IS NOT DISTINCT FROM _trade_status
  );
$$;

REVOKE ALL ON FUNCTION public.profile_privileged_fields_unchanged(uuid, public.trade_tier, public.trade_tier, boolean, bigint, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_privileged_fields_unchanged(uuid, public.trade_tier, public.trade_tier, boolean, bigint, timestamptz, text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile (non-privileged columns only)"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND public.profile_privileged_fields_unchanged(
        id,
        trade_tier,
        trade_tier_suggested,
        trade_tier_locked_by_admin,
        trade_tier_12mo_spend_cents,
        trade_tier_computed_at,
        trade_status
      )
);

-- Self-insert may only create a clean, unprivileged profile row.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id
  AND trade_tier IS NULL
  AND trade_tier_suggested IS NULL
  AND COALESCE(trade_tier_locked_by_admin, false) = false
  AND trade_tier_12mo_spend_cents IS NULL
  AND trade_tier_computed_at IS NULL
  AND COALESCE(trade_status, 'pending_review') = 'pending_review'
);