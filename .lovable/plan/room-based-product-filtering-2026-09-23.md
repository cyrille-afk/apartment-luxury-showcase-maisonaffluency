# Room-based product filtering

## Scope
- Add a shared room map for Living Room, Bedroom, and Office using the supplied product categories.
- Keep the existing Dining Room link functional with a sensible dining-focused mapping.
- Route every “Shop By Room” entry to `/search?room=<slug>`.
- Add a public search view that reads the room query, matches products against all mapped categories, removes duplicates, and presents the existing product-card experience.
- Show a clear empty state for unknown room values instead of silently displaying unrelated products.

## Technical details
- Reuse the current curator-pick catalogue data, taxonomy normalization, card styling, pricing rules, and product links.
- Match canonical plural and singular category labels so values such as `coffee-tables`, `floor-lights`, and `nightstands` resolve reliably.
- Preserve English labels, public pricing visibility rules, and “Price upon Request” fallbacks.
- Verify all room links and representative filtered results in the live preview at desktop and mobile widths.
