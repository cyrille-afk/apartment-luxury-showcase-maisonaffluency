-- Jeremy Maxwell Wintrebert is trade-only; only Cloud Filigrane (shown in Our Gallery) stays public.
CREATE POLICY "Public approved gallery piece from trade-only designer"
ON public.designer_curator_picks_public FOR SELECT TO public
USING (
  id = '4b46af75-4c35-4a81-bea6-822810ae3422'::uuid
  AND designer_id = '1124b721-37e8-4a94-9adc-5b055fe892e0'::uuid
  AND is_hidden IS NOT TRUE
);