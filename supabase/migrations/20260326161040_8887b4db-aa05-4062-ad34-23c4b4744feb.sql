
-- auction_benchmarks: add explicit SELECT for trade_users (they may need benchmark data)
-- and ensure non-trade/non-admin get nothing (RLS default-deny handles this)
CREATE POLICY "Trade users can view auction benchmarks"
  ON public.auction_benchmarks
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'trade_user'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- designer_curator_picks_public view: grant anon SELECT so public profiles work
-- The view already excludes trade_price_cents, so this is safe
GRANT SELECT ON public.designer_curator_picks_public TO anon, authenticated;
