

## Diagnosis (why publishing didn't fix it)

I reproduced the bug live on production: clicking **All Categories → Armchairs** from any page navigates to `/products-category/seating/armchairs` correctly, but the page lands on the **parallax interlude** ("Every piece of furniture tells a story…"), not on the filtered Armchairs grid. The filter never visibly applies, and the Clear-Filter pill never appears.

Root cause — the previous attempts targeted the wrong component:

1. `Index.tsx` renders **only one ProductGrid**, with `sectionScope="designers"`.
2. Inside `ProductGrid.tsx` lines 428–432 there is an early return:
   ```ts
   if (sectionScope && activeScope !== sectionScope) return null;
   if (sectionScope === "designers" && activeScope === "designers") return null;
   ```
   When the URL filter is applied, `filterSource` becomes `"designers"` → `activeScope === "designers"` → **the only ProductGrid on the page returns `null`.** So `#product-grid` never exists in the DOM, the Clear-Filter pill never renders, and the Armchairs grid is invisible.
3. The CategoryRoute poller can't find `#product-grid`, falls back to `#designers` (the DesignersDirectory wrapper), and lands you in the parallax interlude that sits just above it.
4. `FeaturedDesigners` is supposed to render the "filtered products inline" instead — but **`FeaturedDesigners` isn't even mounted in `Index.tsx`** (only `DesignersDirectory` is). So nothing renders the filtered grid at all.

That second `if` was written for a layout where `FeaturedDesigners` lived on the homepage. It no longer does. The condition is now actively breaking the whole feature, and republishing changed CategoryRoute polling but not this underlying bug, so nothing visibly improved.

## Fix

Remove the dead-code early return so the single homepage `ProductGrid` actually renders the filtered results.

**`src/components/ProductGrid.tsx`** (around line 432)
- Delete the line: `if (sectionScope === "designers" && activeScope === "designers") return null;`
- Keep the first guard (line 429) — that one is still correct for scoping `collectibles` / `ateliers` instances.

**`src/pages/CategoryRoute.tsx`** — keep current logic; once `#product-grid` actually exists in the DOM the existing poller will scroll to it correctly.

**`src/pages/Index.tsx`** — no change needed; the existing `<ProductGrid sectionScope="designers" />` will now render the Armchairs grid above `#designers`.

## Expected result after publish

- `/products-category/seating/armchairs` shows the Armchairs product grid with the Clear-Filter pill.
- The page auto-scrolls to that grid (since `#product-grid` now exists).
- Switching between subcategories via the mega menu replaces the grid contents (broadcast already works).
- Mobile menu category taps land on the filtered grid the same way.

## Files to edit

- `src/components/ProductGrid.tsx` — remove the one breaking early-return line.

That's the entire fix. One line. Approve and I'll apply it.

