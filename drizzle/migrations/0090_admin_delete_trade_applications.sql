GRANT DELETE ON TABLE public.trade_accounts TO authenticated;
GRANT DELETE ON TABLE public.studio_aesthetic_dna TO authenticated;

CREATE POLICY "Admins delete trade accounts"
ON public.trade_accounts
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

CREATE POLICY "Admins delete aesthetic dna"
ON public.studio_aesthetic_dna
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);