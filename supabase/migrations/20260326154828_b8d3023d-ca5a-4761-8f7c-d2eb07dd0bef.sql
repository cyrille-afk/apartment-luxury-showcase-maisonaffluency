-- Fix 1: Remove anonymous access to trade_products (exposes trade pricing)
DROP POLICY IF EXISTS "Anyone can view active products" ON public.trade_products;

-- Fix 2: Replace overly permissive client_boards policy with share_token check
DROP POLICY IF EXISTS "Anyone can view shared boards by token" ON public.client_boards;

CREATE POLICY "Anyone can view shared boards by token"
  ON public.client_boards
  FOR SELECT
  TO anon, authenticated
  USING (
    status <> 'draft'
    AND share_token = current_setting('request.headers', true)::json->>'x-share-token'
  );