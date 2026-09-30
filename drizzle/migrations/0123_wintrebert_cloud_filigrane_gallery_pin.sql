-- Approved exception: the Cloud Filigrane pin in "A Dreamy Tuscan Landscape" stays public although Wintrebert is trade-only.
CREATE POLICY "Public can read approved Cloud Filigrane pin"
ON public.gallery_hotspots FOR SELECT TO public
USING (
  id = '6064f929-612d-4408-8470-957c4fb1ca8e'::uuid
  AND designer_id = '1124b721-37e8-4a94-9adc-5b055fe892e0'::uuid
  AND (mapped_pick_id IS NULL OR mapped_pick_id = '4b46af75-4c35-4a81-bea6-822810ae3422'::uuid)
);