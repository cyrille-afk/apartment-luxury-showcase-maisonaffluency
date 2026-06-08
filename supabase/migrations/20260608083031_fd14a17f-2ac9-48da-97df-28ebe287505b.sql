CREATE POLICY "Owners can view own presentations" ON public.presentations FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Owners can insert own presentations" ON public.presentations FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners can update own presentations" ON public.presentations FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owners can delete own presentations" ON public.presentations FOR DELETE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Users can view own concierge usage" ON public.trade_concierge_usage FOR SELECT TO authenticated USING (user_id = auth.uid());