
Goal: fix the 4 issues without changing data structure unless needed. I checked the code and the database state.

1. Header/product-sheet spacing
- The page already has `pt-28` in `PublicProductPage.tsx`, but that is just a hardcoded guess.
- The header is a fixed, stacked desktop nav in `Navigation.tsx`, so the offset should match the real header height, not an arbitrary padding value.
- I’ll replace the current spacing with a single header-offset source of truth so the product sheet starts below the header by the same visual height on desktop and mobile.

2. Pierre Bonnefille “Metamorphosis Lamps A&B” missing in Table Lights
- The item exists in data.
- Root cause: `FeaturedDesigners.tsx` still uses old exact-matching logic for filtered picks:
  - selected filter = `Table Lights`
  - product subcategory = `Table Lamps`
  - no normalization, so it gets excluded.
- I’ll update `FeaturedDesigners.tsx` to use the canonical taxonomy normalization already used elsewhere, so `Table Lamp/Table Lamps/Table Light/Table Lights` all resolve correctly.

3. Add a 5th thumbnail field in Designer Editor
- The current admin UI is dynamic and only shows as many rows as already exist.
- That’s why there is no always-visible 5th field.
- I’ll change the curator-pick thumbnail editor so it always renders at least 5 slots, while still keeping reorder, remove, and insert-between behavior.

4. Rua Leblon hover image not showing in the armchair product grid
- The hover image is present in the database.
- Root cause: on the designers side, `FeaturedDesigners.tsx` builds filtered grid items from hardcoded picks first, then skips the DB duplicate entirely instead of merging DB fields into the hardcoded item.
- So the DB hover image never reaches the grid card, even though it exists and shows elsewhere.
- I’ll change that logic to merge DB fields into hardcoded picks before deduping, especially `hoverImage`, description, taxonomy, PDFs, etc.

Implementation steps
1. Fix `PublicProductPage.tsx` top offset using a nav-height-matched spacer/offset instead of the loose `pt-28`.
2. Refactor `FeaturedDesigners.tsx` filter matching to use normalized subcategories/categories.
3. Refactor `FeaturedDesigners.tsx` filtered pick assembly so DB values enrich hardcoded picks instead of being skipped.
4. Update `TradeDesignersAdmin.tsx` thumbnail editor to show 5 visible slots minimum.
5. Verify the same taxonomy/merge behavior is consistent across the product-filter grid so this does not regress elsewhere.

Technical notes
- No database migration is needed for these 4 fixes.
- The relevant data already exists:
  - Pierre Bonnefille → `Metamorphosis Lamps A&B` is in the database with subcategory `Table Lamps`
  - Man of Parts → `Rua Leblon` has the hover image URL saved in `hover_image_url`
- Main files to update:
  - `src/pages/PublicProductPage.tsx`
  - `src/components/Navigation.tsx` or shared spacing logic tied to it
  - `src/components/FeaturedDesigners.tsx`
  - `src/pages/TradeDesignersAdmin.tsx`

Expected result
- Product page sits correctly below the fixed header.
- Pierre Bonnefille lamp appears under Table Lights.
- Admin always sees 5 thumbnail fields immediately.
- Rua Leblon hover image appears in the armchair product grid, not only in Curators’ Picks.
