# Trade record creation and complement eligibility

## Creation paths traced

- `src/components/trade/CsvPriceImport.tsx`: unmatched price-import rows insert a Trade record without `source_pick_id`; name matching is not maker-qualified.
- `src/components/trade/InlinePriceEditor.tsx`: unmatched exact/fuzzy price edits insert a Trade record without a source link.
- `supabase/functions/scrape-products/index.ts`: scraped name/maker matches update existing rows; unmatched extracted rows insert active unlinked records.
- `public.add_gallery_product_to_quote`: unmatched gallery selections create inactive, unlinked procurement placeholders (baseline SQL).
- `public.sync_curator_pick_to_trade_product`: current curator mirroring resolves source ID first, then exact maker/title, and saves the source link. The pre-June-18-2026 trigger keyed by maker/title without source IDs, so streamed title changes could leave separate historical rows.
- Pick deletion deactivates its Trade mirror; the source foreign key then sets the link to null so historical procurement records survive.

## Historical limits

Live Yoma Cabinet and Sideboard timestamps are May 31, 2026; Details is April 30, 2026 (not May 31). All precede the source-link migration. There is no per-product creator/import/scrape-run provenance field, so these timestamps do not establish which path or person inserted them. Supplier PDF inspection established one Yoma console/sideboard, not three additional products; those three duplicates were archived separately.

## Recommendation boundary

Unlinked does not mean invalid: legacy products and legitimate imports can lack links. However, they are not independently verified for complements and are excluded, not deleted or automatically archived. A source PDF, image or AI-written description cannot validate an independently named product.

Candidates require a visible canonical curator pick with nonblank title, maker, category and image. Trade candidates additionally require an active, visible row linked to that eligible pick. Existing identity grouping retains one product across both representations. These checks run before scoring/AI selection and again after inference, including a fresh source-pick read. Only final validated results enter project-board caches, and an empty final result clears old cached suggestions. Quotes, price imports, catalogue browsing and procurement records are unchanged.

Regressions: `supabase/functions/board-recommendations/catalogueValidation_test.ts`.