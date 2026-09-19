-- Helper: does the user own the quote?
CREATE OR REPLACE FUNCTION public.owns_trade_quote(_user_id uuid, _quote_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trade_quotes q
    WHERE q.id = _quote_id AND q.user_id = _user_id
  )
$$;

-- Helper: does the user own the client board?
CREATE OR REPLACE FUNCTION public.owns_client_board(_user_id uuid, _board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_boards b
    WHERE b.id = _board_id AND b.user_id = _user_id
  )
$$;

-- Helper: can the user view a client board (admin / project / studio / owner)?
CREATE OR REPLACE FUNCTION public.can_view_client_board(_user_id uuid, _board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_boards b
    WHERE b.id = _board_id
      AND (
        public.has_role(_user_id, 'admin'::app_role)
        OR (b.project_id IS NOT NULL AND public.can_edit_project(_user_id, b.project_id))
        OR (b.project_id IS NULL AND b.studio_id IS NOT NULL AND public.has_studio_role(_user_id, b.studio_id, 'editor'::studio_role))
        OR (b.project_id IS NULL AND b.studio_id IS NULL AND b.user_id = _user_id)
      )
  )
$$;

-- Helper: does the user hold a valid pending studio invite for this studio/role?
CREATE OR REPLACE FUNCTION public.has_valid_studio_invite(_user_id uuid, _studio_id uuid, _role studio_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.studio_invites si
    JOIN auth.users u ON u.id = _user_id
    WHERE si.studio_id = _studio_id
      AND si.role = _role
      AND si.accepted_at IS NULL
      AND si.expires_at > now()
      AND lower(si.email) = lower(u.email::text)
  )
$$;

GRANT EXECUTE ON FUNCTION public.owns_trade_quote(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_client_board(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_client_board(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_valid_studio_invite(uuid, uuid, studio_role) TO authenticated, service_role;

-- trade_quote_items
DROP POLICY IF EXISTS "Trade users can manage own quote items" ON public.trade_quote_items;
CREATE POLICY "Trade users can manage own quote items"
ON public.trade_quote_items
FOR ALL
TO authenticated
USING (
  public.owns_trade_quote(auth.uid(), quote_id)
  AND (public.has_role(auth.uid(), 'trade_user'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  public.owns_trade_quote(auth.uid(), quote_id)
  AND (public.has_role(auth.uid(), 'trade_user'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
);

-- trade_quote_extras
DROP POLICY IF EXISTS "Quote owner manages extras" ON public.trade_quote_extras;
CREATE POLICY "Quote owner manages extras"
ON public.trade_quote_extras
FOR ALL
TO authenticated
USING (public.owns_trade_quote(auth.uid(), quote_id))
WITH CHECK (public.owns_trade_quote(auth.uid(), quote_id));

-- client_board_items
DROP POLICY IF EXISTS "Board owners can manage items" ON public.client_board_items;
CREATE POLICY "Board owners can manage items"
ON public.client_board_items
FOR ALL
TO authenticated
USING (public.owns_client_board(auth.uid(), board_id))
WITH CHECK (public.owns_client_board(auth.uid(), board_id));

DROP POLICY IF EXISTS "View board items (studio + project access)" ON public.client_board_items;
CREATE POLICY "View board items (studio + project access)"
ON public.client_board_items
FOR SELECT
TO authenticated
USING (public.can_view_client_board(auth.uid(), board_id));

-- client_board_comments
DROP POLICY IF EXISTS "Board owners can manage comments" ON public.client_board_comments;
CREATE POLICY "Board owners can manage comments"
ON public.client_board_comments
FOR ALL
TO authenticated
USING (public.owns_client_board(auth.uid(), board_id))
WITH CHECK (public.owns_client_board(auth.uid(), board_id));

-- studio_members
DROP POLICY IF EXISTS "Invitees can join studios via valid invite" ON public.studio_members;
CREATE POLICY "Invitees can join studios via valid invite"
ON public.studio_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.has_valid_studio_invite(auth.uid(), studio_id, role)
);

-- Supporting indexes for the helper lookups
CREATE INDEX IF NOT EXISTS idx_trade_quotes_id_user ON public.trade_quotes (id, user_id);
CREATE INDEX IF NOT EXISTS idx_client_boards_id_user ON public.client_boards (id, user_id);
CREATE INDEX IF NOT EXISTS idx_studio_invites_studio_email ON public.studio_invites (studio_id, lower(email));
