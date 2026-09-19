
-- Add trade_user/admin role check to INSERT policies that previously only verified ownership

DROP POLICY IF EXISTS "Create boards (editor+ in studio)" ON public.client_boards;
CREATE POLICY "Create boards (editor+ in studio)" ON public.client_boards
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = user_id)
    AND ((studio_id IS NULL) OR has_studio_role(auth.uid(), studio_id, 'editor'::studio_role))
    AND (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

DROP POLICY IF EXISTS "Create timelines (editor+ in studio)" ON public.order_timeline;
CREATE POLICY "Create timelines (editor+ in studio)" ON public.order_timeline
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = user_id)
    AND ((studio_id IS NULL) OR has_studio_role(auth.uid(), studio_id, 'editor'::studio_role))
    AND (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

DROP POLICY IF EXISTS "Create projects in own studio" ON public.projects;
CREATE POLICY "Create projects in own studio" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = user_id)
    AND ((studio_id IS NULL) OR has_studio_role(auth.uid(), studio_id, 'editor'::studio_role))
    AND (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

DROP POLICY IF EXISTS "Create custom requests (editor+ in studio)" ON public.trade_custom_requests;
CREATE POLICY "Create custom requests (editor+ in studio)" ON public.trade_custom_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = user_id)
    AND ((studio_id IS NULL) OR has_studio_role(auth.uid(), studio_id, 'editor'::studio_role))
    AND (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

DROP POLICY IF EXISTS "Users create their own custom requests" ON public.trade_custom_requests;
CREATE POLICY "Users create their own custom requests" ON public.trade_custom_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = user_id)
    AND (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

DROP POLICY IF EXISTS "Create quotes (editor+ in studio)" ON public.trade_quotes;
CREATE POLICY "Create quotes (editor+ in studio)" ON public.trade_quotes
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = user_id)
    AND ((studio_id IS NULL) OR has_studio_role(auth.uid(), studio_id, 'editor'::studio_role))
    AND (has_role(auth.uid(), 'trade_user'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );
