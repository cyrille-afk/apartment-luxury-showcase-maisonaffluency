## Goal

Make Delcourt Collection and Collection Particulière invisible across Public and Trade views without deleting any data. Their child designers (Studio Anansi, Flavien Delbergue, Luca Erba, Yabu Pushelberg, Christophe Delcourt) stay visible but lose the parent badge.

## Database changes (data only — via insert tool)

1. **`designers`** — confirm `is_published = false` on the two parent rows (already `false`, no-op). Set `founder = NULL` on every child row currently pointing to either name:
   - Studio Anansi, Flavien Delbergue, Luca Erba, Yabu Pushelberg → was `Collection Particulière`
   - Christophe Delcourt (`delcourt-collection` slug) → was `Delcourt Collection`
2. **`designer_curator_picks`** — set `is_hidden = true` on all 32 picks attached to the two parent `designer_id`s.
3. **`trade_products`** — set `is_hidden = true` AND `is_active = false` on all 35 rows where `brand_name IN ('Delcourt Collection','Collection Particulière')`.

## Code changes

4. **`src/components/BrandsAteliers.tsx`** — remove the two atelier entries (`collection-particuliere` at L805, `delcourt` at L834) from the brands array, and remove their entries from the `dbParentName` registry around L1985–1998 plus the background-image / pill-label maps at L1735, L1770, L1846.
5. **`src/components/FeaturedDesigners.tsx`** — on the Forest & Giaconia profile, drop the BOB Armchair curator pick (L1227–1236) and clear `notableWorksLink` referencing "BOB Armchair - Delcourt Collection" (L1191). Leave the rest of the profile intact.
6. **`src/pages/PublicDesignerProfile.tsx`** — remove the two SEO title overrides at L59 and L65 that mention the brand names; the page falls back to the default title format.
7. **`src/pages/TradeLogin.tsx`** (L269) and **`src/pages/TradeRegister.tsx`** (L284) — remove "Collection Particulière" from the represented-brands marketing copy lists.
8. **`src/data/designersIndex.json`** — strip any entries keyed to the two slugs (used by directory search/autocomplete).

## OG bridge files

9. Delete all OG bridge files under `public/ateliers/`, `public/designers/`, and `public/collectibles/` whose filename starts with `delcourt-collection-` or `collection-particuliere-` (≈40 files, both `-og.html` and `-og-v2.html` variants). They are unindexed redirect shells; removing them prevents social cards from resolving.

## Out of scope

- No row deletions. Data remains restorable by flipping the flags back.
- Christophe Delcourt's own designer profile stays visible; only his parent-brand badge is cleared.
- Sitemap and robots.txt regenerate from DB on next build — no manual edit needed once `is_published`/`is_hidden` flags are set.

## Verification

- `/designers` (public + trade): no Delcourt or Collection Particulière cards, child designers still listed without parent pill.
- `/trade/products` and category grids: no products from these two brands.
- Tearsheet builder + FF&E: hidden picks excluded automatically (existing filter respects `is_hidden`).
- Direct visit to `/designers/delcourt-collection` or `/designers/collection-particuliere` falls through to the standard "not found" path because `is_published = false`.
