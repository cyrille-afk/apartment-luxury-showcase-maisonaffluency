-- Drop existing permissive policies
DROP POLICY IF EXISTS "Users can manage own quotes" ON public.trade_quotes;
DROP POLICY IF EXISTS "Users can manage own quote items" ON public.trade_quote_items;

-- trade_quotes: require trade_user or admin role + ownership
CREATE POLICY "Trade users can manage own quotes"
ON public.trade_quotes
FOR ALL
TO authenticated
USING (
  user_id = auth.uid()
  AND (
    has_role(auth.uid(), 'trade_user'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND (
    has_role(auth.uid(), 'trade_user'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- trade_quote_items: require trade_user or admin role + quote ownership
CREATE POLICY "Trade users can manage own quote items"
ON public.trade_quote_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trade_quotes
    WHERE id = trade_quote_items.quote_id
      AND user_id = auth.uid()
  )
  AND (
    has_role(auth.uid(), 'trade_user'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.trade_quotes
    WHERE id = trade_quote_items.quote_id
      AND user_id = auth.uid()
  )
  AND (
    has_role(auth.uid(), 'trade_user'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);