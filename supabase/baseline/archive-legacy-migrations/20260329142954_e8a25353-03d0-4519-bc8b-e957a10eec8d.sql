-- 1. Drop the overly broad anon and authenticated SELECT policies on designer_curator_picks
DROP POLICY IF EXISTS "Anon can view published designer picks" ON public.designer_curator_picks;
DROP POLICY IF EXISTS "Authenticated can view published designer picks" ON public.designer_curator_picks;

-- 2. Add admin SELECT policy for client_board_items
CREATE POLICY "Admins can view all board items"
ON public.client_board_items
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));