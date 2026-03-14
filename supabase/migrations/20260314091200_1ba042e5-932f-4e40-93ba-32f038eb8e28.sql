-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.trade_products;

-- Create a tighter SELECT policy matching the trade_documents pattern
CREATE POLICY "Trade users and admins can view products"
ON public.trade_products
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'trade_user'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);