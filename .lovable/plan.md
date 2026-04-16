

## Problem

All DB-driven features (product pages, hover images in filtered grid, image gallery) fail for public/anonymous visitors because the `designer_curator_picks` table has RLS policies that only allow **authenticated admin/trade users** to SELECT. The `designer_curator_picks_public` view inherits this restriction and returns empty results for anonymous visitors.

The UI code (borderless nav, ProductImageGallery thumbnails, View All link) is correctly implemented — verified in the codebase. The data just never arrives for public visitors.

## Root Cause

```
designer_curator_picks RLS:
  - "Admins can manage" → admin only
  - "Trade users can view" → trade_user only
  
designer_curator_picks_public view:
  - No separate RLS → inherits base table policies
  - Anonymous users → 0 rows returned
```

## Fix

### 1. Add public SELECT policy to `designer_curator_picks`

Create a database migration adding:

```sql
CREATE POLICY "Anyone can view curator picks"
ON public.designer_curator_picks
FOR SELECT
TO anon, authenticated
USING (true);
```

This is safe — curator picks are public-facing product data (images, titles, materials). Sensitive fields like `trade_price_cents` are already excluded from the public view. The existing admin-only write policies remain unchanged.

### 2. Verify "View All" link target

The "View All" link on the product page currently points to `/designers/${designer.slug}?section=picks&expanded=true`. The `PublicDesignerProfile` component reads `searchParams.get("section")` and scrolls to `picksSectionRef` when it equals `"picks"`. This is correctly implemented — it will work once the data loads.

### No other code changes needed

- `Navigation borderless` prop: already wired
- `ProductImageGallery`: already imported and used
- `mergeWithDbPicks`: already merging with hover image preservation
- `FeaturedDesigners` filtered picks: already includes DB picks with hover images

## Technical Details

- Single migration: one `CREATE POLICY` statement
- No code file changes required
- The `trade_price_cents` and `price_prefix` columns are already excluded from the public view, so pricing data stays protected

