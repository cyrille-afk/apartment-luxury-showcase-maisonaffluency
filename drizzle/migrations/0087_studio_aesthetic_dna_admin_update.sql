GRANT SELECT, UPDATE ON public.studio_aesthetic_dna TO authenticated;
CREATE POLICY "Admins edit aesthetic dna" ON public.studio_aesthetic_dna
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));