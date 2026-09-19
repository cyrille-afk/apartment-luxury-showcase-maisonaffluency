
-- ============================================================
-- profiles: column-level GRANT to exclude `phone` from anon/auth
-- ============================================================
REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (
  id, email, first_name, last_name, company,
  created_at, avatar_url, trade_tier, trade_tier_suggested,
  trade_tier_locked_by_admin, trade_tier_12mo_spend_cents,
  trade_tier_computed_at, country, concierge_name, has_seen_trade_intro
) ON public.profiles TO authenticated;

-- anon does not need profile reads at all
-- (existing RLS already gates this; keep anon with no SELECT grants)

-- Self-service phone read via SECURITY DEFINER RPC
CREATE OR REPLACE FUNCTION public.get_my_phone()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT phone FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_phone() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_phone() TO authenticated;

-- ============================================================
-- concierge_rag_traces: explicit service_role INSERT policy
-- (service_role bypasses RLS, but make the contract explicit)
-- ============================================================
DROP POLICY IF EXISTS "Service role can insert rag traces" ON public.concierge_rag_traces;
CREATE POLICY "Service role can insert rag traces"
ON public.concierge_rag_traces
FOR INSERT
TO service_role
WITH CHECK (true);

GRANT INSERT ON public.concierge_rag_traces TO service_role;
