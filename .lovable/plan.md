

## Problem

Two issues remaining and the previous AI got stuck in a tool-call loop:

1. **Back button still leads to designer profile**, not the armchair grid.
2. **Confirm the duplicate top-right heart icon** is actually removed.

## Root cause analysis

The file `src/pages/PublicProductPage.tsx` already has:
- `fromPath = stateFrom || sessionStorage.getItem("product_from_path")`
- A computed `fallbackGridPath` like `/designers?category=Seating&subcategory=Armchairs`
- The duplicate heart appears already removed (no absolute-positioned heart in lines 294-306)

The remaining bug: **stale `sessionStorage`**. If the user previously visited a product by clicking from a designer profile page (`/designers/yabu-pushelberg`), that path got written to `product_from_path`. On the next visit from the armchair grid, if React Router state is lost (e.g. hard refresh, hydration timing, or a Link without `state`), the stale designer URL wins over the correct grid fallback.

Also, the fallback uses `/designers?category=...` — but the directory grid filter may actually live on `/` (homepage) or use different param names. Need to verify which route renders the filtered PickCard grid.

## Plan

1. **Verify which route renders the filtered grid** (`/` vs `/designers`) and the exact query param names by reading `DesignersDirectory.tsx` filter logic and where it's mounted.

2. **Fix `PublicProductPage.tsx` Back logic**:
   - Prefer fresh `state.from` (current session navigation).
   - Only use `sessionStorage` value if it contains a grid query (`?category=` or `?subcategory=`); otherwise discard as stale.
   - Always fall back to the computed `fallbackGridPath` (built from product's category/subcategory) using the correct route confirmed in step 1.
   - Clear `product_from_path` on unmount/new product to prevent cross-product pollution.

3. **Confirm duplicate heart removal**: lines 294-306 already show no absolute heart; visually verify nothing else renders one.

## Files to edit

- `src/pages/PublicProductPage.tsx` — refine `fromPath` resolution + fallback route.

## Technical detail

```ts
const isGridUrl = (p?: string | null) =>
  !!p && /[?&](category|subcategory)=/.test(p);

const fromPath = stateFrom ?? (isGridUrl(storedFrom) ? storedFrom : null);
// Back handler: navigate(fromPath ?? fallbackGridPath)
```

