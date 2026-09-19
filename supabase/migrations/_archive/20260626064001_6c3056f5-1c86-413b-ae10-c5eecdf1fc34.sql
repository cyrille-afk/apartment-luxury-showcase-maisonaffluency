
-- 1) ai_semantic_cache: lock SELECT to admins only
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.ai_semantic_cache FROM anon, authenticated;
GRANT SELECT ON public.ai_semantic_cache TO authenticated;
GRANT ALL ON public.ai_semantic_cache TO service_role;

DROP POLICY IF EXISTS "ai_semantic_cache_admin_read" ON public.ai_semantic_cache;
CREATE POLICY "ai_semantic_cache_admin_read"
  ON public.ai_semantic_cache FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) client_board_items: add studio/project member SELECT mirroring client_boards visibility
DROP POLICY IF EXISTS "View board items (studio + project access)" ON public.client_board_items;
CREATE POLICY "View board items (studio + project access)"
  ON public.client_board_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_boards b
      WHERE b.id = client_board_items.board_id
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR (b.project_id IS NOT NULL AND public.can_edit_project(auth.uid(), b.project_id))
          OR (b.project_id IS NULL AND b.studio_id IS NOT NULL AND public.has_studio_role(auth.uid(), b.studio_id, 'editor'::studio_role))
          OR (b.project_id IS NULL AND b.studio_id IS NULL AND b.user_id = auth.uid())
        )
    )
  );

-- 3) studio_invites: re-affirm token column is unreadable by anyone but service_role
REVOKE SELECT (token) ON public.studio_invites FROM PUBLIC;
REVOKE SELECT (token) ON public.studio_invites FROM anon;
REVOKE SELECT (token) ON public.studio_invites FROM authenticated;

-- 4) studio_payout_accounts: revoke raw banking columns from clients; expose via masked RPC
REVOKE SELECT (iban, ach_account_number, ach_routing_number, swift_bic)
  ON public.studio_payout_accounts FROM PUBLIC;
REVOKE SELECT (iban, ach_account_number, ach_routing_number, swift_bic)
  ON public.studio_payout_accounts FROM anon;
REVOKE SELECT (iban, ach_account_number, ach_routing_number, swift_bic)
  ON public.studio_payout_accounts FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_studio_payout_accounts(_studio_id uuid)
RETURNS TABLE(
  id uuid,
  studio_id uuid,
  label text,
  account_holder_name text,
  country_code text,
  currency text,
  is_default boolean,
  iban text,
  ach_routing_number text,
  ach_account_number text,
  swift_bic text,
  bank_name text,
  stripe_connect_account_id text,
  stripe_connect_status text,
  tax_form_kind text,
  tax_form_reference text,
  tax_form_document_path text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_studio_role(auth.uid(), _studio_id, 'admin'::studio_role)
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.studio_id, p.label, p.account_holder_name, p.country_code, p.currency, p.is_default,
    CASE WHEN p.iban IS NULL OR length(p.iban) < 4 THEN p.iban
         ELSE '••••' || right(p.iban, 4) END AS iban,
    CASE WHEN p.ach_routing_number IS NULL OR length(p.ach_routing_number) < 4 THEN p.ach_routing_number
         ELSE '••••' || right(p.ach_routing_number, 4) END AS ach_routing_number,
    CASE WHEN p.ach_account_number IS NULL OR length(p.ach_account_number) < 4 THEN p.ach_account_number
         ELSE '••••' || right(p.ach_account_number, 4) END AS ach_account_number,
    CASE WHEN p.swift_bic IS NULL OR length(p.swift_bic) < 3 THEN p.swift_bic
         ELSE '••••' || right(p.swift_bic, 3) END AS swift_bic,
    p.bank_name, p.stripe_connect_account_id, p.stripe_connect_status,
    p.tax_form_kind, p.tax_form_reference, p.tax_form_document_path,
    p.created_at, p.updated_at
  FROM public.studio_payout_accounts p
  WHERE p.studio_id = _studio_id
  ORDER BY p.is_default DESC, p.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.get_studio_payout_accounts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_studio_payout_accounts(uuid) TO authenticated, service_role;
