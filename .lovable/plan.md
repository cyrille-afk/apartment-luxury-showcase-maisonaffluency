
Fix the Angelo card mix-up by correcting both the data and the duplicate content source.

1. Restore the deleted Oval card in the database
- Recreate the deleted curator-pick record for Alinea Design Objects from the audit log entry:
  - deleted record id: `99696f9a-145c-4294-99f9-10afcad157a0`
  - title: `Angelo M - Oval Table`
- Insert it back into `designer_curator_picks` under designer `leo-aerts-alinea` so it returns to:
  - the Designer Editor
  - the public designer profile
  - the trade designer profile

2. Remove the wrong live card from the database
- Remove or hide the current `Angelo M/O 290` live DB row:
  - current id: `62a4eaaf-04e6-48fe-b88e-465313a94e31`
- This fixes the DB-driven designer/profile views where that card is coming from.

3. Remove the duplicate hardcoded Angelo M/O 290 source
- Update the static fallback data for Alinea in `src/components/FeaturedDesigners.tsx`.
- Right now `Angelo M/O 290` still exists there as hardcoded curator-pick content, which is why it can continue showing even after DB changes.
- Remove that hardcoded card, or replace it with the restored Oval card if Alinea still needs a static fallback there.

4. Audit merged curator-pick rendering paths
- Verify all places using merged static + DB picks so the wrong card cannot persist from a second source:
  - `src/hooks/useDbCuratorPicks.ts`
  - `src/components/ProductGrid.tsx`
  - `src/components/FeaturedDesigners.tsx`
  - `src/components/BrandsAteliers.tsx`
- Keep one source of truth for this card so future deletes/restores behave predictably.

5. Verify Alinea-specific views after the fix
- Confirm the final state is:
  - `Angelo M - Oval Table` is back in the Designer Editor
  - `Angelo M - Oval Table` displays in public/trade Alinea curator picks
  - `Angelo M/O 290` is hidden everywhere it should be hidden
- Specifically check:
  - `/trade/designers/admin`
  - `/designers/leo-aerts-alinea`
  - `/trade/designers/leo-aerts-alinea`
  - any gallery/product grids that still merge hardcoded and DB picks

Technical notes
- The Designer Editor reads only from `designer_curator_picks`, so deleting the Oval row removed it there completely.
- The lingering `Angelo M/O 290` is caused by a second hardcoded source in `FeaturedDesigners.tsx`, not only the database.
- No schema migration is required for this immediate repair; this is a data correction plus a code cleanup.
