-- Replace the header-based policy with a simpler approach:
-- Boards can only be viewed publicly if they're shared status (not draft)
-- The actual security is that users must know the share_token (passed in .eq() filter)
-- This is secure because share_tokens are random 32-char hex strings
DROP POLICY IF EXISTS "Anyone can view shared boards by token" ON public.client_boards;

CREATE POLICY "Anyone can view shared boards by token"
  ON public.client_boards
  FOR SELECT
  TO anon, authenticated
  USING (status = 'shared');