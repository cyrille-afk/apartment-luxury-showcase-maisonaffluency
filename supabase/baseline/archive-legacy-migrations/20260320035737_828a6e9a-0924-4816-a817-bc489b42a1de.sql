
CREATE POLICY "Admins can delete quotes"
ON public.trade_quotes
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete quote items"
ON public.trade_quote_items
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
