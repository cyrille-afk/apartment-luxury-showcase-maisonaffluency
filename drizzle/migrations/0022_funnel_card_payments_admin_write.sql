GRANT SELECT, INSERT, UPDATE ON public.funnel_card_payments TO authenticated;

CREATE POLICY "Admins can insert funnel card payments"
ON public.funnel_card_payments FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can update funnel card payments"
ON public.funnel_card_payments FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));