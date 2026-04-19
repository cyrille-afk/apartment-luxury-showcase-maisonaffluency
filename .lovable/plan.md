
The user wants two distinct behaviors based on which top-nav item is active:

1. **All Categories nav** (`/products-category/...`): filters show **product grid**, and "All Categories" link stays highlighted (not "Designers").
2. **Designers nav** (`/designers`): filters show **designer cards** (filtered by which designers have products in that category/subcategory), never the product grid.

Currently `DesignersDirectory.tsx` is shared between both routes (`PublicDesigners` page AND embedded on the homepage `/products-category/*` via `Index`), and it's been flip-flopping between showing product grid vs designer cards globally. The fix: make the behavior **route-aware**.

## Investigation needed
- Confirm `DesignersDirectory` is rendered on both `/designers` (PublicDesigners) and on `/products-category/*` (via Index → some section).
- Check Navigation.tsx for the "All Categories" link and its `isRouteActive` logic for `/products-category/*`.
- Find where designer cards are filtered by category (need to filter the alphabetical list to only designers who have at least one pick matching the selected cat/subcat).

## Plan

**1. `src/components/DesignersDirectory.tsx`**
- Add a prop `mode?: "products" | "designers"` (default `"designers"`).
- When `mode === "products"`: keep current behavior — filters produce product grid via `filteredPicks`.
- When `mode === "designers"`: `filteredPicks` always returns `null` (never product grid). Instead, filter the alphabetical designer list — only show designer cards whose picks include at least one item matching the active category/subcategory. If no filter active, show all designers.

**2. `src/pages/PublicDesigners.tsx`**
- Pass `mode="designers"` to `<DesignersDirectory />`.

**3. Wherever `DesignersDirectory` is used on homepage / `/products-category/*`** (likely `Index.tsx` or a section component)
- Pass `mode="products"` (or leave existing — verify).

**4. `src/components/Navigation.tsx`**
- Update `isRouteActive` so the "All Categories" / homepage-categories nav link is highlighted when pathname starts with `/products-category/`, and "Designers" only highlights on `/designers*` (not on `/products-category/*`).

**5. Update memory** `mem://features/directory-product-filtering.md` to reflect: behavior is route-scoped — `/designers` filters designer cards; `/products-category/*` filters product grid.

After approval I'll inspect `Navigation.tsx` and `Index.tsx` to wire the exact route checks and prop, then implement.
