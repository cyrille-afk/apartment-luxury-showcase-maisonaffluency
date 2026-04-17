

## Why mobile lands on the hero

When you tap "Armchairs" in the mobile menu we now correctly navigate to `/products-category/seating/armchairs`. That route renders the homepage and broadcasts a `syncCategoryFilter` event after 150 ms.

Problem: the homepage sections that listen to that event (`FeaturedDesigners`, `DesignersDirectory`, `Collectibles`, `BrandsAteliers`, `ProductGrid`) are lazy-loaded inside `<Suspense>`. On a fresh load — especially on mobile — they haven't mounted yet, so:

1. The event fires into the void (no listeners yet) → no filter is applied.
2. The `#designers` scroll target doesn't exist yet → page stays at the hero.

That's why it looks like the landing page with no filter.

## Fix

Make the URL the source of truth instead of a one-shot event.

1. **`src/pages/CategoryRoute.tsx`** — keep the event broadcast (for already-mounted sections), but also write the active category/subcategory to a small module-level store (e.g. `window.__activeCategoryFilter`) so late-mounting sections can read it on mount.

2. **Sections that filter** (`FeaturedDesigners`, `DesignersDirectory`, `Collectibles`, `BrandsAteliers`, `ProductGrid`) — on mount, initialize their selected category/subcategory from that store (or from `window.location.pathname` parsed via `categoryFromSlug` / `subcategoryFromSlugs`). This guarantees the filter is applied even if they mount after the event fires.

3. **Scroll**: replace the 150 ms timeout with a poll (up to ~2 s) that waits for `#designers` to exist before calling `scrollIntoView`. This handles the Suspense delay on mobile.

4. **No new memory needed** — this just fixes the existing slug-routing flow.

### Files to edit

- `src/pages/CategoryRoute.tsx` — set a shared "pending filter" + poll-based scroll.
- `src/components/FeaturedDesigners.tsx` — read pending filter on mount.
- `src/components/DesignersDirectory.tsx` — read pending filter on mount.
- `src/components/Collectibles.tsx` — read pending filter on mount.
- `src/components/BrandsAteliers.tsx` — read pending filter on mount.
- `src/components/ProductGrid.tsx` — read pending filter on mount.

After this, tapping any mobile category/subcategory will land you on the homepage with the correct filter applied and the grid scrolled into view, regardless of how slowly the lazy chunks load.

